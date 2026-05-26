const Setting = require('../models/Setting');

const getPublicSettings = async (req, res) => {
  try {
    const feeSetting = await Setting.findOne({ key: 'registrationFee' });
    const requireFeeSetting = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });

    res.status(200).json({
      registrationFee: feeSetting ? Number(feeSetting.value) : 5000,
      requireOnlineRegistrationFee: requireFeeSetting ? requireFeeSetting.value === true || requireFeeSetting.value === 'true' : true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { registrationFee, requireOnlineRegistrationFee } = req.body;

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

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPublicSettings,
  updateSettings
};
