const Activity = require('../models/Activity');
const translationService = require('../services/translationService');

exports.createActivity = async (req, res) => {
  try {
    const activity = await Activity.create(req.body);
    await translationService.invalidateCache('activity');
    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'activities:all';
    const activities = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Activity.find().populate('staffId', 'firstName lastName email').sort({ createdAt: -1 })
    );
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    await translationService.invalidateCache('activity');
    res.status(200).json({ message: 'Activity deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
