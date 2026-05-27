const Notification = require('../models/Notification');
const socket = require('../socket');

const createNotification = async ({ recipient, actor, type, title, message = '', link = '' }) => {
  if (!recipient || !type || !title) return null;

  const notification = await Notification.create({ recipient, actor, type, title, message, link });

  try {
    socket.getIO().to(`user:${recipient}`).emit('notification:new', notification);
  } catch {
    // Socket may not be initialized during scripts/tests.
  }

  return notification;
};

const notifyMany = async (items = []) => {
  const created = [];
  for (const item of items) {
    const notification = await createNotification(item);
    if (notification) created.push(notification);
  }
  return created;
};

module.exports = { createNotification, notifyMany };
