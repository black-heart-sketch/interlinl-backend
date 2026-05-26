const Report = require('../models/Report');
const Internship = require('../models/Internship');

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalizeRole = (role) => String(role || '').toLowerCase();

// ── GET /api/reports ──────────────────────────────────────────────────────────
const getReports = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const filter = {};

    if (role === 'student') {
      filter.intern = req.user._id;
    } else if (role === 'supervisor' || role === 'teacher' || role === 'advisor') {
      filter.supervisor = req.user._id;
    }
    // admin / superadmin / manager see all reports (no filter)

    // Optional query filters
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.internId) filter.intern = req.query.internId;

    const reports = await Report.find(filter)
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email');

    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/reports ─────────────────────────────────────────────────────────
const createReport = async (req, res) => {
  try {
    const { type, title, content, challenges, nextSteps, attachmentUrl, periodStart, periodEnd, week } = req.body;

    if (!type || !title || !content) {
      return res.status(400).json({ message: 'Type, title, and content are required.' });
    }

    // Infer supervisor from active internship if not provided
    let supervisorId = req.body.supervisorId || null;
    if (!supervisorId) {
      const internship = await Internship.findOne({ student: req.user._id });
      if (internship) supervisorId = internship.supervisor;
    }

    const report = await Report.create({
      intern: req.user._id,
      supervisor: supervisorId,
      type,
      title,
      content,
      challenges: challenges || '',
      nextSteps: nextSteps || '',
      attachmentUrl: attachmentUrl || '',
      periodStart: periodStart ? new Date(periodStart) : null,
      periodEnd: periodEnd ? new Date(periodEnd) : null,
      week: week || null,
      status: 'pending',
    });

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PATCH /api/reports/:id ────────────────────────────────────────────────────
// Student updates their own pending report before it is reviewed
const updateReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (String(report.intern) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only edit your own reports.' });
    }
    if (report.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending reports can be edited.' });
    }

    const { title, content, challenges, nextSteps, attachmentUrl, periodStart, periodEnd, week } = req.body;
    if (title !== undefined) report.title = title;
    if (content !== undefined) report.content = content;
    if (challenges !== undefined) report.challenges = challenges;
    if (nextSteps !== undefined) report.nextSteps = nextSteps;
    if (attachmentUrl !== undefined) report.attachmentUrl = attachmentUrl;
    if (periodStart !== undefined) report.periodStart = periodStart ? new Date(periodStart) : null;
    if (periodEnd !== undefined) report.periodEnd = periodEnd ? new Date(periodEnd) : null;
    if (week !== undefined) report.week = week || null;

    await report.save();
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PATCH /api/reports/:id/review ─────────────────────────────────────────────
// Supervisor scores and approves or rejects a report
const reviewReport = async (req, res) => {
  try {
    const { score, feedback, action } = req.body; // action: 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    report.status = action === 'approve' ? 'approved' : 'rejected';
    report.feedback = feedback || '';
    if (score !== undefined) report.score = Number(score);
    if (!report.supervisor) report.supervisor = req.user._id;

    await report.save();

    res.json({ message: `Report ${report.status}.`, report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/reports/:id ───────────────────────────────────────────────────
const deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const role = normalizeRole(req.user.role);
    const isOwner = String(report.intern) === String(req.user._id);
    const isPrivileged = ['admin', 'superadmin', 'manager'].includes(role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'Not authorised to delete this report.' });
    }
    if (isOwner && report.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending reports can be deleted by the intern.' });
    }

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReports,
  getReportById,
  createReport,
  updateReport,
  reviewReport,
  deleteReport,
};
