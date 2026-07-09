const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, taskController.getTasks);
router.post('/', protect, authorize('supervisor', 'admin', 'superadmin'), taskController.createTask);
router.get('/:id', protect, taskController.getTaskById);
router.patch('/:id', protect, authorize('supervisor', 'admin', 'superadmin'), taskController.updateTask);
router.delete('/:id', protect, authorize('admin', 'superadmin'), taskController.deleteTask);
router.post('/:id/assign-new-students', protect, authorize('supervisor', 'admin', 'superadmin'), taskController.assignExistingTaskToNewStudents);
router.patch('/:id/start', protect, taskController.startTask);
router.patch('/:id/submit', protect, taskController.submitTask);
router.patch('/:id/approve', protect, authorize('supervisor', 'admin', 'superadmin'), taskController.approveTask);
router.patch('/:id/reject', protect, authorize('supervisor', 'admin', 'superadmin'), taskController.rejectTask);

module.exports = router;
