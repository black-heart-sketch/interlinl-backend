const aiService = require('../services/aiService');
const AIInteraction = require('../models/AIInteraction');
const Attendance = require('../models/Attendance');
const Internship = require('../models/Internship');
const Report = require('../models/Report');
const Task = require('../models/Task');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

const extractJson = (raw) => {
  const cleaned = String(raw || '').replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObject = cleaned.indexOf('{');
    const lastObject = cleaned.lastIndexOf('}');
    if (firstObject >= 0 && lastObject > firstObject) return JSON.parse(cleaned.slice(firstObject, lastObject + 1));
    const firstArray = cleaned.indexOf('[');
    const lastArray = cleaned.lastIndexOf(']');
    if (firstArray >= 0 && lastArray > firstArray) return JSON.parse(cleaned.slice(firstArray, lastArray + 1));
    throw new Error('AI response was not valid JSON.');
  }
};

const callAiJson = async ({ prompt, fallback, feature, user, maxOutputTokens = 1600 }) => {
  let provider = 'fallback';
  let status = 'fallback';
  let response = fallback;
  let error = '';

  try {
    const { text, provider: usedProvider } = await aiService.generateText({
      prompt,
      maxOutputTokens,
      temperature: 0.25,
      jsonMode: true
    });
    response = extractJson(text);
    provider = usedProvider;
    status = 'success';
  } catch (err) {
    error = err.message;
    console.warn(`InterLink AI fallback used for ${feature}:`, error);
  }

  await AIInteraction.create({
    user: user?._id,
    feature,
    provider,
    status,
    prompt,
    response,
    error,
  }).catch(() => {});

  return { source: status === 'success' ? provider : 'fallback', result: response };
};

const reportFallback = ({ type = 'daily', notes = '', achievements = '', blockers = '', nextSteps = '' }) => ({
  title: `${type[0].toUpperCase()}${type.slice(1)} Internship Report`,
  content: [notes || 'I worked on assigned internship activities and documented the results.', achievements ? `Achievements: ${achievements}` : ''].filter(Boolean).join('\n\n'),
  challenges: blockers || 'No major blockers were recorded.',
  nextSteps: nextSteps || 'Continue assigned work, request feedback, and prepare the next progress update.',
});

const generateReport = async (req, res) => {
  const payload = req.body || {};
  const prompt = `
You are InterLink's internship report assistant. Return JSON only with title, content, challenges, nextSteps.
Use a professional internship tone and do not invent facts beyond the notes.
Report type: ${payload.type || 'daily'}
Notes: ${payload.notes || ''}
Achievements: ${payload.achievements || ''}
Blockers: ${payload.blockers || ''}
Next steps: ${payload.nextSteps || ''}
`;
  const data = await callAiJson({ prompt, fallback: reportFallback(payload), feature: 'generate-report', user: req.user });
  res.json(data);
};

const reviewReport = async (req, res) => {
  const { title = '', content = '', challenges = '', nextSteps = '' } = req.body || {};
  const fallback = {
    score: content.length > 300 ? 82 : 68,
    recommendation: content.length > 300 ? 'reviewed' : 'needs_revision',
    strengths: ['The report identifies completed work and next actions.'],
    improvements: ['Add measurable outcomes, links to deliverables, and clearer blockers.'],
    feedback: 'Good start. Strengthen the report with concrete evidence, dates, and specific technical details.',
  };
  const prompt = `
You are an internship supervisor assistant. Return JSON only with score (0-100), recommendation, strengths array, improvements array, feedback.
Evaluate clarity, specificity, professionalism, and evidence.
Title: ${title}
Content: ${content}
Challenges: ${challenges}
Next steps: ${nextSteps}
`;
  const data = await callAiJson({ prompt, fallback, feature: 'review-report', user: req.user });
  res.json(data);
};

const taskSuggestions = async (req, res) => {
  const internId = req.body?.internId;
  const intern = internId ? await User.findById(internId).select('firstName lastName email department') : null;
  const tasks = internId ? await Task.find({ intern: internId }).sort({ createdAt: -1 }).limit(8) : [];
  const fallback = {
    suggestions: [
      { title: 'Document today’s implementation progress', priority: 'medium', description: 'Create a concise technical note with blockers, test results, and next actions.' },
      { title: 'Review one existing feature for UX polish', priority: 'low', description: 'Identify small improvements and submit a short recommendation list.' },
      { title: 'Prepare a supervisor demo checkpoint', priority: 'medium', description: 'Package current work into a demo-ready state with clear acceptance criteria.' },
    ],
  };
  const prompt = `
Return JSON only: { "suggestions": [{ "title", "description", "priority", "deadlineHint" }] }.
Suggest practical internship tasks for this InterLink intern.
Intern: ${intern ? JSON.stringify(intern) : 'not specified'}
Recent tasks: ${JSON.stringify(tasks.map((task) => ({ title: task.title, status: task.status, priority: task.priority })))}
Supervisor context: ${req.body?.context || ''}
`;
  const data = await callAiJson({ prompt, fallback, feature: 'task-suggestions', user: req.user });
  res.json(data);
};

const buildPerformance = async (internId) => {
  const internship = await Internship.findOne({ student: internId }).populate('student supervisor', 'firstName lastName email department');
  const [tasks, reports, attendance] = await Promise.all([
    Task.find({ intern: internId }),
    Report.find({ intern: internId }),
    Attendance.find({ intern: internId }).sort({ date: -1 }).limit(30),
  ]);
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const pendingReports = reports.filter((report) => report.status === 'pending').length;
  const rejectedReports = reports.filter((report) => report.status === 'rejected').length;
  const attendanceRate = internship?.attendanceRate ?? 0;
  const progress = internship?.progress ?? 0;
  const risks = [
    attendanceRate < 75 ? 'low_attendance' : null,
    progress < 35 && tasks.length > 3 ? 'low_progress' : null,
    pendingReports > 3 ? 'report_backlog' : null,
    rejectedReports > 1 ? 'quality_concern' : null,
  ].filter(Boolean);

  return {
    internship,
    metrics: { totalTasks: tasks.length, completedTasks, totalReports: reports.length, pendingReports, rejectedReports, attendanceRate, progress },
    attendance: attendance.map((row) => ({ date: row.date, status: row.status })),
    risks,
  };
};

const performanceAnalysis = async (req, res) => {
  const internId = req.body?.internId || req.query?.internId || req.user._id;
  const context = await buildPerformance(internId);
  const fallback = {
    summary: `Progress is ${context.metrics.progress}% with ${context.metrics.attendanceRate}% attendance.`,
    risks: context.risks,
    recommendations: context.risks.length ? ['Schedule a supervisor check-in.', 'Set smaller weekly deliverables.', 'Review recent reports for feedback patterns.'] : ['Maintain current cadence and keep reports evidence-based.'],
    metrics: context.metrics,
  };
  const prompt = `
Return JSON only with summary, risks array, recommendations array, metrics object.
Analyze this internship performance data for InterLink.
Data: ${JSON.stringify({ metrics: context.metrics, risks: context.risks, attendance: context.attendance })}
`;
  const data = await callAiJson({ prompt, fallback, feature: 'performance-analysis', user: req.user });

  if (context.risks.length && context.internship?.supervisor) {
    await createNotification({
      recipient: context.internship.supervisor,
      actor: req.user._id,
      type: 'ai-risk',
      title: 'AI risk alert',
      message: `Risk flags detected: ${context.risks.join(', ')}`,
      link: '/dashboard?view=attendance',
    }).catch(() => {});
  }

  res.json(data);
};

const finalSummary = async (req, res) => {
  const internId = req.body?.internId || req.user._id;
  const context = await buildPerformance(internId);
  const reports = await Report.find({ intern: internId }).sort({ createdAt: -1 }).limit(10);
  const fallback = {
    summary: `The intern completed ${context.metrics.completedTasks} tasks with ${context.metrics.attendanceRate}% attendance and ${context.metrics.progress}% overall progress.`,
    achievements: reports.slice(0, 3).map((report) => report.title),
    recommendation: context.risks.length ? 'Completion with additional supervisor review recommended.' : 'Completion recommended.',
  };
  const prompt = `
Return JSON only with summary, achievements array, recommendation, certificateParagraph.
Prepare a final internship summary using this data: ${JSON.stringify({ metrics: context.metrics, reports: reports.map((report) => ({ title: report.title, score: report.score, status: report.status })) })}
`;
  const data = await callAiJson({ prompt, fallback, feature: 'final-summary', user: req.user, maxOutputTokens: 2200 });
  res.json(data);
};

const chat = async (req, res) => {
  const message = req.body?.message || '';
  if (!message.trim()) return res.status(400).json({ message: 'message is required.' });
  const fallback = {
    reply: 'I can help with reports, task planning, internship progress, and supervisor feedback. Share your goal or paste your draft and I will help you improve it.',
    actions: ['draft_report', 'review_report', 'suggest_tasks'],
  };
  const prompt = `
You are the InterLink internship AI assistant. Return JSON only with reply and actions array.
Stay within internship support: reports, tasks, progress, attendance, messaging etiquette, and preparation.
Do not provide legal/medical/financial advice. Escalate serious workplace or safety concerns to a human supervisor/admin.
User role: ${req.user.role}
Message: ${message}
History: ${JSON.stringify(req.body?.history || [])}
`;
  const data = await callAiJson({ prompt, fallback, feature: 'chat', user: req.user });
  res.json(data);
};

module.exports = { generateReport, reviewReport, taskSuggestions, performanceAnalysis, finalSummary, chat };
