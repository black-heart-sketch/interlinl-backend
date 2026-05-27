const Message = require('../models/Message');
const User = require('../models/User');
const Internship = require('../models/Internship');
const { moveFile } = require('../middleware/multer');
const { createNotification } = require('../services/notificationService');
const socket = require('../socket');
const path = require('path');

const normalizeRole = (role) => String(role || '').toLowerCase();
const nameFields = 'firstName lastName email avatar role department';

const canMessage = async (sender, receiver) => {
  const senderRole = normalizeRole(sender.role);
  const receiverRole = normalizeRole(receiver.role);

  if (['admin', 'superadmin'].includes(senderRole) || ['admin', 'superadmin'].includes(receiverRole)) return true;
  if (senderRole === 'student' && ['supervisor', 'teacher', 'advisor'].includes(receiverRole)) {
    return Boolean(await Internship.exists({ student: sender._id, supervisor: receiver._id }));
  }
  if (['supervisor', 'teacher', 'advisor'].includes(senderRole) && receiverRole === 'student') {
    return Boolean(await Internship.exists({ student: receiver._id, supervisor: sender._id }));
  }
  return ['supervisor', 'teacher', 'advisor'].includes(senderRole) && ['admin', 'superadmin'].includes(receiverRole);
};

const buildAttachmentPayload = async (processedFiles = []) => {
  const finalDir = path.join(__dirname, '../assets/documents/messages');
  const attachments = [];

  for (const file of (processedFiles || []).filter((item) => item.fieldName === 'attachments')) {
    const finalPath = path.join(finalDir, file.fileName);
    await moveFile(file.path, finalPath);
    let thumbnailUrl = '';
    if (file.thumbnailPath && file.thumbnailFilename) {
      const finalThumbPath = path.join(finalDir, file.thumbnailFilename);
      await moveFile(file.thumbnailPath, finalThumbPath);
      thumbnailUrl = `/assets/documents/messages/${file.thumbnailFilename}`;
    }
    attachments.push({
      name: file.originalName || file.fileName,
      url: `/assets/documents/messages/${file.fileName}`,
      type: file.type || 'file',
      size: file.fileSize || 0,
      thumbnailUrl,
    });
  }

  return attachments;
};

const getContacts = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    let contacts = [];

    if (role === 'student') {
      const internship = await Internship.findOne({ student: req.user._id, status: 'active' }).populate('supervisor', nameFields);
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select(nameFields).limit(20);
      contacts = [internship?.supervisor, ...admins].filter(Boolean);
    } else if (['supervisor', 'teacher', 'advisor'].includes(role)) {
      const internships = await Internship.find({ supervisor: req.user._id, status: 'active' }).populate('student', nameFields);
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select(nameFields).limit(20);
      contacts = [...internships.map((item) => item.student), ...admins].filter(Boolean);
    } else {
      contacts = await User.find({ _id: { $ne: req.user._id }, role: { $in: ['student', 'supervisor', 'teacher', 'advisor', 'manager'] } }).select(nameFields).limit(100);
    }

    const unique = Array.from(new Map(contacts.map((contact) => [String(contact._id), contact])).values());
    res.json(unique);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getConversation = async (req, res) => {
  try {
    const contact = await User.findById(req.params.userId);
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    if (!(await canMessage(req.user, contact))) return res.status(403).json({ message: 'Messaging is not allowed for this contact.' });

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: contact._id },
        { sender: contact._id, receiver: req.user._id },
      ],
    }).populate('sender', nameFields).populate('receiver', nameFields).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const receiver = await User.findById(req.body.receiverId);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found.' });
    if (!(await canMessage(req.user, receiver))) return res.status(403).json({ message: 'Messaging is not allowed for this contact.' });

    const attachments = await buildAttachmentPayload(req.processedFiles);
    if (!req.body.content && attachments.length === 0) {
      return res.status(400).json({ message: 'Message content or attachment is required.' });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiver._id,
      content: req.body.content || '',
      attachments,
    });

    const populated = await Message.findById(message._id).populate('sender', nameFields).populate('receiver', nameFields);
    try {
      socket.getIO().to(`user:${receiver._id}`).emit('message:new', populated);
      socket.getIO().to(`user:${req.user._id}`).emit('message:sent', populated);
    } catch {}

    await createNotification({
      recipient: receiver._id,
      actor: req.user._id,
      type: 'message',
      title: 'New message',
      message: req.body.content || 'Sent an attachment.',
      link: '/dashboard?view=messages',
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markConversationRead = async (req, res) => {
  try {
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'Conversation marked as read.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getContacts, getConversation, sendMessage, markConversationRead };
