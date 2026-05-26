const StudyLanguage = require('../models/StudyLanguage');

exports.getStudyLanguages = async (req, res) => {
  try {
    const filter = req.query.activeOnly === 'true' ? { isActive: true } : {};
    const languages = await StudyLanguage.find(filter).sort({ name: 1 });
    res.status(200).json(languages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createStudyLanguage = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Name and code are required' });
    const existing = await StudyLanguage.findOne({ code: code.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'A language with this code already exists' });
    const language = await StudyLanguage.create({ name, code: code.toLowerCase(), isActive: true });
    res.status(201).json(language);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateStudyLanguage = async (req, res) => {
  try {
    const { name, code, isActive } = req.body;
    const language = await StudyLanguage.findByIdAndUpdate(
      req.params.id,
      { name, code, isActive },
      { new: true, runValidators: true }
    );
    if (!language) return res.status(404).json({ message: 'Language not found' });
    res.status(200).json(language);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteStudyLanguage = async (req, res) => {
  try {
    await StudyLanguage.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Language deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
