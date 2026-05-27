const Certificate = require('../models/Certificate');
const Evaluation = require('../models/Evaluation');
const Internship = require('../models/Internship');
const { createNotification } = require('../services/notificationService');

const makeCertificateNumber = () => `IL-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const makeQrSvg = (text) => {
  const cells = Array.from({ length: 49 }, (_, index) => {
    const code = text.charCodeAt(index % text.length) || 0;
    return (code + index) % 3 === 0;
  });
  const rects = cells.map((on, i) => {
    if (!on) return '';
    const x = (i % 7) * 10;
    const y = Math.floor(i / 7) * 10;
    return `<rect x="${x}" y="${y}" width="8" height="8" rx="1" fill="#0f172a"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 70 70"><rect width="70" height="70" rx="6" fill="#fff"/>${rects}</svg>`;
};

const generateCertificate = async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.internshipId).populate('student supervisor', 'firstName lastName email');
    if (!internship) return res.status(404).json({ message: 'Internship not found.' });

    const evaluation = await Evaluation.findOne({ intern: internship.student._id }).sort({ createdAt: -1 });
    const certificateNumber = makeCertificateNumber();
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const verificationUrl = `${baseUrl}/certificate/verify/${certificateNumber}`;

    const certificate = await Certificate.create({
      certificateNumber,
      intern: internship.student._id,
      internship: internship._id,
      evaluation: evaluation?._id,
      department: internship.department,
      finalScore: evaluation?.totalScore || internship.progress || 0,
      issuedBy: req.user._id,
      status: 'pending_manager_approval',
      verificationUrl,
      qrCodeSvg: makeQrSvg(verificationUrl),
    });

    await createNotification({
      recipient: internship.student._id,
      actor: req.user._id,
      type: 'certificate',
      title: 'Certificate generated',
      message: 'Your certificate has been generated and is pending final approval.',
      link: '/dashboard?view=certificates',
    });

    res.status(201).json(certificate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate('intern', 'firstName lastName email avatar')
      .populate('internship')
      .populate('issuedBy approvedBy', 'firstName lastName email');
    if (!certificate) return res.status(404).json({ message: 'Certificate not found.' });
    res.json(certificate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateNumber: req.params.certificateNumber })
      .populate('intern', 'firstName lastName email')
      .populate('internship');
    if (!certificate) return res.status(404).json({ valid: false, message: 'Certificate not found.' });
    res.json({ valid: certificate.status === 'issued', certificate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) return res.status(404).json({ message: 'Certificate not found.' });
    certificate.status = 'issued';
    certificate.approvedBy = req.user._id;
    await certificate.save();
    await Internship.findByIdAndUpdate(certificate.internship, { status: 'completed', progress: 100 });
    await createNotification({
      recipient: certificate.intern,
      actor: req.user._id,
      type: 'certificate',
      title: 'Certificate approved',
      message: `Certificate ${certificate.certificateNumber} is now verified.`,
      link: `/certificate/verify/${certificate.certificateNumber}`,
    });
    res.json(certificate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listCertificates = async (req, res) => {
  try {
    const filter = {};
    if (String(req.user.role).toLowerCase() === 'student') filter.intern = req.user._id;
    const certificates = await Certificate.find(filter).populate('intern', 'firstName lastName email').sort({ createdAt: -1 });
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateCertificate, getCertificate, verifyCertificate, approveCertificate, listCertificates };
