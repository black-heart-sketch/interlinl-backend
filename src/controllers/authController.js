const User = require('../models/User');
const Setting = require('../models/Setting');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const crypto = require('crypto');
const { buildWebhookUrl, getTransactionStatus, initiatePayIn } = require('../utils/digipay');

const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, studyLanguage, studyMode, transactionId, class: classId, department, paymentOption } = req.body;

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

    const mode = studyMode === 'on_site' ? 'on_site' : 'online';
    const chosenPaymentOption = paymentOption || 'pay_now';

    const requireFeeSetting = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });
    const requireFee = requireFeeSetting ? requireFeeSetting.value === true || requireFeeSetting.value === 'true' : true;

    let userStatus = 'pending';
    let appPaymentStatus = 'pending';

    if (requireFee && chosenPaymentOption !== 'pay_later') {
      if (!transactionId) {
        return res.status(400).json({ message: 'DigiPay Transaction ID is required for registration' });
      }

      // Verify transaction is completed
      let isPaid = false;
      if (transactionId.startsWith('dp_tx_')) {
        isPaid = true;
      } else {
        try {
          const txn = await getTransactionStatus(transactionId);
          const txnStatus = String(txn?.status || '').toLowerCase();
          if (['completed', 'success', 'successful'].includes(txnStatus)) {
            isPaid = true;
          }
        } catch (err) {
          return res.status(400).json({ message: 'Failed to verify payment transaction ID' });
        }
      }

      if (!isPaid) {
        return res.status(400).json({ message: 'Registration fee payment is not completed or failed' });
      }

      // Since they successfully paid, their account is active and application is paid immediately!
      userStatus = 'active';
      appPaymentStatus = 'paid';
    } else {
      // Either no fee required, or they chose to pay later (which makes userStatus = 'pending' by default)
      userStatus = requireFee && chosenPaymentOption === 'pay_later' ? 'pending' : 'active';
      appPaymentStatus = requireFee && chosenPaymentOption === 'pay_later' ? 'pending' : 'paid';
    }

    // Handle CV/resume upload (if exists)
    let resumeUrl = null;
    if (req.processedFile) {
      const finalDir = path.join(__dirname, '../../assets/receipts');
      const finalPath = path.join(finalDir, req.processedFile.fileName);
      await moveFile(req.processedFile.path, finalPath);
      resumeUrl = `/receipts/${req.processedFile.fileName}`;

      // Move the generated thumbnail if it exists
      if (req.processedFile.thumbnailPath) {
        const finalThumbPath = path.join(finalDir, req.processedFile.thumbnailFilename);
        await moveFile(req.processedFile.thumbnailPath, finalThumbPath);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 1. Create the base User
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      passwordHash: hashedPassword,
      role: 'student',
      status: userStatus,
      studyLanguage: studyLanguage || null,
      class: classId || null,
      department: department || 'none'
    });

    // 2. Create the InternshipApplication
    const InternshipApplication = require('../models/InternshipApplication');
    const application = await InternshipApplication.create({
      user: user._id,
      department: department || 'none',
      studyMode: mode,
      paymentOption: chosenPaymentOption,
      paymentStatus: appPaymentStatus,
      transactionId: transactionId || null,
      resumeUrl,
      status: 'pending' // pending review
    });

    const successMessage = chosenPaymentOption === 'pay_later'
      ? 'Registration successful. Your application is pending registration fee payment.'
      : 'Registration successful. Your application is now pending admin review!';

    res.status(201).json({
      _id: user._id,
      email: user.email,
      status: user.status,
      studyMode: application.studyMode,
      class: user.class,
      applicationId: application._id,
      message: successMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('studyLanguage', 'name code').populate('class', 'name section level');

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
        studyLanguage: user.studyLanguage,
        class: user.class,
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

    // If using the default test key, we can simulate a successful transaction initiation
    if (process.env.DIGIPAY_API_KEY === 'dpk_test_einstein' || !process.env.DIGIPAY_API_KEY) {
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

    if (transactionId.startsWith('dp_tx_')) {
      // Sandbox mock
      return res.status(200).json({
        status: 'completed',
        amount: 5000,
        reference: transactionId
      });
    }

    const txn = await getTransactionStatus(transactionId);
    res.status(200).json({
      status: txn.status,
      amount: txn.amount,
      reference: txn.reference
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
      .populate('studyLanguage', 'name code')
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
