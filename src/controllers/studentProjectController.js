const path = require('path');
const StudentProject = require('../models/StudentProject');
const Internship = require('../models/Internship');
const User = require('../models/User');
const { moveFile } = require('../middleware/multer');
const { createNotification, notifyMany } = require('../services/notificationService');

const normalizeRole = (role) => String(role || '').toLowerCase();
const ADMIN_ROLES = ['admin', 'superadmin', 'manager'];
const REVIEW_ROLES = [...ADMIN_ROLES, 'supervisor', 'teacher', 'advisor'];
const userFields = 'firstName lastName email avatar role department';

const parseDate = (value) => (value ? new Date(value) : null);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseTechnologies = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const refId = (value) => String(value?._id || value || '');

const buildSchoolTimeline = (startDate = new Date(), endDate = null) => {
  const stages = [
    ['theme', 'Theme validation', 'Confirm title, case study, supervisors, and expected deliverables.'],
    ['existing', 'Existing system study', 'Document the current system, limitations, and proposed solution.'],
    ['specification', 'Specification book', 'Define context, objectives, functional needs, constraints, resources, cost, and planning.'],
    ['analysis', 'Analysis phase', 'Prepare methodology comparison, use cases, communication, sequence, and activity diagrams.'],
    ['conception', 'Conception phase', 'Prepare architecture, class, state machine, package, and database design.'],
    ['realization', 'Realization phase', 'Implement the solution and document technical choices, deployment, and components.'],
    ['testing', 'Functionality testing', 'Capture unit tests, screenshots, validation scenarios, and corrections.'],
    ['user_guide', 'User guide and deployment guide', 'Write installation steps, user operations, screenshots, and support notes.'],
    ['final_review', 'Final report review', 'Submit the final document for academic/supervisor review and defense readiness.'],
  ];

  const totalDays = endDate ? Math.max(8, Math.ceil((endDate - startDate) / 86400000)) : 56;
  const interval = Math.max(1, Math.floor(totalDays / stages.length));

  return stages.map(([key, title, description], index) => ({
    key,
    title,
    description,
    order: index + 1,
    dueDate: addDays(startDate, interval * (index + 1)),
    status: index === 0 ? 'in_progress' : 'pending',
  }));
};

const canViewProject = (project, user) => {
  const role = normalizeRole(user.role);
  return (
    ADMIN_ROLES.includes(role) ||
    refId(project.student) === String(user._id) ||
    refId(project.supervisor) === String(user._id) ||
    REVIEW_ROLES.includes(role)
  );
};

const buildAttachmentPayload = async (processedFiles = []) => {
  const files = Array.isArray(processedFiles) ? processedFiles : [];
  const finalDir = path.join(__dirname, '../assets/documents/student-projects');
  const attachments = [];

  for (const file of files.filter((item) => item.fieldName === 'attachments')) {
    const finalPath = path.join(finalDir, file.fileName);
    await moveFile(file.path, finalPath);

    let thumbnailUrl = '';
    if (file.thumbnailPath && file.thumbnailFilename) {
      const finalThumbPath = path.join(finalDir, file.thumbnailFilename);
      await moveFile(file.thumbnailPath, finalThumbPath);
      thumbnailUrl = `/assets/documents/student-projects/${file.thumbnailFilename}`;
    }

    attachments.push({
      name: file.originalName || file.fileName,
      url: `/assets/documents/student-projects/${file.fileName}`,
      type: file.type || 'file',
      size: file.fileSize || 0,
      thumbnailUrl,
    });
  }

  return attachments;
};

const populateProject = (query) =>
  query
    .populate('student', userFields)
    .populate('supervisor', userFields)
    .populate('validatedBy', 'firstName lastName email role')
    .populate('internship', 'department startDate endDate status');

const listProjects = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const filter = {};

    if (role === 'student') {
      filter.student = req.user._id;
    } else if (['supervisor', 'teacher', 'advisor'].includes(role)) {
      filter.$or = [{ supervisor: req.user._id }, { supervisor: null }];
    }

    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.studentId) filter.student = req.query.studentId;

    const projects = await populateProject(StudentProject.find(filter)).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProject = async (req, res) => {
  try {
    const project = await populateProject(StudentProject.findById(req.params.id));
    if (!project) return res.status(404).json({ message: 'Student project not found.' });
    if (!canViewProject(project, req.user)) {
      return res.status(403).json({ message: 'You are not authorized to view this project.' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProject = async (req, res) => {
  try {
    const { title, theme, abstract, problemStatement, objectives, methodology, academicSupervisor, companySupervisor } = req.body;
    if (!title || !theme) {
      return res.status(400).json({ message: 'Project title and theme are required.' });
    }

    const internship = await Internship.findOne({ student: req.user._id, status: { $in: ['active', 'pending'] } }).sort({ createdAt: -1 });
    const attachments = await buildAttachmentPayload(req.processedFiles);

    const project = await StudentProject.create({
      student: req.user._id,
      supervisor: req.body.supervisorId || internship?.supervisor,
      internship: internship?._id,
      title,
      theme,
      abstract: abstract || '',
      problemStatement: problemStatement || '',
      objectives: objectives || '',
      methodology: methodology || '2TUP / UML',
      technologies: parseTechnologies(req.body.technologies),
      academicSupervisor: academicSupervisor || '',
      companySupervisor: companySupervisor || '',
      attachments,
      status: 'submitted',
    });

    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: { $ne: 'banned' } }).select('_id');
    await notifyMany(admins.map((admin) => ({
      recipient: admin._id,
      actor: req.user._id,
      type: 'project',
      title: 'New student project submitted',
      message: title,
      link: '/dashboard?view=student-projects',
    })));

    if (project.supervisor) {
      await createNotification({
        recipient: project.supervisor,
        actor: req.user._id,
        type: 'project',
        title: 'Student project awaiting validation',
        message: title,
        link: '/dashboard?view=student-projects',
      });
    }

    res.status(201).json(await populateProject(StudentProject.findById(project._id)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const validateProject = async (req, res) => {
  try {
    const { action, feedback, startDate, endDate } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }

    const project = await StudentProject.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Student project not found.' });

    project.status = action === 'approve' ? 'approved' : 'rejected';
    project.validationFeedback = feedback || '';
    project.validatedBy = req.user._id;
    project.validatedAt = new Date();
    project.startDate = parseDate(startDate) || project.startDate || new Date();
    project.endDate = parseDate(endDate) || project.endDate;

    if (action === 'approve') {
      project.timeline = buildSchoolTimeline(project.startDate, project.endDate);
    }

    await project.save();

    await createNotification({
      recipient: project.student,
      actor: req.user._id,
      type: 'project',
      title: action === 'approve' ? 'Project validated' : 'Project needs revision',
      message: feedback || project.title,
      link: '/dashboard?view=student-projects',
    });

    res.json(await populateProject(StudentProject.findById(project._id)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTimelineItem = async (req, res) => {
  try {
    const project = await StudentProject.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Student project not found.' });
    if (!canViewProject(project, req.user)) {
      return res.status(403).json({ message: 'You are not authorized to update this project.' });
    }

    const item = project.timeline.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Timeline item not found.' });

    const { status, notes } = req.body;
    if (status && !['pending', 'in_progress', 'submitted', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid timeline status.' });
    }

    if (status) item.status = status;
    if (notes !== undefined) item.notes = notes;
    if (status === 'completed') item.completedAt = new Date();
    if (status && status !== 'completed') item.completedAt = undefined;

    const completed = project.timeline.length && project.timeline.every((step) => step.status === 'completed');
    if (completed) project.status = 'completed';
    else if (project.status === 'approved' && project.timeline.some((step) => step.status !== 'pending')) project.status = 'in_progress';

    await project.save();
    res.json(await populateProject(StudentProject.findById(project._id)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listProjects,
  getProject,
  createProject,
  validateProject,
  updateTimelineItem,
};
