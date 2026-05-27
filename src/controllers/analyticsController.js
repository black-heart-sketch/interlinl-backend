const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const Evaluation = require('../models/Evaluation');
const Internship = require('../models/Internship');
const Report = require('../models/Report');
const Task = require('../models/Task');

const getAnalytics = async (req, res) => {
  try {
    const [internships, tasks, attendance, reports, evaluations, certificates] = await Promise.all([
      Internship.find().populate('student', 'firstName lastName email department'),
      Task.find(),
      Attendance.find(),
      Report.find(),
      Evaluation.find().populate('intern', 'firstName lastName email department'),
      Certificate.find(),
    ]);
    const byDepartment = {};
    internships.forEach((item) => { byDepartment[item.department] = (byDepartment[item.department] || 0) + 1; });
    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const attended = attendance.filter((row) => ['present', 'late', 'excused'].includes(row.status)).length;
    const submittedReports = reports.length;
    res.json({
      internsPerDepartment: Object.entries(byDepartment).map(([department, count]) => ({ department, count })),
      taskCompletionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
      attendanceRate: attendance.length ? Math.round((attended / attendance.length) * 100) : 0,
      reportSubmissionRate: internships.length ? Math.round((submittedReports / Math.max(internships.length, 1)) * 100) : 0,
      performanceScorePerIntern: evaluations.map((row) => ({ intern: `${row.intern?.firstName || ''} ${row.intern?.lastName || ''}`.trim() || row.intern?.email, score: row.totalScore })),
      internshipCompletionRate: internships.length ? Math.round((internships.filter((item) => item.status === 'completed').length / internships.length) * 100) : 0,
      certificatesGenerated: certificates.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const internId = req.params.internId || req.user._id;
    const [internship, tasks, reports, evaluations, certificates] = await Promise.all([
      Internship.findOne({ student: internId }).populate('student supervisor', 'firstName lastName email avatar department'),
      Task.find({ intern: internId, status: 'completed' }),
      Report.find({ intern: internId }).sort({ createdAt: -1 }).limit(8),
      Evaluation.find({ intern: internId }).sort({ createdAt: -1 }),
      Certificate.find({ intern: internId }).sort({ createdAt: -1 }),
    ]);
    res.json({
      profile: internship?.student,
      department: internship?.department,
      completedTasks: tasks,
      projects: tasks.map((task) => ({ title: task.title, description: task.description, score: task.score })),
      reportsSummary: reports.map((report) => ({ title: report.title, type: report.type, status: report.status, score: report.score })),
      skills: evaluations[0] ? {
        punctuality: evaluations[0].punctuality,
        taskCompletion: evaluations[0].taskCompletion,
        communication: evaluations[0].communication,
        technicalSkills: evaluations[0].technicalSkills,
        creativity: evaluations[0].creativity,
        discipline: evaluations[0].discipline,
      } : {},
      supervisorFeedback: evaluations.map((evaluation) => evaluation.feedback).filter(Boolean),
      aiCompetencyAnalysis: evaluations[0]?.aiAnalysis || null,
      certificate: certificates[0] || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAnalytics, getPortfolio };
