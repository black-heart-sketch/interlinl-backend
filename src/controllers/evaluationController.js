const Evaluation = require('../models/Evaluation');
const Internship = require('../models/Internship');
const { createNotification } = require('../services/notificationService');

const normalizeRole = (role) => String(role || '').toLowerCase();

const getEvaluations = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const filter = {};
    if (role === 'student') filter.intern = req.user._id;
    if (role === 'supervisor' || role === 'teacher' || role === 'advisor') filter.supervisor = req.user._id;
    if (req.query.internId) filter.intern = req.query.internId;

    const evaluations = await Evaluation.find(filter)
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });
    res.json(evaluations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEvaluationByIntern = async (req, res) => {
  try {
    const evaluations = await Evaluation.find({ intern: req.params.internId })
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });
    res.json(evaluations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createEvaluation = async (req, res) => {
  try {
    const { internId, punctuality, taskCompletion, communication, technicalSkills, creativity, discipline, feedback = '', status = 'submitted' } = req.body;
    if (!internId) return res.status(400).json({ message: 'internId is required.' });

    const internship = await Internship.findOne({ student: internId, status: 'active' });
    const evaluation = new Evaluation({
      intern: internId,
      supervisor: req.user._id,
      internship: internship?._id,
      punctuality,
      taskCompletion,
      communication,
      technicalSkills,
      creativity,
      discipline,
      feedback,
      status,
    });
    await evaluation.save();

    if (internship) {
      internship.supervisorRating = Number(((evaluation.totalScore / 100) * 5).toFixed(1));
      await internship.save();
    }

    await createNotification({
      recipient: internId,
      actor: req.user._id,
      type: 'feedback',
      title: 'New evaluation submitted',
      message: `Your supervisor submitted an evaluation with a total score of ${evaluation.totalScore}%.`,
      link: '/dashboard?view=evaluations',
    });

    res.status(201).json(evaluation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const aiAnalysis = async (req, res) => {
  try {
    const { evaluationId, scores = {}, feedback = '' } = req.body;
    const evaluation = evaluationId ? await Evaluation.findById(evaluationId) : null;
    const data = evaluation || scores;
    const total = evaluation?.totalScore || Math.round(
      ['punctuality', 'taskCompletion', 'communication', 'technicalSkills', 'creativity', 'discipline']
        .reduce((sum, key) => sum + Number(data[key] || 0), 0) / 6
    );
    const analysis = {
      totalScore: total,
      level: total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 55 ? 'developing' : 'at_risk',
      strengths: total >= 70 ? ['Consistent internship performance', 'Good completion trajectory'] : ['Shows areas of emerging competence'],
      improvements: total < 85 ? ['Increase consistency in deliverables', 'Request more frequent supervisor feedback'] : ['Prepare portfolio evidence for final certification'],
      summary: `Evaluation score is ${total}%. ${feedback ? `Supervisor note: ${feedback}` : 'No additional feedback was provided.'}`,
    };

    if (evaluation) {
      evaluation.aiAnalysis = analysis;
      await evaluation.save();
    }
    res.json({ source: 'fallback', result: analysis });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createEvaluation, getEvaluations, getEvaluationByIntern, aiAnalysis };
