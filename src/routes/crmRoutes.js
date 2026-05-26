const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All CRM routes require authentication and advisor/admin roles
router.use(protect);
router.use(authorize('advisor', 'admin', 'superadmin'));

router.get('/leads', crmController.getLeads);
router.post('/leads', crmController.createLead);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);
router.patch('/leads/:id/status', crmController.updateLeadStatus);
router.patch('/leads/:id/assign', crmController.assignLead);
router.post('/leads/:id/notes', crmController.addNoteToLead);

module.exports = router;
