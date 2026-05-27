const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const { checkBalance, requestPayout } = require('../utils/digipay');

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
  getPayments,
  getPaymentById,
  getDigipayBalance,
  handleDigipayWebhook,
  updatePayment,
  deletePayment
};
