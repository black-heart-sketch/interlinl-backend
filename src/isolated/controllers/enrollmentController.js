const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Section = require('../models/Section');
const User = require('../models/User');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');
const { buildWebhookUrl, getTransactionStatus, initiatePayIn } = require('../utils/digipay');

const computeSectionPrice = (course, section, paidSectionCount = 0) => {
  const explicitPrice = Number(section?.priceIfLocked || 0);
  if (explicitPrice > 0) return explicitPrice;

  const coursePrice = Number(course?.price || 0);
  if (!coursePrice) return 0;

  const divisor = paidSectionCount || Math.max(1, course?.sections?.length || 1);
  return Number((coursePrice / divisor).toFixed(2));
};

const levelPriority = { 'none': 0, 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };

const isExempted = (user, course) => {
  if (!user || user.studyMode !== 'on_site') return false;
  if (!course || !course.level || course.level === 'none') return false;

  const userLevelVal = levelPriority[user.registeredLevel] || 0;
  const courseLevelVal = levelPriority[course.level] || 0;

  return userLevelVal >= courseLevelVal;
};

const createEnrollmentController = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }
 
    const existingEnrollment = await Enrollment.findOne({ user: userId, course: courseId });
    if (existingEnrollment) {
      if (existingEnrollment.status === 'active') {
        return res.status(200).json({ message: 'Already enrolled and active.', enrollment: existingEnrollment });
      }
      return res.status(409).json({ message: 'You are already processed for this course.', enrollment: existingEnrollment });
    }

    const user = await User.findById(userId);
    const isUserExempted = isExempted(user, course);

    const isPremium = course.plan === 'Premium';
    const isFreemium = course.plan === 'Freemium';
    const isPerChapter = course.paymentType === 'per_chapter';

    let newEnrollmentData = {
      user: userId,
      course: courseId,
      status: isUserExempted ? 'active' : (isPremium && !isPerChapter ? 'pending_payment' : 'active'),
      accessLevel: isUserExempted ? 'full' : (isFreemium || isPerChapter ? 'preview' : (isPremium ? 'preview' : 'full')),
      paidSections: [],
      pendingSectionPayments: [],
      progress: {
        completedVideos: [],
        completedSections: [],
        completedNotions: [],
        overallPercentage: 0
      }
    };
    
    const enrollment = new Enrollment(newEnrollmentData);
    await enrollment.save();

    const message = isUserExempted
      ? 'Successfully enrolled with full access (exempted as an on-site student)!'
      : (isPremium
        ? 'Payment request created. Your course will unlock after payment confirmation.'
        : isFreemium
          ? 'Enrolled for free preview content. Full access requires payment confirmation.'
          : 'Successfully enrolled!');

    res.status(201).json({ message, enrollment });
  } catch (error) {
    console.error("Error creating enrollment:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Enrollment record already exists for this user and course.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error during enrollment.' });
  }
};

const getMyEnrollmentsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const enrollments = await Enrollment.find({ user: userId })
      .populate({
        path: 'course',
        select: 'title thumbnail category difficulty plan price paymentType status sections',
        populate: { path: 'instructor', select: 'firstName lastName' }
      })
      .sort({ enrollmentDate: -1 });

    res.status(200).json(enrollments);
  } catch (error) {
    console.error("Error fetching user's enrollments:", error);
    res.status(500).json({ message: 'Server error while fetching enrollments.' });
  }
};

const getEnrollmentStatusForCourseController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }

    const course = await Course.findById(courseId).select('plan paymentType level');
    const enrollment = await Enrollment.findOne({ user: userId, course: courseId });

    if (enrollment) {
      const user = await User.findById(userId);
      const isUserExempted = isExempted(user, course);

      const plan = course?.plan || 'Free';
      const hasFullAccess = plan === 'Free'
        || isUserExempted
        || enrollment.accessLevel === 'full'
        || enrollment.status === 'completed'
        || (enrollment.status === 'active' && enrollment.accessLevel !== 'preview');

      res.status(200).json({
        isEnrolled: true,
        isPaid: hasFullAccess,
        status: enrollment.status,
        accessLevel: enrollment.accessLevel,
        enrollmentId: enrollment._id,
        paidSections: enrollment.paidSections || [],
        pendingSectionPayments: enrollment.pendingSectionPayments || [],
        paymentType: course?.paymentType,
        progress: enrollment.progress
      });
    } else {
      res.status(200).json({
        isEnrolled: false,
        isPaid: false,
        status: null,
        paidSections: [],
        pendingSectionPayments: []
      });
    }
  } catch (error) {
    console.error("Error fetching enrollment status:", error);
    res.status(500).json({ message: 'Server error while fetching enrollment status.' });
  }
};

const updateEnrollmentProgressController = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;
    const { videoId, sectionId, notionId, completedPercentage } = req.body;

    if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: 'Invalid Enrollment ID.' });
    }
    
    const enrollment = await Enrollment.findOne({ _id: enrollmentId, user: userId });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found for this user.' });
    }

    if (videoId && !enrollment.progress.completedVideos.some(id => id.toString() === videoId.toString())) {
      enrollment.progress.completedVideos.push(videoId);
    }
    if (sectionId && !enrollment.progress.completedSections.some(id => id.toString() === sectionId.toString())) {
      enrollment.progress.completedSections.push(sectionId);
    }
    if (notionId && !enrollment.progress.completedNotions.some(id => id.toString() === notionId.toString())) {
      enrollment.progress.completedNotions.push(notionId);
    }
    if (completedPercentage !== undefined) {
      enrollment.progress.overallPercentage = Math.max(enrollment.progress.overallPercentage, completedPercentage);
      if (enrollment.progress.overallPercentage >= 100) {
        enrollment.status = 'completed';
      }
    }
    
    await enrollment.save();
    res.status(200).json({ message: 'Progress updated.', enrollment });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ message: 'Server error while updating progress.' });
  }
};

const requestSectionAccessController = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { sectionId } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(enrollmentId) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid enrollment or chapter ID.' });
    }

    const enrollment = await Enrollment.findOne({ _id: enrollmentId, user: userId });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found for this user.' });
    }

    const course = await Course.findById(enrollment.course).populate('sections', 'isLocked isPreviewable priceIfLocked');
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const section = await Section.findOne({ _id: sectionId, course: course._id });
    if (!section) {
      return res.status(404).json({ message: 'Chapter not found for this course.' });
    }

    if (course.paymentType !== 'per_chapter') {
      return res.status(400).json({ message: 'This course requires full-course payment, not chapter-by-chapter payment.' });
    }

    const user = await User.findById(userId);
    const isUserExempted = isExempted(user, course);

    if (isUserExempted || !section.isLocked || section.isPreviewable || enrollment.accessLevel === 'full') {
      if (!enrollment.paidSections.some(id => id.toString() === sectionId.toString())) {
        enrollment.paidSections.push(sectionId);
        await enrollment.save();
      }
      return res.status(200).json({ message: 'Chapter is already available.', enrollment });
    }

    const existingPending = enrollment.pendingSectionPayments.find(item => (
      item.section?.toString() === sectionId.toString() && item.status === 'pending'
    ));
    if (existingPending) {
      return res.status(200).json({ message: 'Chapter payment request is already pending.', enrollment });
    }

    const paidSectionCount = (course.sections || []).filter(item => item.isLocked && !item.isPreviewable).length;
    const amount = computeSectionPrice(course, section, paidSectionCount);

    if (amount <= 0) {
      enrollment.paidSections.push(sectionId);
      await enrollment.save();
      return res.status(200).json({ message: 'Chapter unlocked.', enrollment });
    }

    enrollment.pendingSectionPayments.push({
      section: sectionId,
      amount,
      status: 'pending',
      requestedAt: new Date()
    });

    await enrollment.save();
    res.status(201).json({
      message: 'Chapter payment request created. Access will unlock after payment confirmation.',
      amount,
      enrollment
    });
  } catch (error) {
    console.error("Error requesting chapter access:", error);
    res.status(500).json({ message: 'Server error while requesting chapter access.' });
  }
};

const initiateCoursePaymentController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { phone } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const user = await User.findById(userId);
    const isUserExempted = isExempted(user, course);
    if (isUserExempted || course.plan === 'Free' || Number(course.price || 0) <= 0) {
      const enrollment = await Enrollment.findOneAndUpdate(
        { user: userId, course: courseId },
        { user: userId, course: courseId, status: 'active', accessLevel: 'full' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.status(200).json({ message: 'Course unlocked.', enrollment, alreadyPaid: true });
    }

    const customerPhone = phone || user?.phone;
    if (!customerPhone) {
      return res.status(400).json({ message: 'Phone number is required for Mobile Money payment.' });
    }

    let enrollment = await Enrollment.findOne({ user: userId, course: courseId });
    if (!enrollment) {
      enrollment = await Enrollment.create({
        user: userId,
        course: courseId,
        status: 'pending_payment',
        accessLevel: 'preview',
        paidSections: [],
        pendingSectionPayments: [],
        progress: {
          completedVideos: [],
          completedSections: [],
          completedNotions: [],
          overallPercentage: 0
        }
      });
    }

    if (enrollment.accessLevel === 'full') {
      return res.status(200).json({ message: 'Course already unlocked.', enrollment, alreadyPaid: true });
    }

    const amount = Number(course.price || 0);
    const payin = await initiatePayIn({
      amount,
      customerPhone,
      customerEmail: user.email,
      metadata: {
        purpose: 'course',
        courseId: String(course._id),
        enrollmentId: String(enrollment._id),
        userId: String(user._id)
      },
      webhookUrl: buildWebhookUrl(req)
    });

    await Payment.findOneAndUpdate(
      { reference: payin.transactionId },
      {
        studentId: userId,
        courseId,
        enrollmentId: enrollment._id,
        purpose: 'course',
        amount,
        currency: 'XAF',
        method: 'mobile_money',
        status: 'pending',
        reference: payin.transactionId
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      transactionId: payin.transactionId,
      amount,
      currency: 'XAF',
      courseTitle: course.title,
      enrollmentId: enrollment._id,
      message: 'DigiPay course payment initiated successfully.'
    });
  } catch (error) {
    console.error('Error initiating course payment:', error);
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

const getCoursePaymentStatusController = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    let txn;
    if (transactionId.startsWith('dp_tx_')) {
      txn = { status: 'completed', amount: 0, reference: transactionId };
    } else {
      txn = await getTransactionStatus(transactionId);
    }

    const txnStatus = String(txn?.status || '').toLowerCase();
    const payment = await Payment.findOne({ reference: transactionId, studentId: userId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });

    if (['completed', 'success', 'successful'].includes(txnStatus)) {
      payment.status = 'completed';
      await payment.save();

      const enrollment = await Enrollment.findOneAndUpdate(
        { _id: payment.enrollmentId, user: userId },
        { status: 'active', accessLevel: 'full' },
        { new: true }
      );

      return res.status(200).json({
        status: 'completed',
        amount: txn.amount || payment.amount,
        reference: transactionId,
        courseId: payment.courseId,
        enrollment
      });
    }

    if (['failed', 'cancelled', 'canceled', 'expired'].includes(txnStatus)) {
      payment.status = 'failed';
      await payment.save();
      return res.status(200).json({ status: 'failed', amount: txn.amount || payment.amount, reference: transactionId });
    }

    res.status(200).json({ status: txn.status || 'pending', amount: txn.amount || payment.amount, reference: transactionId });
  } catch (error) {
    console.error('Error fetching course payment status:', error);
    res.status(error.statusCode || 500).json({ message: error.message, details: error.rawResponse });
  }
};

module.exports = { 
  createEnrollmentController,
  getCoursePaymentStatusController,
  getMyEnrollmentsController,
  getEnrollmentStatusForCourseController,
  initiateCoursePaymentController,
  updateEnrollmentProgressController,
  requestSectionAccessController
};
