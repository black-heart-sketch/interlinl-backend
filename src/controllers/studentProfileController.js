const StudentProfile = require('../models/StudentProfile');

const createStudentProfile = async (req, res) => {
  try {
    const profile = new StudentProfile({ ...req.body, userId: req.user.id });
    await profile.save();
    res.status(201).json(profile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getStudentProfiles = async (req, res) => {
  try {
    const profiles = await StudentProfile.find().populate('userId', 'firstName lastName email');
    res.status(200).json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStudentProfileById = async (req, res) => {
  try {
    const profile = await StudentProfile.findById(req.params.id).populate('userId', 'firstName lastName email');
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user.id }).populate('userId', 'firstName lastName email');
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStudentProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(profile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteStudentProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createStudentProfile,
  getStudentProfiles,
  getStudentProfileById,
  getMyProfile,
  updateStudentProfile,
  deleteStudentProfile
};
