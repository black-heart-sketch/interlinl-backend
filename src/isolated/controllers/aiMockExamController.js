const ExamBlueprint = require('../models/ExamBlueprint');
const GeneratedMockExam = require('../models/GeneratedMockExam');
const AIExamSession = require('../models/AIExamSession');
const AIExamAttempt = require('../models/AIExamAttempt');
const ExamCorrection = require('../models/ExamCorrection');
const User = require('../models/User');
const { correctMockExamAttempt, generateMockExam, regenerateMockExamSection } = require('../services/aiExamService');

const staffRoles = ['admin', 'superadmin', 'teacher', 'advisor'];

const isStaff = (user) => staffRoles.includes(String(user?.role || '').toLowerCase());

const logAIExamController = (step, meta = {}) => {
  console.log(`[AI Exam Controller] ${step}`, {
    timestamp: new Date().toISOString(),
    ...meta
  });
};

const logAIExamControllerError = (step, error, meta = {}) => {
  console.error(`[AI Exam Controller] ${step}`, {
    timestamp: new Date().toISOString(),
    message: error?.message,
    code: error?.code || error?.cause?.code,
    stack: error?.stack,
    ...meta
  });
};

const sanitizeGeneratedExam = (exam) => {
  const doc = typeof exam.toObject === 'function' ? exam.toObject() : { ...exam };
  doc.sections = (doc.sections || []).map((section) => {
    const { answerKey, rubric, ...safeSection } = section;
    return {
      ...safeSection,
      rubric: section.type === 'writing' || section.type === 'speaking' ? rubric : undefined
    };
  });
  return doc;
};

const studentCanAccessSession = (session, user) => {
  if (isStaff(user)) return true;
  if (!session || !user) return false;

  if (session.accessMode === 'selected_students') {
    return (session.eligibleStudents || []).some((id) => String(id) === String(user._id));
  }

  const sameLanguage = user.studyLanguage && String(user.studyLanguage) === String(session.studyLanguage);
  if (!sameLanguage) return false;

  if (session.accessMode === 'language_all_levels') return true;
  return user.registeredLevel === session.level;
};

exports.createBlueprint = async (req, res) => {
  try {
    const blueprint = await ExamBlueprint.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    res.status(201).json(blueprint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getBlueprints = async (req, res) => {
  try {
    const filter = {};
    if (req.query.studyLanguage) filter.studyLanguage = req.query.studyLanguage;
    if (req.query.examFamily) filter.examFamily = req.query.examFamily;
    if (req.query.level) filter.level = req.query.level;
    if (req.query.status) filter.status = req.query.status;

    const blueprints = await ExamBlueprint.find(filter)
      .populate('studyLanguage', 'name code')
      .sort({ createdAt: -1 });
    res.status(200).json(blueprints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBlueprint = async (req, res) => {
  try {
    const blueprint = await ExamBlueprint.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!blueprint) return res.status(404).json({ message: 'Exam blueprint not found.' });
    res.status(200).json(blueprint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.generateExam = async (req, res) => {
  try {
    const { blueprintId, adminPrompt = '' } = req.body;
    logAIExamController('Generate exam request received', {
      blueprintId,
      userId: req.user?._id,
      userRole: req.user?.role,
      hasAdminPrompt: Boolean(adminPrompt),
      adminPromptLength: adminPrompt.length
    });

    logAIExamController('Looking up exam blueprint', { blueprintId });
    const blueprint = await ExamBlueprint.findById(blueprintId).populate('studyLanguage', 'name code');
    if (!blueprint) {
      logAIExamController('Exam blueprint not found', { blueprintId });
      return res.status(404).json({ message: 'Exam blueprint not found.' });
    }

    logAIExamController('Exam blueprint loaded', {
      blueprintId: blueprint._id,
      title: blueprint.title,
      examFamily: blueprint.examFamily,
      level: blueprint.level,
      studyLanguage: blueprint.studyLanguage?.name || blueprint.languageName,
      sectionCount: blueprint.sections?.length || 0
    });

    const generated = await generateMockExam({
      blueprint: {
        ...blueprint.toObject(),
        languageName: blueprint.studyLanguage?.name || blueprint.languageName
      },
      adminPrompt
    });

    logAIExamController('Generated mock exam payload ready', {
      title: generated.title,
      instructionLength: generated.instructions?.length || 0,
      sectionCount: generated.sections?.length || 0
    });

    logAIExamController('Saving generated mock exam', {
      blueprintId: blueprint._id,
      studyLanguageId: blueprint.studyLanguage?._id || blueprint.studyLanguage,
      generatedBy: req.user._id
    });

    const mockExam = await GeneratedMockExam.create({
      blueprint: blueprint._id,
      studyLanguage: blueprint.studyLanguage?._id || blueprint.studyLanguage,
      examFamily: blueprint.examFamily,
      level: blueprint.level,
      title: generated.title,
      instructions: generated.instructions,
      sections: generated.sections,
      generatedBy: req.user._id,
      aiPrompt: adminPrompt
    });

    logAIExamController('Generated mock exam saved', {
      mockExamId: mockExam._id,
      title: mockExam.title,
      status: mockExam.status
    });

    res.status(201).json(mockExam);
  } catch (error) {
    logAIExamControllerError('Generate exam failed', error, {
      blueprintId: req.body?.blueprintId,
      userId: req.user?._id
    });
    res.status(500).json({ message: error.message || 'Unable to generate AI mock exam.' });
  }
};

exports.getGeneratedExams = async (req, res) => {
  try {
    const exams = await GeneratedMockExam.find(req.query.status ? { status: req.query.status } : {})
      .populate('studyLanguage', 'name code')
      .populate('blueprint', 'title examFamily level')
      .sort({ createdAt: -1 });
    res.status(200).json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGeneratedExam = async (req, res) => {
  try {
    const exam = await GeneratedMockExam.findById(req.params.examId || req.params.id)
      .populate('studyLanguage', 'name code')
      .populate('blueprint');
    if (!exam) return res.status(404).json({ message: 'Generated mock exam not found.' });

    res.status(200).json(isStaff(req.user) ? exam : sanitizeGeneratedExam(exam));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveGeneratedExam = async (req, res) => {
  try {
    const exam = await GeneratedMockExam.findByIdAndUpdate(
      req.params.examId || req.params.id,
      { status: 'approved', approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    );
    if (!exam) return res.status(404).json({ message: 'Generated mock exam not found.' });
    res.status(200).json(exam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.regenerateSection = async (req, res) => {
  try {
    const exam = await GeneratedMockExam.findById(req.params.examId || req.params.id).populate('blueprint');
    if (!exam) return res.status(404).json({ message: 'Generated mock exam not found.' });
    if (exam.status === 'approved') {
      return res.status(400).json({ message: 'Approved exams cannot be regenerated. Archive it and create a new version.' });
    }

    const sectionKey = req.params.sectionKey;
    const regeneratedSection = await regenerateMockExamSection({
      generatedExam: exam.toObject(),
      blueprint: exam.blueprint.toObject(),
      sectionKey,
      adminPrompt: req.body.adminPrompt || ''
    });

    const sectionIndex = (exam.sections || []).findIndex((section) => section.key === sectionKey);
    if (sectionIndex === -1) {
      exam.sections.push(regeneratedSection);
    } else {
      exam.sections.set(sectionIndex, regeneratedSection);
    }

    await exam.save();
    res.status(200).json(exam);
  } catch (error) {
    console.error('AI section regeneration error:', error);
    res.status(500).json({ message: error.message || 'Unable to regenerate section.' });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { generatedExamId, mockExamId, startsAt, endsAt, title, accessMode, eligibleStudents = [] } = req.body;
    const generatedExam = await GeneratedMockExam.findById(generatedExamId || mockExamId);
    if (!generatedExam) return res.status(404).json({ message: 'Generated mock exam not found.' });
    if (generatedExam.status !== 'approved') return res.status(400).json({ message: 'Approve the generated exam before scheduling.' });
    if (new Date(endsAt) <= new Date(startsAt)) return res.status(400).json({ message: 'End time must be after start time.' });

    const session = await AIExamSession.create({
      generatedExam: generatedExam._id,
      studyLanguage: generatedExam.studyLanguage,
      examFamily: generatedExam.examFamily,
      level: generatedExam.level,
      title: title || generatedExam.title,
      startsAt,
      endsAt,
      accessMode,
      eligibleStudents,
      status: 'scheduled',
      allowLateJoin: req.body.allowLateJoin,
      strictSectionOrder: req.body.strictSectionOrder,
      noRetake: req.body.noRetake,
      autoSubmitAtClose: req.body.autoSubmitAtClose,
      speakingUploadRequired: req.body.speakingUploadRequired,
      antiCheatEnabled: req.body.antiCheatEnabled,
      resultReleaseMode: req.body.resultReleaseMode,
      createdBy: req.user._id
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.scheduleSession = async (req, res) => {
  try {
    const { startsAt, endsAt } = req.body;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }

    const session = await AIExamSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });
    if (!['draft', 'scheduled'].includes(session.status)) {
      return res.status(400).json({ message: 'Only draft or scheduled sessions can be scheduled.' });
    }

    const fields = [
      'title',
      'startsAt',
      'endsAt',
      'accessMode',
      'eligibleStudents',
      'allowLateJoin',
      'strictSectionOrder',
      'noRetake',
      'autoSubmitAtClose',
      'speakingUploadRequired',
      'antiCheatEnabled',
      'resultReleaseMode'
    ];

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) session[field] = req.body[field];
    });
    session.status = 'scheduled';
    await session.save();

    res.status(200).json(session);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.studyLanguage) filter.studyLanguage = req.query.studyLanguage;

    if (!isStaff(req.user)) {
      const user = await User.findById(req.user._id);
      filter.status = { $in: ['scheduled', 'open', 'results_released'] };
      filter.$or = [
        { accessMode: 'language_all_levels', studyLanguage: user.studyLanguage },
        { accessMode: 'language_level', studyLanguage: user.studyLanguage, level: user.registeredLevel },
        { accessMode: 'selected_students', eligibleStudents: user._id }
      ];
    }

    const sessions = await AIExamSession.find(filter)
      .populate('studyLanguage', 'name code')
      .populate('generatedExam', 'title')
      .sort({ startsAt: -1 });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAvailableSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();

    const sessions = await AIExamSession.find({
      status: { $in: ['scheduled', 'open'] },
      $or: [
        { accessMode: 'language_all_levels', studyLanguage: user.studyLanguage },
        { accessMode: 'language_level', studyLanguage: user.studyLanguage, level: user.registeredLevel },
        { accessMode: 'selected_students', eligibleStudents: user._id }
      ]
    })
      .populate('studyLanguage', 'name code')
      .populate('generatedExam', 'title instructions')
      .sort({ startsAt: 1 });

    const attempts = await AIExamAttempt.find({
      student: user._id,
      session: { $in: sessions.map((session) => session._id) }
    }).select('session status submittedAt');
    const attemptsBySession = new Map(attempts.map((attempt) => [String(attempt.session), attempt]));

    res.status(200).json(sessions.map((session) => {
      const attempt = attemptsBySession.get(String(session._id));
      const canStart = session.status === 'open'
        && now >= session.startsAt
        && now <= session.endsAt
        && (!attempt || attempt.status === 'in_progress');

      return {
        ...session.toObject(),
        attemptStatus: attempt?.status || null,
        canStart
      };
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.launchSession = async (req, res) => {
  try {
    const existingSession = await AIExamSession.findById(req.params.id);
    if (!existingSession) return res.status(404).json({ message: 'Exam session not found.' });
    if (!['scheduled', 'open'].includes(existingSession.status)) {
      return res.status(400).json({ message: 'Only scheduled sessions can be launched.' });
    }

    const session = await AIExamSession.findByIdAndUpdate(
      req.params.id,
      { status: 'open', launchedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });
    res.status(200).json(session);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.closeSession = async (req, res) => {
  try {
    const session = await AIExamSession.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', closedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });

    if (session.autoSubmitAtClose) {
      await AIExamAttempt.updateMany(
        { session: session._id, status: 'in_progress' },
        { status: 'submitted', submittedAt: new Date() }
      );
    }

    res.status(200).json(session);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.releaseResults = async (req, res) => {
  try {
    const session = await AIExamSession.findByIdAndUpdate(
      req.params.id,
      { status: 'results_released', resultsReleasedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });
    res.status(200).json(session);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.startAttempt = async (req, res) => {
  try {
    const session = await AIExamSession.findById(req.params.id).populate('generatedExam');
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });

    const user = await User.findById(req.user._id);
    if (!studentCanAccessSession(session, user)) return res.status(403).json({ message: 'You are not eligible for this exam session.' });

    const now = new Date();
    if (session.status !== 'open') return res.status(403).json({ message: 'This exam is not open.' });
    if (!session.allowLateJoin && (now < session.startsAt || now > session.endsAt)) {
      return res.status(403).json({ message: 'This exam is outside its scheduled time window.' });
    }

    let attempt = await AIExamAttempt.findOne({ session: session._id, student: user._id });
    if (!attempt) {
      attempt = await AIExamAttempt.create({
        session: session._id,
        generatedExam: session.generatedExam._id,
        student: user._id,
        currentSectionKey: session.generatedExam.sections?.[0]?.key
      });
    } else if (attempt.status !== 'in_progress') {
      return res.status(403).json({ message: 'You have already submitted this exam.' });
    }

    const safeSession = session.toObject();
    safeSession.generatedExam = session.generatedExam._id;

    res.status(200).json({
      session: safeSession,
      attempt,
      exam: sanitizeGeneratedExam(session.generatedExam)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.saveAttempt = async (req, res) => {
  try {
    const attempt = await AIExamAttempt.findOne({ _id: req.params.attemptId, student: req.user._id });
    if (!attempt || attempt.status !== 'in_progress') return res.status(404).json({ message: 'Active attempt not found.' });

    attempt.sectionAnswers = req.body.sectionAnswers || attempt.sectionAnswers;
    attempt.currentSectionKey = req.body.currentSectionKey || attempt.currentSectionKey;
    await attempt.save();
    res.status(200).json(attempt);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.submitAttempt = async (req, res) => {
  try {
    const attempt = await AIExamAttempt.findOne({ _id: req.params.attemptId, student: req.user._id });
    if (!attempt || attempt.status !== 'in_progress') return res.status(404).json({ message: 'Active attempt not found.' });

    attempt.sectionAnswers = req.body.sectionAnswers || attempt.sectionAnswers;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();
    res.status(200).json(attempt);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.runSessionCorrection = async (req, res) => {
  try {
    const session = await AIExamSession.findById(req.params.id).populate('generatedExam');
    if (!session) return res.status(404).json({ message: 'Exam session not found.' });

    session.status = 'grading';
    await session.save();

    const attempts = await AIExamAttempt.find({ session: session._id, status: 'submitted' });
    for (const attempt of attempts) {
      const correction = await correctMockExamAttempt({
        generatedExam: session.generatedExam.toObject(),
        attempt: attempt.toObject()
      });
      attempt.correction = correction;
      attempt.status = 'graded';
      attempt.correctedAt = new Date();
      await attempt.save();
      await ExamCorrection.findOneAndUpdate(
        { attempt: attempt._id },
        {
          session: session._id,
          attempt: attempt._id,
          student: attempt.student,
          generatedExam: session.generatedExam._id,
          correction
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    if (session.resultReleaseMode === 'automatic_after_grading') {
      session.status = 'results_released';
      session.resultsReleasedAt = new Date();
      await session.save();
    }

    res.status(200).json({ graded: attempts.length });
  } catch (error) {
    console.error('AI correction error:', error);
    res.status(500).json({ message: error.message || 'Unable to run AI correction.' });
  }
};

exports.getAttemptResult = async (req, res) => {
  try {
    const attempt = await AIExamAttempt.findOne({ _id: req.params.attemptId, student: req.user._id }).populate('session');
    if (!attempt) return res.status(404).json({ message: 'Attempt not found.' });
    if (attempt.session.status !== 'results_released' && !isStaff(req.user)) {
      return res.status(403).json({ message: 'Results have not been released yet.' });
    }
    res.status(200).json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
