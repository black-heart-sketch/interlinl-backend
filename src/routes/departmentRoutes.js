const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', departmentController.getDepartments);
router.post('/', protect, authorize('admin', 'superadmin'), departmentController.createDepartment);
router.put('/:id', protect, authorize('admin', 'superadmin'), departmentController.updateDepartment);
router.delete('/:id', protect, authorize('admin', 'superadmin'), departmentController.deleteDepartment);

module.exports = router;
