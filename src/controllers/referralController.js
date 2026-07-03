const ReferralCode = require('../models/ReferralCode');
const User = require('../models/User');

const normalizeCode = (code = '') => String(code).trim().toUpperCase();

const buildCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'REF-';
  for (let index = 0; index < 6; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
};

const getReferralCodes = async (req, res) => {
  try {
    const codes = await ReferralCode.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const codeIds = codes.map((code) => code._id);
    const usage = await User.aggregate([
      { $match: { referralCode: { $in: codeIds } } },
      {
        $group: {
          _id: '$referralCode',
          total: { $sum: 1 },
          lastUsedAt: { $max: '$createdAt' }
        }
      }
    ]);
    const usageByCode = new Map(usage.map((item) => [String(item._id), item]));

    res.json(codes.map((code) => {
      const liveUsage = usageByCode.get(String(code._id));
      const payload = code.toObject();
      return {
        ...payload,
        usageCount: liveUsage?.total || payload.usageCount || 0,
        lastUsedAt: liveUsage?.lastUsedAt || payload.lastUsedAt || null
      };
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createReferralCode = async (req, res) => {
  try {
    const { label, description, isActive } = req.body;
    let code = normalizeCode(req.body.code);

    if (!code) {
      do {
        code = buildCode();
      } while (await ReferralCode.exists({ code }));
    }

    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return res.status(400).json({ message: 'Referral code must be 3-32 characters using letters, numbers, underscores, or hyphens.' });
    }

    const exists = await ReferralCode.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: 'Referral code already exists' });
    }

    const referralCode = await ReferralCode.create({
      code,
      label,
      description,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user?._id
    });

    res.status(201).json(referralCode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateReferralCode = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findById(req.params.id);
    if (!referralCode) {
      return res.status(404).json({ message: 'Referral code not found' });
    }

    const { label, description, isActive } = req.body;
    if (label !== undefined) referralCode.label = label;
    if (description !== undefined) referralCode.description = description;
    if (isActive !== undefined) referralCode.isActive = Boolean(isActive);

    await referralCode.save();
    res.json(referralCode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReferralCode = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findById(req.params.id);
    if (!referralCode) {
      return res.status(404).json({ message: 'Referral code not found' });
    }

    const used = await User.exists({ referralCode: referralCode._id });
    if (used) {
      referralCode.isActive = false;
      await referralCode.save();
      return res.json({ message: 'Referral code has usage history and was deactivated.', referralCode });
    }

    await referralCode.deleteOne();
    res.json({ message: 'Referral code deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReferralStats = async (req, res) => {
  try {
    const [totalCodes, activeCodes, referredUsers, recentUsers, topCodes] = await Promise.all([
      ReferralCode.countDocuments(),
      ReferralCode.countDocuments({ isActive: true }),
      User.countDocuments({ referralCode: { $exists: true, $ne: null } }),
      User.find({ referralCode: { $exists: true, $ne: null } })
        .select('firstName lastName email phone referralCode referralCodeSnapshot createdAt')
        .populate('referralCode', 'code label isActive')
        .sort({ createdAt: -1 })
        .limit(25),
      User.aggregate([
        { $match: { referralCode: { $exists: true, $ne: null } } },
        { $group: { _id: '$referralCode', total: { $sum: 1 }, lastUsedAt: { $max: '$createdAt' } } },
        { $sort: { total: -1, lastUsedAt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'referralcodes',
            localField: '_id',
            foreignField: '_id',
            as: 'code'
          }
        },
        { $unwind: { path: '$code', preserveNullAndEmptyArrays: true } }
      ])
    ]);

    res.json({
      totalCodes,
      activeCodes,
      referredUsers,
      recentUsers,
      topCodes: topCodes.map((item) => ({
        _id: item._id,
        total: item.total,
        lastUsedAt: item.lastUsedAt,
        code: item.code?.code || 'Unknown',
        label: item.code?.label || ''
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReferralCodes,
  createReferralCode,
  updateReferralCode,
  deleteReferralCode,
  getReferralStats,
  normalizeCode
};
