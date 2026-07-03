const Task = require('../models/Task');
const User = require('../models/User');
const Internship = require('../models/Internship');
const { createNotification } = require('../services/notificationService');
const crypto = require('crypto');

const STUDENT_DEPARTMENTS = ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development'];

const syncInternshipTaskProgress = async (internId) => {
  const internship = await Internship.findOne({ student: internId });
  if (!internship) return;

  const totalCount = await Task.countDocuments({ intern: internId });
  const completedCount = await Task.countDocuments({ intern: internId, status: 'completed' });
  internship.totalTasks = totalCount;
  internship.tasksCompleted = completedCount;
  internship.progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  await internship.save();
};

const getTasks = async (req, res) => {
  try {
    const filter = {};
    const role = String(req.user.role).toLowerCase();

    if (role === 'student') {
      filter.intern = req.user._id;
    } else if (role === 'supervisor') {
      filter.$or = [
        { supervisor: req.user._id },
        { department: req.user.department }
      ];
    } // Admins/managers have no filters and see all tasks

    const tasks = await Task.find(filter)
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('intern', 'firstName lastName email avatar')
      .populate('supervisor', 'firstName lastName email');
    
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, internId, internIds, assignmentScope = 'individual', priority, deadline, frequency = 'daily' } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    if (!['daily', 'weekly', 'custom'].includes(frequency)) {
      return res.status(400).json({ message: 'Task frequency must be daily, weekly, or custom' });
    }

    let targetInternIds = [];
    if (assignmentScope === 'all') {
      const allStudents = await User.find({ role: 'student', status: { $ne: 'banned' } }).select('_id');
      targetInternIds = allStudents.map((student) => String(student._id));
    } else if (assignmentScope === 'selected') {
      targetInternIds = Array.isArray(internIds) ? internIds : [];
    } else {
      targetInternIds = internId ? [internId] : [];
    }

    targetInternIds = [...new Set(targetInternIds.filter(Boolean).map(String))];

    if (!targetInternIds.length) {
      return res.status(400).json({ message: 'Select at least one target student' });
    }

    const interns = await User.find({ _id: { $in: targetInternIds }, role: 'student' }).select('firstName lastName email department');
    if (interns.length !== targetInternIds.length) {
      return res.status(400).json({ message: 'One or more selected students could not be found' });
    }

    const batchId = targetInternIds.length > 1 ? crypto.randomUUID() : undefined;
    const tasks = await Task.insertMany(interns.map((intern) => ({
      title,
      description,
      intern: intern._id,
      supervisor: req.user._id,
      department: STUDENT_DEPARTMENTS.includes(intern.department) ? intern.department : 'Software Engineering',
      priority: priority || 'medium',
      frequency,
      assignmentScope,
      assignmentBatchId: batchId,
      status: 'pending',
      deadline: deadline ? new Date(deadline) : null
    })));

    await Promise.all(tasks.map(async (task) => {
      await syncInternshipTaskProgress(task.intern);
      await createNotification({
        recipient: task.intern,
        actor: req.user._id,
        type: 'task',
        title: `New ${frequency} task assigned`,
        message: title,
        link: '/dashboard?view=tasks',
      });
      if (deadline) {
        await createNotification({
          recipient: task.intern,
          actor: req.user._id,
          type: 'deadline',
          title: 'Task deadline set',
          message: `${title} is due on ${new Date(deadline).toLocaleDateString()}.`,
          link: '/dashboard?view=tasks',
        });
      }
    }));

    res.status(201).json({ message: `${tasks.length} task${tasks.length === 1 ? '' : 's'} assigned.`, tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, deadline, status, frequency } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (frequency !== undefined) task.frequency = frequency;
    if (status !== undefined) task.status = status;
    if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const internId = task.intern;
    await task.deleteOne();
    await syncInternshipTaskProgress(internId);

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionNotes, submissionUrl } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (String(task.intern) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only submit tasks assigned to you' });
    }

    task.status = 'submitted';
    task.submissionNotes = submissionNotes || '';
    task.submissionUrl = submissionUrl || '';
    await task.save();

    res.json({ message: 'Task submitted successfully.', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'completed';
    task.score = Number(score) || 100;
    task.feedback = feedback || '';
    await task.save();

    // Sync progress with active Internship collection
    const internship = await Internship.findOne({ student: task.intern });
    if (internship) {
      const completedCount = await Task.countDocuments({ intern: task.intern, status: 'completed' });
      const totalCount = await Task.countDocuments({ intern: task.intern });

      internship.tasksCompleted = completedCount;
      internship.totalTasks = totalCount;
      internship.progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

      // Re-average supervisor ratings based on scores (translate 0-100 to 1-5 scale)
      const completedTasksWithScore = await Task.find({ intern: task.intern, status: 'completed', score: { $exists: true } });
      if (completedTasksWithScore.length > 0) {
        const totalScore = completedTasksWithScore.reduce((sum, t) => sum + t.score, 0);
        const averageRating = ((totalScore / completedTasksWithScore.length) / 100) * 5;
        internship.supervisorRating = Number(averageRating.toFixed(1));
      }

      await internship.save();
    }

    res.json({ message: 'Task approved and scored.', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'rejected';
    task.feedback = feedback || 'Revision required.';
    await task.save();

    await createNotification({
      recipient: task.intern,
      actor: req.user._id,
      type: 'feedback',
      title: 'Task revision requested',
      message: task.feedback,
      link: '/dashboard?view=tasks',
    });

    res.json({ message: 'Task marked for revision.', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const startTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (String(task.intern) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only start tasks assigned to you' });
    }

    if (task.status !== 'pending' && task.status !== 'rejected') {
      return res.status(400).json({ message: 'Task can only be started from pending or rejected status' });
    }

    task.status = 'in_progress';
    await task.save();

    res.json({ message: 'Task started successfully.', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  startTask,
  submitTask,
  approveTask,
  deleteTask,
  rejectTask
};
