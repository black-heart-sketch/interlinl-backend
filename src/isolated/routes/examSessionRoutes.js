const express = require('express');
const controller = require('../controllers/aiMockExamController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/available', controller.getAvailableSessions);
router.get('/', controller.getSessions);
router.post('/', authorize('admin', 'superadmin'), controller.createSession);
router.patch('/:id/schedule', authorize('admin', 'superadmin'), controller.scheduleSession);
router.patch('/:id/launch', authorize('admin', 'superadmin'), controller.launchSession);
router.patch('/:id/close', authorize('admin', 'superadmin'), controller.closeSession);
router.patch('/:id/run-correction', authorize('admin', 'superadmin'), controller.runSessionCorrection);
router.patch('/:id/release-results', authorize('admin', 'superadmin'), controller.releaseResults);
router.post('/:id/start', controller.startAttempt);

module.exports = router;
