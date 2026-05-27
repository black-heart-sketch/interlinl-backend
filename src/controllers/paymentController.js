const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const { checkBalance, requestPayout } = require('../utils/digipay');

const createPayment = async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate('studentId', 'firstName lastName email');
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('studentId', 'firstName lastName email');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json(payment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const handleDigipayWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const data = payload.data || payload;
    const transactionId = data.transactionId || data.reference || data.id;
    const status = data.status;

    if (transactionId) {
      const payment = await Payment.findOne({ reference: transactionId });
      if (payment && status) {
        const normalizedStatus = ['completed', 'success', 'successful'].includes(String(status).toLowerCase())
          ? 'completed'
          : ['failed', 'cancelled', 'canceled', 'expired'].includes(String(status).toLowerCase())
            ? 'failed'
            : 'pending';
        payment.status = normalizedStatus;
        await payment.save();

        if (normalizedStatus === 'completed' && payment.purpose === 'course' && payment.enrollmentId) {
          await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
            status: 'active',
            accessLevel: 'full'
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('DigiPay webhook error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getDigipayBalance = async (req, res) => {
  try {
    const balance = await checkBalance();
    res.status(200).json(balance);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

const createDigipayPayout = async (req, res) => {
  try {
    const payout = await requestPayout(req.body);
    res.status(200).json(payout);
  } catch (error) {
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
