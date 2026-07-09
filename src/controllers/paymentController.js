const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Setting = require('../models/Setting');
const InternshipApplication = require('../models/InternshipApplication');
const Internship = require('../models/Internship');
const { buildWebhookUrl, checkBalance, getTransactionStatus, initiatePayIn, requestPayout } = require('../utils/digipay');

const getInternshipFeeSettings = async () => {
  const [feeSetting, installmentsSetting] = await Promise.all([
    Setting.findOne({ key: 'internshipFee' }),
    Setting.findOne({ key: 'internshipInstallments' })
  ]);

  return {
    internshipFee: feeSetting ? Number(feeSetting.value) || 0 : 0,
    internshipInstallments: installmentsSetting ? Math.max(1, Math.floor(Number(installmentsSetting.value) || 1)) : 1
  };
};

const buildInternshipPaymentSummary = async (studentId) => {
  const { internshipFee, internshipInstallments } = await getInternshipFeeSettings();
  const payments = await Payment.find({ studentId, purpose: 'internship' }).sort({ createdAt: -1 });
  const completedPayments = payments.filter((payment) => payment.status === 'completed');
  const pendingPayments = payments.filter((payment) => payment.status === 'pending');
  const amountPaid = completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remainingAmount = Math.max(0, internshipFee - amountPaid);
  const maxPayableAmount = Math.max(0, remainingAmount - pendingAmount);
  const baseInstallment = internshipInstallments > 0 ? Math.ceil(internshipFee / internshipInstallments) : internshipFee;
  const nextInstallmentAmount = maxPayableAmount > 0 ? Math.min(baseInstallment, maxPayableAmount) : 0;

  return {
    internshipFee,
    internshipInstallments,
    amountPaid,
    pendingAmount,
    remainingAmount,
    maxPayableAmount,
    nextInstallmentAmount,
    completedInstallments: completedPayments.length,
    payments
  };
};

const normalizeGatewayStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'success', 'successful', 'paid'].includes(normalized)) return 'completed';
  if (['failed', 'cancelled', 'canceled', 'expired'].includes(normalized)) return 'failed';
  return 'pending';
};

const activateApplicationAfterPayment = async (application) => {
  if (!application) return null;

  application.paymentStatus = 'paid';
  application.status = 'approved';
  await application.save();

  const user = await require('../models/User').findById(application.user);
  if (user) {
    user.status = 'active';
    user.department = application.department;
    await user.save();

    const existingInternship = await Internship.findOne({ student: user._id });
    if (!existingInternship) {
      await Internship.create({
        student: user._id,
        department: application.department,
        class: user.class || null,
        status: 'active',
        progress: 0
      });
    }
  }

  return application;
};

const createPayment = async (req, res) => {
  console.log('[Backend PaymentController] createPayment called with body:', req.body);
  try {
    const payment = new Payment(req.body);
    await payment.save();
    console.log('[Backend PaymentController] createPayment created payment successfully:', payment);
    res.status(201).json(payment);
  } catch (error) {
    console.error('[Backend PaymentController] createPayment error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getPayments = async (req, res) => {
  console.log('[Backend PaymentController] getPayments called');
  try {
    const payments = await Payment.find().populate('studentId', 'firstName lastName email');
    console.log(`[Backend PaymentController] getPayments returning ${payments.length} payments`);
    res.status(200).json(payments);
  } catch (error) {
    console.error('[Backend PaymentController] getPayments error:', error);
    res.status(500).json({ message: error.message });
  }
};

const reconcilePendingPayments = async (req, res) => {
  try {
    const pendingPayments = await Payment.find({ status: 'pending', reference: { $exists: true, $ne: '' } });
    const pendingApplications = await InternshipApplication.find({
      paymentStatus: 'pending',
      transactionId: { $exists: true, $ne: '' }
    });

    const results = [];

    for (const payment of pendingPayments) {
      let gatewayStatus = 'pending';
      let checked = true;
      try {
        if (String(payment.reference).startsWith('dp_tx_')) {
          gatewayStatus = 'completed';
        } else {
          const txn = await getTransactionStatus(payment.reference);
          gatewayStatus = normalizeGatewayStatus(txn?.status);
        }

        if (gatewayStatus === 'completed') {
          payment.status = 'completed';
          await payment.save();
        } else if (gatewayStatus === 'failed') {
          payment.status = 'failed';
          await payment.save();
        }
      } catch (error) {
        checked = false;
        gatewayStatus = 'check_failed';
      }

      results.push({
        type: 'payment',
        id: payment._id,
        reference: payment.reference,
        purpose: payment.purpose,
        checked,
        status: payment.status,
        gatewayStatus
      });
    }

    for (const application of pendingApplications) {
      let gatewayStatus = 'pending';
      let checked = true;
      try {
        if (String(application.transactionId).startsWith('dp_tx_')) {
          gatewayStatus = 'completed';
        } else {
          const txn = await getTransactionStatus(application.transactionId);
          gatewayStatus = normalizeGatewayStatus(txn?.status);
        }

        if (gatewayStatus === 'completed') {
          await activateApplicationAfterPayment(application);
        }
      } catch (error) {
        checked = false;
        gatewayStatus = 'check_failed';
      }

      results.push({
        type: 'registration',
        id: application._id,
        reference: application.transactionId,
        checked,
        status: application.paymentStatus,
        applicationStatus: application.status,
        gatewayStatus
      });
    }

    const completed = results.filter((item) => item.gatewayStatus === 'completed').length;
    const failed = results.filter((item) => item.gatewayStatus === 'failed').length;
    const checkFailed = results.filter((item) => item.gatewayStatus === 'check_failed').length;

    res.json({
      message: `Checked ${results.length} pending payment record${results.length === 1 ? '' : 's'}.`,
      checked: results.length,
      completed,
      failed,
      checkFailed,
      stillPending: results.length - completed - failed - checkFailed,
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyInternshipPaymentSummary = async (req, res) => {
  try {
    const summary = await buildInternshipPaymentSummary(req.user._id);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const initiateInternshipInstallment = async (req, res) => {
  try {
    const summary = await buildInternshipPaymentSummary(req.user._id);

    if (summary.internshipFee <= 0) {
      return res.status(400).json({ message: 'Internship fee is not configured yet.' });
    }

    if (summary.remainingAmount <= 0) {
      return res.status(400).json({ message: 'Your internship fee is already fully paid.' });
    }

    if (summary.maxPayableAmount <= 0) {
      return res.status(400).json({ message: 'You already have pending payments covering the remaining fee.' });
    }

    const requestedAmount = Number(req.body.amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ message: 'Enter a valid payment amount greater than 0 XAF.' });
    }

    const amount = Math.floor(requestedAmount);
    if (amount > summary.maxPayableAmount) {
      return res.status(400).json({ message: `Payment amount cannot exceed the remaining payable balance of ${summary.maxPayableAmount} XAF.` });
    }

    const phone = req.body.phone || req.user.phone;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required for Mobile Money payment.' });
    }

    const installmentNumber = summary.completedInstallments + 1;
    const referencePrefix = 'internship_' + Date.now();
    let transactionId = referencePrefix;
    let status = 'pending';
    let message = 'DigiPay internship installment initiated successfully.';

    const apiKeySetting = await Setting.findOne({ key: 'digipayApiKey' });
    const apiKey = apiKeySetting?.value ? String(apiKeySetting.value).trim() : process.env.DIGIPAY_API_KEY;

    if (!apiKey || apiKey === 'dpk_test_einstein' || apiKey.startsWith('dpk_test_')) {
      transactionId = 'dp_tx_' + Math.random().toString(36).slice(2, 11);
      status = 'completed';
      message = 'Sandbox internship installment completed successfully.';
    } else {
      const payin = await initiatePayIn({
        amount,
        customerPhone: phone,
        customerEmail: req.user.email,
        metadata: { purpose: 'internship', userId: String(req.user._id), installmentNumber },
        webhookUrl: buildWebhookUrl(req)
      });
      transactionId = payin.transactionId;
    }

    const payment = await Payment.create({
      studentId: req.user._id,
      purpose: 'internship',
      amount,
      currency: 'XAF',
      method: 'mobile_money',
      status,
      reference: transactionId,
      installmentNumber
    });

    res.status(201).json({
      message,
      payment,
      transactionId,
      amount,
      currency: 'XAF',
      status,
      summary: await buildInternshipPaymentSummary(req.user._id)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

const recordManualInternshipPayment = async (req, res) => {
  try {
    const { studentId, amount, reference, note } = req.body;
    if (!studentId) {
      return res.status(400).json({ message: 'Student is required.' });
    }

    const summary = await buildInternshipPaymentSummary(studentId);
    if (summary.internshipFee <= 0) {
      return res.status(400).json({ message: 'Internship fee is not configured yet.' });
    }
    if (summary.remainingAmount <= 0) {
      return res.status(400).json({ message: 'This student has already fully paid the internship fee.' });
    }

    const numericAmount = Math.floor(Number(amount));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Enter a valid amount greater than 0 XAF.' });
    }
    if (numericAmount > summary.remainingAmount) {
      return res.status(400).json({ message: `Amount cannot exceed the remaining balance of ${summary.remainingAmount} XAF.` });
    }

    const payment = await Payment.create({
      studentId,
      purpose: 'internship',
      amount: numericAmount,
      currency: 'XAF',
      method: 'cash',
      status: 'completed',
      reference: reference?.trim() || `manual_cash_${Date.now()}`,
      installmentNumber: summary.completedInstallments + 1,
      adminNote: note?.trim() || '',
      recordedBy: req.user._id
    });

    res.status(201).json({
      message: 'Manual internship payment recorded successfully.',
      payment,
      summary: await buildInternshipPaymentSummary(studentId)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPaymentById = async (req, res) => {
  console.log(`[Backend PaymentController] getPaymentById called for ID: ${req.params.id}`);
  try {
    const payment = await Payment.findById(req.params.id).populate('studentId', 'firstName lastName email');
    if (!payment) {
      console.warn(`[Backend PaymentController] getPaymentById: Payment with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Payment not found' });
    }
    console.log(`[Backend PaymentController] getPaymentById found payment:`, payment);
    res.status(200).json(payment);
  } catch (error) {
    console.error(`[Backend PaymentController] getPaymentById error for ID ${req.params.id}:`, error);
    res.status(500).json({ message: error.message });
  }
};

const updatePayment = async (req, res) => {
  console.log(`[Backend PaymentController] updatePayment called for ID: ${req.params.id} with body:`, req.body);
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!payment) {
      console.warn(`[Backend PaymentController] updatePayment: Payment with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Payment not found' });
    }
    console.log(`[Backend PaymentController] updatePayment successfully updated payment:`, payment);
    res.status(200).json(payment);
  } catch (error) {
    console.error(`[Backend PaymentController] updatePayment error for ID ${req.params.id}:`, error);
    res.status(400).json({ message: error.message });
  }
};

const deletePayment = async (req, res) => {
  console.log(`[Backend PaymentController] deletePayment called for ID: ${req.params.id}`);
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      console.warn(`[Backend PaymentController] deletePayment: Payment with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Payment not found' });
    }
    console.log(`[Backend PaymentController] deletePayment successfully deleted payment ID: ${req.params.id}`);
    res.status(200).json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error(`[Backend PaymentController] deletePayment error for ID ${req.params.id}:`, error);
    res.status(500).json({ message: error.message });
  }
};

const handleDigipayWebhook = async (req, res) => {
  console.log('[Backend PaymentController] DigiPay webhook received. Payload:', req.body);
  try {
    const payload = req.body || {};
    const data = payload.data || payload;
    const transactionId = data.transactionId || data.reference || data.id;
    const status = data.status;

    console.log(`[Backend PaymentController] Parsed Webhook data - transactionId: ${transactionId}, status: ${status}`);

    if (transactionId) {
      const payment = await Payment.findOne({ reference: transactionId });
      if (payment) {
        console.log(`[Backend PaymentController] Webhook: Found matching payment record:`, payment);
        if (status) {
          const normalizedStatus = ['completed', 'success', 'successful'].includes(String(status).toLowerCase())
            ? 'completed'
            : ['failed', 'cancelled', 'canceled', 'expired'].includes(String(status).toLowerCase())
              ? 'failed'
              : 'pending';
          
          console.log(`[Backend PaymentController] Webhook: Status normalization: "${status}" -> "${normalizedStatus}"`);
          payment.status = normalizedStatus;
          await payment.save();
          console.log(`[Backend PaymentController] Webhook: Payment status updated in DB to: ${normalizedStatus}`);

          if (normalizedStatus === 'completed' && payment.purpose === 'course' && payment.enrollmentId) {
            console.log(`[Backend PaymentController] Webhook: Activating course enrollment ID: ${payment.enrollmentId}`);
            const updatedEnrollment = await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
              status: 'active',
              accessLevel: 'full'
            }, { new: true });
            console.log(`[Backend PaymentController] Webhook: Enrollment activated:`, updatedEnrollment);
          }
        }
      } else {
        console.warn(`[Backend PaymentController] Webhook: No matching payment record found for transactionId/reference: ${transactionId}`);
      }
    } else {
      console.warn('[Backend PaymentController] Webhook: Received payload but could not determine transactionId.');
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('DigiPay webhook error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getDigipayBalance = async (req, res) => {
  console.log('[Backend PaymentController] getDigipayBalance called');
  try {
    const balance = await checkBalance();
    console.log('[Backend PaymentController] DigiPay balance retrieved:', balance);
    res.status(200).json(balance);
  } catch (error) {
    console.error('[Backend PaymentController] getDigipayBalance error:', error);
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

const createDigipayPayout = async (req, res) => {
  console.log('[Backend PaymentController] createDigipayPayout called with body:', req.body);
  try {
    const payout = await requestPayout(req.body);
    console.log('[Backend PaymentController] DigiPay payout request successful:', payout);
    res.status(200).json(payout);
  } catch (error) {
    console.error('[Backend PaymentController] createDigipayPayout error:', error);
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

module.exports = {
  createPayment,
  createDigipayPayout,
  getMyInternshipPaymentSummary,
  getPayments,
  getPaymentById,
  getDigipayBalance,
  handleDigipayWebhook,
  initiateInternshipInstallment,
  recordManualInternshipPayment,
  reconcilePendingPayments,
  updatePayment,
  deletePayment
};
