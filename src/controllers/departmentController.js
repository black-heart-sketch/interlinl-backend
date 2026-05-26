const Department = require('../models/Department');

const getDepartments = async (req, res) => {
  try {
    const filter = req.query.activeOnly === 'true' ? { isActive: true } : {};
    const departments = await Department.find(filter);
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and code are required' });
    }

    const deptExists = await Department.findOne({ $or: [{ name }, { code }] });
    if (deptExists) {
      return res.status(400).json({ message: 'Department name or code already exists' });
    }

    const department = await Department.create({ name, code, description, isActive });
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    department.name = name !== undefined ? name : department.name;
    department.code = code !== undefined ? code : department.code;
    department.description = description !== undefined ? description : department.description;
    department.isActive = isActive !== undefined ? isActive : department.isActive;

    await department.save();
    res.json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
