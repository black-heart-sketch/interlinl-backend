const express = require('express');
const controller = require('../controllers/aiMockExamController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/blueprints', controller.getBlueprints);
router.post('/blueprints', authorize('admin', 'superadmin'), controller.createBlueprint);
router.put('/blueprints/:id', authorize('admin', 'superadmin'), controller.updateBlueprint);

router.get('/generated', authorize('admin', 'superadmin', 'teacher', 'advisor'), controller.getGeneratedExams);
router.post('/generate', authorize('admin', 'superadmin'), controller.generateExam);
router.get('/generated/:examId', authorize('admin', 'superadmin', 'teacher', 'advisor'), controller.getGeneratedExam);
router.patch('/generated/:id/approve', authorize('admin', 'superadmin'), controller.approveGeneratedExam);
router.patch('/generated/:examId/regenerate-section/:sectionKey', authorize('admin', 'superadmin'), controller.regenerateSection);

router.get('/sessions/available', controller.getAvailableSessions);
router.get('/sessions', controller.getSessions);
router.post('/sessions', authorize('admin', 'superadmin'), controller.createSession);
router.patch('/sessions/:id/schedule', authorize('admin', 'superadmin'), controller.scheduleSession);
router.patch('/sessions/:id/launch', authorize('admin', 'superadmin'), controller.launchSession);
router.patch('/sessions/:id/close', authorize('admin', 'superadmin'), controller.closeSession);
router.patch('/sessions/:id/correct', authorize('admin', 'superadmin'), controller.runSessionCorrection);
router.patch('/sessions/:id/release-results', authorize('admin', 'superadmin'), controller.releaseResults);
router.post('/sessions/:id/start', controller.startAttempt);

router.patch('/attempts/:attemptId/save', controller.saveAttempt);
router.post('/attempts/:attemptId/submit', controller.submitAttempt);
router.get('/attempts/:attemptId/result', controller.getAttemptResult);

module.exports = router;
