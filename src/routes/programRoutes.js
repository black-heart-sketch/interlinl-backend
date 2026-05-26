const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

// All operations require authentication and admin role (public fetching is handled in publicRoutes)
router.use(protect);
router.use(authorize('admin', 'superadmin'));

router.post('/', uploadMultiple([{ name: 'thumbnail', maxCount: 1 }, { name: 'syllabus', maxCount: 1 }]), programController.createProgram);
router.get('/', programController.getPrograms);
router.get('/:id', programController.getProgramById);
router.put('/:id', uploadMultiple([{ name: 'thumbnail', maxCount: 1 }, { name: 'syllabus', maxCount: 1 }]), programController.updateProgram);
router.delete('/:id', programController.deleteProgram);

module.exports = router;
