const express = require('express');
const {
  getReferralCodes,
  createReferralCode,
  updateReferralCode,
  deleteReferralCode,
  getReferralStats
} = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorize('superadmin', 'admin'));

router.get('/stats', getReferralStats);
router.route('/')
  .get(getReferralCodes)
  .post(createReferralCode);

router.route('/:id')
  .put(updateReferralCode)
  .delete(deleteReferralCode);

module.exports = router;
