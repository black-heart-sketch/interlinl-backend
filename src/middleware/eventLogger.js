const User = require('../models/User');

const logEvent = async (req, res, next) => {
  const { userId } = req.body; 
  const researchId = req.params.researchId;

  if (userId && researchId) {
    try {
      await User.findByIdAndUpdate(userId, { $addToSet: { viewedResearch: researchId } });
    } catch (error) {
      console.error('Error logging research event:', error);
    }
  }

  next();
};

module.exports = logEvent;
