const Report = require('../models/Report');
const Internship = require('../models/Internship');
const { moveFile } = require('../middleware/multer');
const { GoogleGenAI } = require('@google/genai');
const { createNotification } = require('../services/notificationService');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalizeRole = (role) => String(role || '').toLowerCase();
const PRIVILEGED_ROLES = ['admin', 'superadmin', 'manager'];

const getUserNameFields = 'firstName lastName email avatar department role';

const parseDate = (value) => (value ? new Date(value) : null);

const safeNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isReportOwner = (report, userId) => String(report.intern) === String(userId);

const canViewReport = (report, user) => {
  const role = normalizeRole(user.role);
  return (
    PRIVILEGED_ROLES.includes(role) ||
    isReportOwner(report, user._id) ||
    String(report.supervisor || '') === String(user._id)
  );
};

const buildAttachmentPayload = async (processedFiles = []) => {
  const files = Array.isArray(processedFiles) ? processedFiles : [];
  const finalDir = path.join(__dirname, '../assets/documents/reports');
  const attachments = [];

  for (const file of files.filter((item) => item.fieldName === 'attachments')) {
    const finalPath = path.join(finalDir, file.fileName);
    await moveFile(file.path, finalPath);

    let thumbnailUrl = '';
    if (file.thumbnailPath && file.thumbnailFilename) {
      const finalThumbPath = path.join(finalDir, file.thumbnailFilename);
      await moveFile(file.thumbnailPath, finalThumbPath);
      thumbnailUrl = `/assets/documents/reports/${file.thumbnailFilename}`;
    }

    attachments.push({
      name: file.originalName || file.fileName,
      url: `/assets/documents/reports/${file.fileName}`,
      type: file.type || 'file',
      size: file.fileSize || 0,
      thumbnailUrl,
    });
  }

  return attachments;
};

const getGeminiText = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.35,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
    },
  });

  return response.text || null;
};

const extractJson = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  }
  return null;
};

const fallbackAiReport = ({ type, notes, achievements, blockers, nextSteps }) => ({
  title: `${String(type || 'daily').replace(/^\w/, (c) => c.toUpperCase())} Internship Report`,
  content: [
    notes || 'Today I worked on my assigned internship activities and documented the main outcomes.',
    achievements ? `Key achievements: ${achievements}` : '',
  ].filter(Boolean).join('\n\n'),
  challenges: blockers || 'No major blockers were encountered during this reporting period.',
  nextSteps: nextSteps || 'Continue with the next assigned activities and request support where needed.',
});

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
      .populate('intern', getUserNameFields)
      .populate('supervisor', getUserNameFields)
      .populate('reviewedBy', 'firstName lastName email')
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
      .populate('intern', getUserNameFields)
      .populate('supervisor', getUserNameFields)
      .populate('reviewedBy', 'firstName lastName email');

    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!canViewReport(report, req.user)) {
      return res.status(403).json({ message: 'You are not authorized to view this report.' });
    }
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

    if (!['daily', 'weekly', 'final'].includes(type)) {
      return res.status(400).json({ message: 'Report type must be daily, weekly, or final.' });
    }

    // Infer supervisor from active internship if not provided
    let supervisorId = req.body.supervisorId || null;
    if (!supervisorId) {
      const internship = await Internship.findOne({ student: req.user._id, status: 'active' });
      if (internship) supervisorId = internship.supervisor;
    }

    const attachments = await buildAttachmentPayload(req.processedFiles);

    const report = await Report.create({
      intern: req.user._id,
      supervisor: supervisorId,
      type,
      title,
      content,
      challenges: challenges || '',
      nextSteps: nextSteps || '',
      attachmentUrl: attachmentUrl || '',
      attachments,
      periodStart: parseDate(periodStart),
      periodEnd: parseDate(periodEnd),
      week: safeNumber(week),
      status: 'pending',
    });

    if (supervisorId) {
      await createNotification({
        recipient: supervisorId,
        actor: req.user._id,
        type: 'report',
        title: 'New report submitted',
        message: title,
        link: '/dashboard?view=reports',
      });
    }

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
    if (periodStart !== undefined) report.periodStart = parseDate(periodStart);
    if (periodEnd !== undefined) report.periodEnd = parseDate(periodEnd);
    if (week !== undefined) report.week = safeNumber(week);

    const attachments = await buildAttachmentPayload(req.processedFiles);
    if (attachments.length > 0) {
      report.attachments = [...(report.attachments || []), ...attachments];
    }

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
    const { score, feedback, action } = req.body; // action: 'approve' | 'reject' | 'review'

    if (!action || !['approve', 'reject', 'review'].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve', 'reject', or 'review'." });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const role = normalizeRole(req.user.role);
    const isAssignedSupervisor = String(report.supervisor || '') === String(req.user._id);
    const canClaimUnassignedReport = !report.supervisor && ['supervisor', 'teacher', 'advisor'].includes(role);
    if (!PRIVILEGED_ROLES.includes(role) && !isAssignedSupervisor && !canClaimUnassignedReport) {
      return res.status(403).json({ message: 'Only the assigned supervisor or an admin can review this report.' });
    }

    report.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'reviewed';
    report.feedback = feedback || '';
    if (score !== undefined) report.score = safeNumber(score, report.score);
    if (!report.supervisor) report.supervisor = req.user._id;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    await report.save();

    await createNotification({
      recipient: report.intern,
      actor: req.user._id,
      type: 'feedback',
      title: `Report ${report.status}`,
      message: report.feedback || `Your report was marked ${report.status}.`,
      link: '/dashboard?view=reports',
    });

    res.json({ message: `Report ${report.status}.`, report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/reports/generate-ai ─────────────────────────────────────────────
const generateAiReport = async (req, res) => {
  try {
    const {
      type = 'daily',
      notes = '',
      achievements = '',
      blockers = '',
      nextSteps = '',
      tone = 'professional',
    } = req.body;

    if (!['daily', 'weekly', 'final'].includes(type)) {
      return res.status(400).json({ message: 'Report type must be daily, weekly, or final.' });
    }

    const prompt = `
Generate an internship ${type} report for the InterLink platform.
Return strict JSON with title, content, challenges, and nextSteps fields only.
Tone: ${tone}.
Raw notes: ${notes || 'Not provided'}.
Achievements: ${achievements || 'Not provided'}.
Blockers: ${blockers || 'Not provided'}.
Planned next steps: ${nextSteps || 'Not provided'}.
Keep it concise, professional, and suitable for supervisor review.
`;

    let generated = null;
    try {
      generated = extractJson(await getGeminiText(prompt));
    } catch (error) {
      console.warn('AI report generation fallback used:', error.message);
    }

    res.json({
      source: generated ? 'ai' : 'fallback',
      report: generated || fallbackAiReport({ type, notes, achievements, blockers, nextSteps }),
    });
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
  generateAiReport,
  deleteReport,
};
