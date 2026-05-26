const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { moveFile } = require('../middleware/multer');
const path = require('path');

exports.getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role.includes(',') ? { $in: req.query.role.split(',') } : req.query.role;
    }
    if (req.query.status) filter.status = req.query.status;
    const users = await User.find(filter)
      .select('-passwordHash')
      .populate('studyLanguage', 'name code')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.validateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    ).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { status, role, studyLanguage, studyMode, registeredLevel } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(status && { status }),
        ...(role && { role }),
        ...(studyLanguage !== undefined && { studyLanguage }),
        ...(studyMode !== undefined && { studyMode }),
        ...(registeredLevel !== undefined && { registeredLevel })
      },
      { new: true }
    ).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone, status, studyLanguage, studyMode, registeredLevel } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await User.create({
      firstName, lastName, email, phone,
      role: role || 'student',
      status: status || 'active',
      studyLanguage: studyLanguage || null,
      studyMode: studyMode || 'online',
      registeredLevel: registeredLevel || 'none',
      passwordHash
    });
    res.status(201).json({ _id: user._id, email: user.email, role: user.role, status: user.status, studyMode: user.studyMode, registeredLevel: user.registeredLevel });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, email, phone, password, language, studyLanguage } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email) {
      const exists = await User.findOne({ email, _id: { $ne: userId } });
      if (exists) return res.status(400).json({ message: 'Email is already in use by another account' });
      user.email = email;
    }
    if (phone !== undefined) user.phone = phone;
    if (language !== undefined) user.language = language;
    if (studyLanguage !== undefined) user.studyLanguage = studyLanguage || null;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    // Handle avatar upload
    if (req.processedFile) {
      const finalDir = path.join(__dirname, '../../assets/images/users');
      const finalPath = path.join(finalDir, req.processedFile.fileName);
      await moveFile(req.processedFile.path, finalPath);
      user.avatar = `/users/${req.processedFile.fileName}`;

      // Move thumbnail if it exists
      if (req.processedFile.thumbnailPath) {
        const finalThumbPath = path.join(finalDir, req.processedFile.thumbnailFilename);
        await moveFile(req.processedFile.thumbnailPath, finalThumbPath);
      }
    }

    await user.save();
    
    // Populate studyLanguage before sending back
    const populatedUser = await User.findById(userId).populate('studyLanguage', 'name code').select('-passwordHash');

    res.status(200).json(populatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
