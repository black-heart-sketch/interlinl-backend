const InternshipApplication = require('../models/InternshipApplication');
const User = require('../models/User');
const Internship = require('../models/Internship');

const getApplications = async (req, res) => {
  try {
    const applications = await InternshipApplication.find()
      .populate('user', 'firstName lastName email phone role status class')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await InternshipApplication.findById(id)
      .populate('user', 'firstName lastName email phone role status class');
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createApplication = async (req, res) => {
  try {
    const { department, studyMode, paymentOption, paymentStatus, transactionId, resumeUrl, coverLetter } = req.body;
    
    if (!department) {
      return res.status(400).json({ message: 'Department track is required' });
    }

    const application = await InternshipApplication.create({
      user: req.user._id, // Assumes user is authenticated
      department,
      studyMode: studyMode || 'online',
      paymentOption: paymentOption || 'pay_now',
      paymentStatus: paymentStatus || 'pending',
      transactionId,
      resumeUrl,
      coverLetter,
      status: 'pending'
    });

    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisorId, classId, endDate } = req.body;

    const application = await InternshipApplication.findById(id).populate('user');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = 'approved';
    application.paymentStatus = 'paid'; // Manual approval overrides pending payments
    await application.save();

    // Activate the User account
    const user = application.user;
    if (user) {
      user.status = 'active';
      if (classId) user.class = classId;
      user.department = application.department;
      await user.save();
    }

    // Check if internship already exists
    let internship = await Internship.findOne({ student: user._id });
    if (!internship) {
      internship = await Internship.create({
        student: user._id,
        supervisor: supervisorId || null,
        department: application.department,
        class: classId || user.class || null,
        startDate: new Date(),
        endDate: endDate ? new Date(endDate) : null,
        status: 'active',
        progress: 0
      });
    } else {
      internship.status = 'active';
      if (supervisorId) internship.supervisor = supervisorId;
      if (classId) internship.class = classId;
      if (endDate) internship.endDate = new Date(endDate);
      await internship.save();
    }

    res.json({ 
      message: 'Application approved successfully, student account activated, and internship initialized.', 
      internship 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await InternshipApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = 'rejected';
    await application.save();

    res.json({ message: 'Application rejected.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getApplications,
  getApplicationById,
  createApplication,
  approveApplication,
  rejectApplication
};
