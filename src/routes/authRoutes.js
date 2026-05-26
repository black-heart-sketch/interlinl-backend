const express = require('express');
const { uploadSingle } = require('../middleware/multer');
const {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  forgotPassword,
  resetPassword,
  initiateRegistrationPayment,
  getRegistrationPaymentStatus
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', uploadSingle('paymentReceipt'), registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/initiate-registration-payment', initiateRegistrationPayment);
router.get('/registration-payment-status/:transactionId', getRegistrationPaymentStatus);

module.exports = router;
