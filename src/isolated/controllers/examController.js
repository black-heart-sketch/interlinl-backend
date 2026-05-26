const Exam = require('../models/Exam');
const ExamAttempt = require('../models/ExamAttempt');
const Course = require('../models/Course');

exports.createExam = async (req, res) => {
  try {
    const exam = await Exam.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(exam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getExams = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'student') {
      filter.isPublished = true;
      // Optionally filter by courses the student is enrolled in
    }
    const exams = await Exam.find(filter).populate('course', 'title');
    
    // For students, remove correctOptionIndex from the response
    if (req.user.role === 'student') {
      const sanitizedExams = exams.map(exam => {
        const doc = exam.toObject();
        doc.questions.forEach(q => { delete q.correctOptionIndex; });
        return doc;
      });
      return res.status(200).json(sanitizedExams);
    }

    res.status(200).json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.startAttempt = async (req, res) => {
  try {
    const examId = req.params.id;
    const exam = await Exam.findById(examId);
    
    if (!exam || !exam.isPublished) return res.status(404).json({ message: 'Exam not found' });
    
    const now = new Date();
    if (now < exam.startTime) return res.status(403).json({ message: 'L\'examen n\'a pas encore commencé' });
    if (now > exam.endTime) return res.status(403).json({ message: 'L\'examen est terminé' });

    let attempt = await ExamAttempt.findOne({ exam: examId, student: req.user._id });
    if (!attempt) {
      attempt = await ExamAttempt.create({ exam: examId, student: req.user._id });
    } else if (attempt.status === 'completed') {
      return res.status(403).json({ message: 'Vous avez déjà soumis cet examen.' });
    }

    // Strip answers
    const safeExam = exam.toObject();
    safeExam.questions.forEach(q => delete q.correctOptionIndex);

    res.status(200).json({ exam: safeExam, attempt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.submitAttempt = async (req, res) => {
  try {
    const examId = req.params.id;
    const { answers } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const attempt = await ExamAttempt.findOne({ exam: examId, student: req.user._id });
    if (!attempt || attempt.status === 'completed') {
      return res.status(403).json({ message: 'Tentative invalide ou déjà soumise.' });
    }

    // Auto-grade
    let correctCount = 0;
    exam.questions.forEach((q, idx) => {
      if (answers[idx] !== undefined && answers[idx] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / exam.questions.length) * 100);

    attempt.answers = answers;
    attempt.score = score;
    attempt.status = 'completed';
    attempt.submittedAt = new Date();
    await attempt.save();

    res.status(200).json({ message: 'Exam submitted', score, correctCount, total: exam.questions.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.status(200).json(exam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.status(200).json({ message: 'Exam deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
