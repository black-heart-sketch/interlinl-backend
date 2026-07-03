const User = require('../models/User');
const Setting = require('../models/Setting');
const ReferralCode = require('../models/ReferralCode');
const Internship = require('../models/Internship');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const crypto = require('crypto');
const { buildWebhookUrl, getTransactionStatus, initiatePayIn } = require('../utils/digipay');

const normalizeReferralCode = (code = '') => String(code).trim().toUpperCase();

const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, class: classId, department, referralCode } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (classId) {
      const Class = require('../models/Class');
      const cls = await Class.findById(classId);
      if (!cls) {
        return res.status(400).json({ message: 'Selected class does not exist' });
      }
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const normalizedReferralCode = normalizeReferralCode(referralCode);
    let matchedReferralCode = null;
    if (!normalizedReferralCode) {
      return res.status(400).json({ message: 'Referral code is required' });
    }

    matchedReferralCode = await ReferralCode.findOne({ code: normalizedReferralCode, isActive: true });
    if (!matchedReferralCode) {
      return res.status(400).json({ message: 'Invalid or inactive referral code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the User - active by default so they can log in and be gated on the dashboard
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      passwordHash: hashedPassword,
      role: 'student',
      status: 'active',
      class: classId || null,
      department: department || 'none',
      referralCode: matchedReferralCode?._id,
      referralCodeSnapshot: matchedReferralCode?.code
    });

    if (matchedReferralCode) {
      matchedReferralCode.usageCount += 1;
      matchedReferralCode.lastUsedAt = new Date();
      await matchedReferralCode.save();
    }

    res.status(201).json({
      _id: user._id,
      email: user.email,
      status: user.status,
      class: user.class,
      referralCode: user.referralCodeSnapshot,
      message: 'Registration successful. Please log in to complete your onboarding.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('class', 'name section level');

    if (user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
      if (user.status === 'pending') {
        return res.status(403).json({
          message: 'Your account is pending admin validation. Please wait for approval.'
        });
      }
      if (user.status === 'banned') {
        return res.status(403).json({ message: 'Your account has been suspended.' });
      }

      res.json({
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        phone: user.phone,
        class: user.class,
        platformAccessOverride: user.platformAccessOverride,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const initiateRegistrationPayment = async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required for Mobile Money payment' });
    }

    // Get registration fee from Settings
    const feeSetting = await Setting.findOne({ key: 'registrationFee' });
    const feeAmount = feeSetting ? Number(feeSetting.value) : 5000;

    console.log(`Initiating DigiPay registration fee pay-in of ${feeAmount} FCFA to phone ${phone}`);

    // Query settings for custom key, then env fallback
    let apiKey = null;
    try {
      const keySetting = await Setting.findOne({ key: 'digipayApiKey' });
      if (keySetting && keySetting.value) {
        apiKey = String(keySetting.value).trim();
      }
    } catch {}
    if (!apiKey) {
      apiKey = process.env.DIGIPAY_API_KEY;
    }

    // If using the default test key or mock sandbox key, simulate successful transaction
    if (apiKey === 'dpk_test_einstein' || !apiKey || apiKey.startsWith('dpk_test_')) {
      const mockTxId = 'dp_tx_' + Math.random().toString(36).substr(2, 9);
      return res.status(200).json({
        success: true,
        transactionId: mockTxId,
        amount: feeAmount,
        currency: 'XAF',
        message: 'Sandbox payment initiated successfully.'
      });
    }

    const payin = await initiatePayIn({
      amount: feeAmount,
      customerPhone: phone,
      customerEmail: email || 'student@einstein.com',
      metadata: { purpose: 'registration', email },
      webhookUrl: buildWebhookUrl(req)
    });

    res.status(200).json({
      success: true,
      transactionId: payin.transactionId,
      amount: feeAmount,
      currency: 'XAF',
      message: 'DigiPay payment initiated successfully.'
    });
  } catch (error) {
    console.error('Error initiating DigiPay payment:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      details: error.rawResponse
    });
  }
};

const getRegistrationPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    let isCompleted = false;
    let txnAmount = 5000;

    if (transactionId.startsWith('dp_tx_')) {
      // Sandbox mock
      isCompleted = true;
    } else {
      const txn = await getTransactionStatus(transactionId);
      const txnStatus = String(txn?.status || '').toLowerCase();
      txnAmount = txn?.amount || 5000;
      if (['completed', 'success', 'successful'].includes(txnStatus)) {
        isCompleted = true;
      }
    }

    if (isCompleted) {
      const InternshipApplication = require('../models/InternshipApplication');
      const app = await InternshipApplication.findOne({ transactionId }).populate('user');
      if (app) {
        if (app.paymentStatus !== 'paid') app.paymentStatus = 'paid';
        if (app.status !== 'approved') app.status = 'approved';
        await app.save();

        if (app.user) {
          app.user.status = 'active';
          app.user.department = app.department;
          await app.user.save();

          const existingInternship = await Internship.findOne({ student: app.user._id });
          if (!existingInternship) {
            await Internship.create({
              student: app.user._id,
              department: app.department,
              class: app.user.class || null,
              status: 'active',
              progress: 0
            });
          }
        }
      }
    }

    res.status(200).json({
      status: isCompleted ? 'completed' : 'pending',
      amount: txnAmount,
      reference: transactionId
    });
  } catch (error) {
    console.error('Error fetching DigiPay status:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      details: error.rawResponse
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('class', 'name section level');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const logoutUser = async (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    await user.save();

    console.log(`[PASSWORD RESET] Token generated for ${email}: ${resetToken}`);
    console.log(`[PASSWORD RESET] Recovery URL: /reset-password/${resetToken}`);

    res.status(200).json({
      success: true,
      message: 'Password reset token generated successfully. For development, see the backend terminal logs.',
      token: resetToken
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  forgotPassword,
  resetPassword,
  initiateRegistrationPayment,
  getRegistrationPaymentStatus
};
