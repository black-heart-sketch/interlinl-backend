const Attendance = require('../models/Attendance');
const Internship = require('../models/Internship');

const normalizeRole = (role) => String(role || '').toLowerCase();
const dayStart = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const syncAttendanceRate = async (internId) => {
  const counted = await Attendance.find({ intern: internId, status: { $in: ['present', 'late', 'absent', 'excused'] } });
  if (!counted.length) return;
  const attended = counted.filter((row) => ['present', 'late', 'excused'].includes(row.status)).length;
  const attendanceRate = Math.round((attended / counted.length) * 100);
  await Internship.findOneAndUpdate({ student: internId, status: 'active' }, { attendanceRate });
};

const buildFilter = (req) => {
  const role = normalizeRole(req.user.role);
  const filter = {};

  if (role === 'student') filter.intern = req.user._id;
  else if (role === 'supervisor' || role === 'teacher' || role === 'advisor') filter.supervisor = req.user._id;

  if (req.query.internId) filter.intern = req.query.internId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = dayStart(req.query.from);
    if (req.query.to) filter.date.$lte = dayStart(req.query.to);
  }

  return filter;
};

const getAttendance = async (req, res) => {
  try {
    const rows = await Attendance.find(buildFilter(req))
      .populate('intern', 'firstName lastName email avatar department')
      .populate('supervisor', 'firstName lastName email')
      .sort({ date: -1, createdAt: -1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAttendanceByIntern = async (req, res) => {
  req.query.internId = req.params.internId;
  return getAttendance(req, res);
};

const checkIn = async (req, res) => {
  try {
    const internship = await Internship.findOne({ student: req.user._id, status: 'active' });
    const now = new Date();
    const date = dayStart(now);
    const lateAfterHour = Number(process.env.ATTENDANCE_LATE_AFTER_HOUR || 9);
    const status = req.body.status || (now.getHours() >= lateAfterHour ? 'late' : 'present');

    const row = await Attendance.findOneAndUpdate(
      { intern: req.user._id, date },
      {
        $setOnInsert: {
          intern: req.user._id,
          supervisor: internship?.supervisor,
          department: internship?.department || req.user.department || 'none',
          date,
        },
        $set: {
          checkInAt: now,
          status,
          source: req.body.qrToken ? 'qr' : 'manual',
          qrToken: req.body.qrToken || '',
          notes: req.body.notes || '',
        },
      },
      { new: true, upsert: true }
    );

    await syncAttendanceRate(req.user._id);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const date = dayStart(new Date());
    const row = await Attendance.findOne({ intern: req.user._id, date });
    if (!row) return res.status(404).json({ message: 'Check in before checking out.' });

    row.checkOutAt = new Date();
    if (req.body.notes) row.notes = req.body.notes;
    await row.save();

    await syncAttendanceRate(req.user._id);
    res.json(row);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { internId, date, status, notes } = req.body;
    if (!internId || !date || !status) {
      return res.status(400).json({ message: 'internId, date, and status are required.' });
    }

    const internship = await Internship.findOne({ student: internId, status: 'active' });
    const row = await Attendance.findOneAndUpdate(
      { intern: internId, date: dayStart(date) },
      {
        intern: internId,
        supervisor: internship?.supervisor || req.user._id,
        department: internship?.department || 'none',
        date: dayStart(date),
        status,
        source: 'manual',
        notes: notes || '',
      },
      { new: true, upsert: true }
    );

    await syncAttendanceRate(internId);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAttendance, getAttendanceByIntern, checkIn, checkOut, markAttendance };
