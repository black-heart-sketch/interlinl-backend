const Setting = require('../models/Setting');

const getPublicSettings = async (req, res) => {
  try {
    const feeSetting = await Setting.findOne({ key: 'registrationFee' });
    const requireFeeSetting = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });
    const internshipFeeSetting = await Setting.findOne({ key: 'internshipFee' });
    const internshipInstallmentsSetting = await Setting.findOne({ key: 'internshipInstallments' });

    res.status(200).json({
      registrationFee: feeSetting ? Number(feeSetting.value) : 5000,
      requireOnlineRegistrationFee: requireFeeSetting ? requireFeeSetting.value === true || requireFeeSetting.value === 'true' : true,
      internshipFee: internshipFeeSetting ? Number(internshipFeeSetting.value) : 0,
      internshipInstallments: internshipInstallmentsSetting ? Math.max(1, Number(internshipInstallmentsSetting.value) || 1) : 1
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSettings = async (req, res) => {
  try {
    const feeSetting = await Setting.findOne({ key: 'registrationFee' });
    const requireFeeSetting = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });
    const internshipFeeSetting = await Setting.findOne({ key: 'internshipFee' });
    const internshipInstallmentsSetting = await Setting.findOne({ key: 'internshipInstallments' });
    const apiKeySetting = await Setting.findOne({ key: 'digipayApiKey' });
    const envSetting = await Setting.findOne({ key: 'digipayEnv' });

    res.status(200).json({
      registrationFee: feeSetting ? Number(feeSetting.value) : 5000,
      requireOnlineRegistrationFee: requireFeeSetting ? requireFeeSetting.value === true || requireFeeSetting.value === 'true' : true,
      internshipFee: internshipFeeSetting ? Number(internshipFeeSetting.value) : 0,
      internshipInstallments: internshipInstallmentsSetting ? Math.max(1, Number(internshipInstallmentsSetting.value) || 1) : 1,
      digipayApiKey: apiKeySetting ? String(apiKeySetting.value) : '',
      digipayEnv: envSetting ? String(envSetting.value) : 'production'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { registrationFee, requireOnlineRegistrationFee, internshipFee, internshipInstallments, digipayApiKey, digipayEnv } = req.body;

    if (registrationFee !== undefined) {
      await Setting.findOneAndUpdate(
        { key: 'registrationFee' },
        { value: Number(registrationFee) },
        { upsert: true, new: true }
      );
    }

    if (requireOnlineRegistrationFee !== undefined) {
      const boolVal = requireOnlineRegistrationFee === true || requireOnlineRegistrationFee === 'true';
      await Setting.findOneAndUpdate(
        { key: 'requireOnlineRegistrationFee' },
        { value: boolVal },
        { upsert: true, new: true }
      );
    }

    if (internshipFee !== undefined) {
      const fee = Number(internshipFee);
      if (Number.isNaN(fee) || fee < 0) {
        return res.status(400).json({ message: 'Internship fee must be a positive amount.' });
      }
      await Setting.findOneAndUpdate(
        { key: 'internshipFee' },
        { value: fee },
        { upsert: true, new: true }
      );
    }

    if (internshipInstallments !== undefined) {
      const count = Math.max(1, Math.floor(Number(internshipInstallments) || 1));
      await Setting.findOneAndUpdate(
        { key: 'internshipInstallments' },
        { value: count },
        { upsert: true, new: true }
      );
    }

    if (digipayApiKey !== undefined) {
      await Setting.findOneAndUpdate(
        { key: 'digipayApiKey' },
        { value: String(digipayApiKey).trim() },
        { upsert: true, new: true }
      );
    }

    if (digipayEnv !== undefined) {
      await Setting.findOneAndUpdate(
        { key: 'digipayEnv' },
        { value: String(digipayEnv).trim() },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPublicSettings,
  getSettings,
  updateSettings
};
