const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/digipay/webhook', paymentController.handleDigipayWebhook);

router.use(protect);
// Assuming admin and student can view, but maybe only admin can manage fully
router.get('/', authorize('admin', 'superadmin', 'advisor'), paymentController.getPayments);
router.get('/digipay/balance', authorize('admin', 'superadmin'), paymentController.getDigipayBalance);
router.post('/digipay/payouts', authorize('admin', 'superadmin'), paymentController.createDigipayPayout);
router.post('/', authorize('admin', 'superadmin'), paymentController.createPayment);
router.get('/:id', authorize('admin', 'superadmin', 'student'), paymentController.getPaymentById);
router.put('/:id', authorize('admin', 'superadmin'), paymentController.updatePayment);
router.delete('/:id', authorize('admin', 'superadmin'), paymentController.deletePayment);

module.exports = router;
