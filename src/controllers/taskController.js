const Task = require('../models/Task');
const User = require('../models/User');
const Internship = require('../models/Internship');

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
    const { title, description, internId, priority, deadline } = req.body;
    
    if (!title || !description || !internId) {
      return res.status(400).json({ message: 'Title, description, and target intern are required' });
    }

    const intern = await User.findById(internId);
    if (!intern) {
      return res.status(404).json({ message: 'Target trainee not found' });
    }

    const task = await Task.create({
      title,
      description,
      intern: internId,
      supervisor: req.user._id,
      department: intern.department || 'Software Engineering',
      priority: priority || 'medium',
      status: 'pending',
      deadline: deadline ? new Date(deadline) : null
    });

    // Automatically register task count updates in active Internship record
    const internship = await Internship.findOne({ student: internId });
    if (internship) {
      const totalCount = await Task.countDocuments({ intern: internId });
      const completedCount = await Task.countDocuments({ intern: internId, status: 'completed' });
      internship.totalTasks = totalCount;
      internship.progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
      await internship.save();
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, deadline, status } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;

    await task.save();
    res.json(task);
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
  rejectTask
};
