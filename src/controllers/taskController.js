const Task = require('../models/Task');
const TaskProgress = require('../models/TaskProgress');
const User = require('../models/User');
const Internship = require('../models/Internship');
const { createNotification } = require('../services/notificationService');

const STUDENT_DEPARTMENTS = ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development'];
const TASK_FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'];
const TASK_STATUSES = ['pending', 'in_progress', 'submitted', 'completed', 'rejected'];

const asId = (value) => String(value?._id || value || '');

const startOfDay = (value) => {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getWeekNumber = (date) => {
  const target = startOfDay(date);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekOne = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - weekOne) / 86400000 - 3 + ((weekOne.getDay() + 6) % 7)) / 7);
};

const buildTaskPeriod = (frequency, deadline) => {
  const anchor = startOfDay(deadline || new Date());
  const weekStart = addDays(anchor, -((anchor.getDay() + 6) % 7));
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);

  return {
    day: frequency === 'daily' ? anchor : undefined,
    weekStart: ['daily', 'weekly'].includes(frequency) ? weekStart : undefined,
    monthStart,
    year: anchor.getFullYear(),
    week: getWeekNumber(anchor),
    month: anchor.getMonth() + 1
  };
};

const isCanonicalTask = (task) => !task.intern;

const canStudentSeeTask = (task, studentId) => {
  if (task.intern) return asId(task.intern) === asId(studentId);
  if (task.assignmentScope === 'all') return true;
  return (task.targetStudents || []).some((id) => asId(id) === asId(studentId));
};

const toFlatTask = (task, progress = null) => {
  const rawTask = task.toObject ? task.toObject() : task;
  const rawProgress = progress?.toObject ? progress.toObject() : progress;

  return {
    ...rawTask,
    ...(rawProgress || {}),
    _id: rawProgress?._id || rawTask._id,
    taskId: rawTask._id,
    progressId: rawProgress?._id || null,
    intern: rawProgress?.intern || rawTask.intern,
    supervisor: rawTask.supervisor,
    department: rawTask.department,
    title: rawTask.title,
    description: rawTask.description,
    priority: rawTask.priority,
    frequency: rawTask.frequency || 'daily',
    assignmentScope: rawTask.assignmentScope || 'individual',
    assignmentBatchId: rawTask.assignmentBatchId,
    deadline: rawTask.deadline,
    period: rawTask.period,
    status: rawProgress?.status || rawTask.status || 'pending',
    submissionNotes: rawProgress?.submissionNotes || rawTask.submissionNotes,
    submissionUrl: rawProgress?.submissionUrl || rawTask.submissionUrl,
    feedback: rawProgress?.feedback || rawTask.feedback,
    score: rawProgress?.score ?? rawTask.score,
    createdAt: rawTask.createdAt,
    updatedAt: rawProgress?.updatedAt || rawTask.updatedAt
  };
};

const upsertTaskProgress = async (task, internId) => {
  if (!isCanonicalTask(task)) return null;
  return TaskProgress.findOneAndUpdate(
    { task: task._id, intern: internId },
    { $setOnInsert: { task: task._id, intern: internId, status: 'pending' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate('intern', 'firstName lastName email avatar department');
};

const getProgressMetrics = async (internId) => {
  const [progressRows, legacyTasks] = await Promise.all([
    TaskProgress.find({ intern: internId }).select('status score'),
    Task.find({ intern: internId }).select('status score')
  ]);

  const rows = [...progressRows, ...legacyTasks];
  const totalCount = rows.length;
  const completedRows = rows.filter((row) => row.status === 'completed');
  const completedCount = completedRows.length;
  const scoredRows = completedRows.filter((row) => Number.isFinite(Number(row.score)));

  return {
    totalCount,
    completedCount,
    progress: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
    supervisorRating: scoredRows.length
      ? Number((((scoredRows.reduce((sum, row) => sum + Number(row.score), 0) / scoredRows.length) / 100) * 5).toFixed(1))
      : null
  };
};

const syncInternshipTaskProgress = async (internId) => {
  const internship = await Internship.findOne({ student: internId });
  if (!internship) return;

  const metrics = await getProgressMetrics(internId);
  internship.totalTasks = metrics.totalCount;
  internship.tasksCompleted = metrics.completedCount;
  internship.progress = metrics.progress;
  if (metrics.supervisorRating !== null) internship.supervisorRating = metrics.supervisorRating;
  await internship.save();
};

const getTaskProgressContext = async (id, req, { createForStudent = false } = {}) => {
  let progress = await TaskProgress.findById(id)
    .populate('intern', 'firstName lastName email avatar department')
    .populate({ path: 'task', populate: { path: 'supervisor', select: 'firstName lastName email' } });

  if (progress) {
    return { task: progress.task, progress, legacy: false };
  }

  const task = await Task.findById(id)
    .populate('intern', 'firstName lastName email avatar department')
    .populate('supervisor', 'firstName lastName email');
  if (!task) return null;

  if (isCanonicalTask(task) && createForStudent && req.user?.role === 'student' && canStudentSeeTask(task, req.user._id)) {
    progress = await upsertTaskProgress(task, req.user._id);
    return { task, progress, legacy: false };
  }

  return { task, progress: null, legacy: !isCanonicalTask(task) };
};

const getTasks = async (req, res) => {
  try {
    const role = String(req.user.role).toLowerCase();
    const taskFilter = {};

    if (role === 'student') {
      taskFilter.$or = [
        { intern: req.user._id },
        { intern: { $exists: false }, assignmentScope: 'all' },
        { intern: { $exists: false }, targetStudents: req.user._id }
      ];
    } else if (role === 'supervisor') {
      taskFilter.$or = [
        { supervisor: req.user._id },
        { department: req.user.department }
      ];
    }

    const tasks = await Task.find(taskFilter)
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const canonicalTasks = tasks.filter(isCanonicalTask);
    const legacyTasks = tasks.filter((task) => !isCanonicalTask(task));

    let progressRows = [];
    if (role === 'student') {
      progressRows = await Promise.all(canonicalTasks.map((task) => upsertTaskProgress(task, req.user._id)));
      progressRows = progressRows.filter(Boolean);
    } else if (canonicalTasks.length) {
      progressRows = await TaskProgress.find({ task: { $in: canonicalTasks.map((task) => task._id) } })
        .populate('intern', 'firstName lastName email avatar department');
    }

    const taskById = new Map(canonicalTasks.map((task) => [asId(task._id), task]));
    const canonicalFlatTasks = progressRows.map((progress) => toFlatTask(taskById.get(asId(progress.task)) || progress.task, progress));
    const legacyFlatTasks = legacyTasks.map((task) => toFlatTask(task));

    res.json([...canonicalFlatTasks, ...legacyFlatTasks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const context = await getTaskProgressContext(req.params.id, req, { createForStudent: true });
    if (!context) return res.status(404).json({ message: 'Task not found' });
    res.json(toFlatTask(context.task, context.progress));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, internId, internIds, assignmentScope = 'individual', priority, deadline, frequency = 'daily', department } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    if (!TASK_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ message: 'Task frequency must be daily, weekly, monthly, or custom' });
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

    const interns = await User.find({ _id: { $in: targetInternIds }, role: 'student' }).select('firstName lastName email department avatar');
    if (interns.length !== targetInternIds.length) {
      return res.status(400).json({ message: 'One or more selected students could not be found' });
    }

    const taskDeadline = deadline ? new Date(deadline) : null;
    const taskData = {
      title,
      description,
      supervisor: req.user._id,
      department: assignmentScope === 'all'
        ? undefined
        : STUDENT_DEPARTMENTS.includes(department)
          ? department
          : STUDENT_DEPARTMENTS.includes(req.user.department)
            ? req.user.department
            : 'Software Engineering',
      priority: priority || 'medium',
      frequency,
      assignmentScope,
      targetStudents: assignmentScope === 'all' ? [] : targetInternIds,
      status: 'pending',
      deadline: taskDeadline,
      period: buildTaskPeriod(frequency, taskDeadline)
    };

    let task = await Task.findOne({ title, assignmentScope, frequency, deadline: taskDeadline, intern: { $exists: false } });
    if (task) {
      Object.assign(task, taskData);
      await task.save();
    } else {
      task = await Task.create(taskData);
    }

    await TaskProgress.bulkWrite(interns.map((intern) => ({
      updateOne: {
        filter: { task: task._id, intern: intern._id },
        update: { $setOnInsert: { task: task._id, intern: intern._id, status: 'pending' } },
        upsert: true
      }
    })), { ordered: false });

    const progressRows = await TaskProgress.find({ task: task._id, intern: { $in: interns.map((intern) => intern._id) } });

    await Promise.all(progressRows.map(async (progress) => {
      await syncInternshipTaskProgress(progress.intern);
      if (!task.notificationSentAt) {
        await createNotification({
          recipient: progress.intern,
          actor: req.user._id,
          type: 'task',
          title: `New ${frequency} task assigned`,
          message: title,
          link: '/dashboard?view=tasks',
        });
      }
      if (!task.notificationSentAt && deadline) {
        await createNotification({
          recipient: progress.intern,
          actor: req.user._id,
          type: 'deadline',
          title: 'Task deadline set',
          message: `${title} is due on ${new Date(deadline).toLocaleDateString()}.`,
          link: '/dashboard?view=tasks',
        });
      }
    }));
    if (!task.notificationSentAt) {
      task.notificationSentAt = new Date();
      await task.save();
    }

    const populatedProgress = await TaskProgress.find({ task: task._id }).populate('intern', 'firstName lastName email avatar department');
    const populatedTask = await Task.findById(task._id).populate('supervisor', 'firstName lastName email');

    res.status(201).json({
      message: `${populatedProgress.length} student progress record${populatedProgress.length === 1 ? '' : 's'} created for one task.`,
      task: populatedTask,
      tasks: populatedProgress.map((progress) => toFlatTask(populatedTask, progress)),
      count: populatedProgress.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const context = await getTaskProgressContext(req.params.id, req);
    if (!context) return res.status(404).json({ message: 'Task not found' });

    const { title, description, priority, deadline, status, frequency } = req.body;
    const { task, progress, legacy } = context;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (frequency !== undefined) {
      if (!TASK_FREQUENCIES.includes(frequency)) {
        return res.status(400).json({ message: 'Task frequency must be daily, weekly, monthly, or custom' });
      }
      task.frequency = frequency;
    }
    if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
    if (frequency !== undefined || deadline !== undefined) task.period = buildTaskPeriod(task.frequency || 'daily', task.deadline);

    if (status !== undefined) {
      if (!TASK_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid task status' });
      if (legacy) task.status = status;
      else if (progress) progress.status = status;
    }

    await task.save();
    if (progress) await progress.save();
    res.json(toFlatTask(task, progress));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const context = await getTaskProgressContext(req.params.id, req);
    if (!context) return res.status(404).json({ message: 'Task not found' });

    if (context.progress) {
      const internId = context.progress.intern;
      await context.progress.deleteOne();
      await syncInternshipTaskProgress(internId);
      const remaining = await TaskProgress.countDocuments({ task: context.task._id });
      if (!remaining) await context.task.deleteOne();
    } else {
      const internId = context.task.intern;
      await TaskProgress.deleteMany({ task: context.task._id });
      await context.task.deleteOne();
      if (internId) await syncInternshipTaskProgress(internId);
    }

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const assignExistingTaskToNewStudents = async (req, res) => {
  try {
    const context = await getTaskProgressContext(req.params.id, req);
    if (!context) return res.status(404).json({ message: 'Task not found' });
    const sourceTask = context.task;

    const existingProgress = await TaskProgress.find({ task: sourceTask._id }).select('intern');
    const existingInternIds = new Set(existingProgress.map((progress) => asId(progress.intern)));
    if (sourceTask.intern) existingInternIds.add(asId(sourceTask.intern));

    const students = await User.find({
      role: 'student',
      status: { $ne: 'banned' },
      _id: { $nin: Array.from(existingInternIds) }
    }).select('firstName lastName email department avatar');

    if (!students.length) {
      return res.json({
        message: 'No new students need this task.',
        assigned: 0,
        batchId: sourceTask.assignmentBatchId || null,
        tasks: []
      });
    }

    if (!isCanonicalTask(sourceTask)) {
      sourceTask.set('intern', undefined);
      sourceTask.targetStudents = [];
      sourceTask.assignmentScope = 'all';
    }

    sourceTask.assignmentScope = 'all';
    sourceTask.targetStudents = [];
    sourceTask.assignmentBatchId = undefined;
    await sourceTask.save();

    const progressRows = await TaskProgress.insertMany(students.map((student) => ({
      task: sourceTask._id,
      intern: student._id,
      status: 'pending'
    })));

    await Promise.all(progressRows.map(async (progress) => {
      await syncInternshipTaskProgress(progress.intern);
      await createNotification({
        recipient: progress.intern,
        actor: req.user._id,
        type: 'task',
        title: `New ${sourceTask.frequency || 'daily'} task assigned`,
        message: sourceTask.title,
        link: '/dashboard?view=tasks',
      });
    }));

    const populatedProgress = await TaskProgress.find({ _id: { $in: progressRows.map((progress) => progress._id) } })
      .populate('intern', 'firstName lastName email avatar department');

    res.status(201).json({
      message: `${populatedProgress.length} new student${populatedProgress.length === 1 ? '' : 's'} assigned this existing task.`,
      assigned: populatedProgress.length,
      batchId: null,
      tasks: populatedProgress.map((progress) => toFlatTask(sourceTask, progress))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const submitTask = async (req, res) => {
  try {
    const { submissionNotes, submissionUrl } = req.body;
    const context = await getTaskProgressContext(req.params.id, req, { createForStudent: true });
    if (!context) return res.status(404).json({ message: 'Task not found' });
    const { task, progress, legacy } = context;
    const ownerId = progress?.intern || task.intern;

    if (asId(ownerId) !== asId(req.user._id)) {
      return res.status(403).json({ message: 'You can only submit tasks assigned to you' });
    }

    const row = progress || task;
    row.status = 'submitted';
    row.submissionNotes = submissionNotes || '';
    row.submissionUrl = submissionUrl || '';
    row.submittedAt = new Date();
    await row.save();
    await syncInternshipTaskProgress(asId(row.intern));

    res.json({ message: 'Task submitted successfully.', task: toFlatTask(task, legacy ? null : progress) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveTask = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const context = await getTaskProgressContext(req.params.id, req);
    if (!context) return res.status(404).json({ message: 'Task not found' });
    const { task, progress, legacy } = context;
    const row = progress || task;

    row.status = 'completed';
    row.score = Number(score) || 100;
    row.feedback = feedback || '';
    row.reviewedAt = new Date();
    await row.save();
    await syncInternshipTaskProgress(asId(row.intern));

    res.json({ message: 'Task approved and scored.', task: toFlatTask(task, legacy ? null : progress) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectTask = async (req, res) => {
  try {
    const { feedback } = req.body;
    const context = await getTaskProgressContext(req.params.id, req);
    if (!context) return res.status(404).json({ message: 'Task not found' });
    const { task, progress, legacy } = context;
    const row = progress || task;

    row.status = 'rejected';
    row.feedback = feedback || 'Revision required.';
    row.reviewedAt = new Date();
    await row.save();
    await syncInternshipTaskProgress(asId(row.intern));

    await createNotification({
      recipient: row.intern,
      actor: req.user._id,
      type: 'feedback',
      title: 'Task revision requested',
      message: row.feedback,
      link: '/dashboard?view=tasks',
    });

    res.json({ message: 'Task marked for revision.', task: toFlatTask(task, legacy ? null : progress) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const startTask = async (req, res) => {
  try {
    const context = await getTaskProgressContext(req.params.id, req, { createForStudent: true });
    if (!context) return res.status(404).json({ message: 'Task not found' });
    const { task, progress, legacy } = context;
    const row = progress || task;

    if (asId(row.intern) !== asId(req.user._id)) {
      return res.status(403).json({ message: 'You can only start tasks assigned to you' });
    }

    if (row.status !== 'pending' && row.status !== 'rejected') {
      return res.status(400).json({ message: 'Task can only be started from pending or rejected status' });
    }

    row.status = 'in_progress';
    row.startedAt = new Date();
    await row.save();
    await syncInternshipTaskProgress(asId(row.intern));

    res.json({ message: 'Task started successfully.', task: toFlatTask(task, legacy ? null : progress) });
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
  assignExistingTaskToNewStudents,
  deleteTask,
  rejectTask
};
