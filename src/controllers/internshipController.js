const Internship = require('../models/Internship');

const getInternships = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'supervisor') {
      filter.supervisor = req.user._id;
    }
    const internships = await Internship.find(filter)
      .populate('student', 'firstName lastName email phone avatar')
      .populate('supervisor', 'firstName lastName email phone')
      .populate('class', 'name section level');
    res.json(internships);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyInternship = async (req, res) => {
  try {
    const internship = await Internship.findOne({ student: req.user._id })
      .populate('student', 'firstName lastName email phone avatar')
      .populate('supervisor', 'firstName lastName email phone')
      .populate('class', 'name section level');
    
    if (!internship) {
      return res.status(404).json({ message: 'No active internship found for your profile.' });
    }
    res.json(internship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateInternship = async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisor, status, tasksCompleted, totalTasks, attendanceRate, supervisorRating, progress, endDate } = req.body;

    const internship = await Internship.findById(id);
    if (!internship) {
      return res.status(404).json({ message: 'Internship record not found.' });
    }

    if (supervisor !== undefined) internship.supervisor = supervisor || null;
    if (status !== undefined) internship.status = status;
    if (tasksCompleted !== undefined) internship.tasksCompleted = Number(tasksCompleted);
    if (totalTasks !== undefined) internship.totalTasks = Number(totalTasks);
    if (attendanceRate !== undefined) internship.attendanceRate = Number(attendanceRate);
    if (supervisorRating !== undefined) internship.supervisorRating = Number(supervisorRating);
    if (progress !== undefined) internship.progress = Number(progress);
    if (endDate !== undefined) internship.endDate = endDate ? new Date(endDate) : null;

    await internship.save();
    res.json(internship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getInternships,
  getMyInternship,
  updateInternship
};
