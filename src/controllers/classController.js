const Class = require('../models/Class');

// @desc    Get all classes (with public filter support)
// @route   GET /api/classes
// @access  Public
const getClasses = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const filter = {};
    if (activeOnly === 'true' || !req.user) {
      filter.status = 'active';
    }

    const classes = await Class.find(filter).sort({ section: 1, level: 1 });
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private/Admin
const createClass = async (req, res) => {
  try {
    const { name, section, level, status } = req.body;

    if (!name || !section || !level) {
      return res.status(400).json({ message: 'Name, section, and level are required' });
    }

    const classExists = await Class.findOne({ name });
    if (classExists) {
      return res.status(400).json({ message: 'Class with this name already exists' });
    }

    const newClass = await Class.create({
      name,
      section,
      level,
      status: status || 'active'
    });

    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a class
// @route   PUT /api/classes/:id
// @access  Private/Admin
const updateClass = async (req, res) => {
  try {
    const { name, section, level, status } = req.body;
    const { id } = req.params;

    const cls = await Class.findById(id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (name && name !== cls.name) {
      const nameExists = await Class.findOne({ name });
      if (nameExists) {
        return res.status(400).json({ message: 'Class with this name already exists' });
      }
      cls.name = name;
    }

    if (section) cls.section = section;
    if (level) cls.level = level;
    if (status) cls.status = status;

    const updatedClass = await cls.save();
    res.status(200).json(updatedClass);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const cls = await Class.findById(id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }

    await cls.deleteOne();
    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getClasses,
  createClass,
  updateClass,
  deleteClass
};
