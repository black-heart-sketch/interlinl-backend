const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');
const controller = require('../controllers/messageController');

router.get('/contacts', protect, controller.getContacts);
router.get('/:userId', protect, controller.getConversation);
router.post('/', protect, uploadMultiple([{ name: 'attachments', maxCount: 5 }]), controller.sendMessage);
router.patch('/:userId/read', protect, controller.markConversationRead);

module.exports = router;
