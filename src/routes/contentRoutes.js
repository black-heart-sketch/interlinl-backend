const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/multer');
const { serviceController, projectController } = require('../controllers/contentController');

router.get('/services', serviceController.list);
router.post('/services', protect, authorize('admin', 'superadmin'), uploadSingle('image'), serviceController.create);
router.put('/services/:id', protect, authorize('admin', 'superadmin'), uploadSingle('image'), serviceController.update);
router.delete('/services/:id', protect, authorize('admin', 'superadmin'), serviceController.remove);

router.get('/projects', projectController.list);
router.post('/projects', protect, authorize('admin', 'superadmin'), uploadSingle('image'), projectController.create);
router.put('/projects/:id', protect, authorize('admin', 'superadmin'), uploadSingle('image'), projectController.update);
router.delete('/projects/:id', protect, authorize('admin', 'superadmin'), projectController.remove);

module.exports = router;
