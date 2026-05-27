const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const { AccessToken } = require('livekit-server-sdk');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { notifyMany } = require('../services/notificationService');

// In a real app, these should be in process.env
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-key';
// For self-hosted docker, we can generate them or use defaults
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

exports.getLiveClasses = async (req, res) => {
  try {
    const userRole = String(req.user?.role || 'student').toLowerCase();
    const isAdmin = ['superadmin', 'admin', 'systemadmin', 'instituteadmin'].includes(userRole);
    const isTeacher = userRole === 'teacher';
    const filter = {};

    if (req.query.meetingId) filter.meetingId = req.query.meetingId;
    if (req.query.studyLanguage) filter.studyLanguage = req.query.studyLanguage;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    if (!isAdmin && !req.query.meetingId) {
      const access = [{ audience: 'all_users' }];
      if (req.user.studyLanguage) access.push({ audience: 'study_language', studyLanguage: req.user.studyLanguage });
      if (isTeacher) access.push({ teacher: req.user._id });
      access.push({ audience: 'internship_pair', participants: req.user._id });
      filter.$or = access;
    }

    const classes = await LiveClass.find(filter)
      .populate('teacher', 'firstName lastName email')
      .populate('participants', 'firstName lastName email role avatar')
      .populate('studyLanguage', 'name code')
      .sort({ scheduledStartTime: 1 });
      
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createLiveClass = async (req, res) => {
  try {
    const { title, description, type = 'course', audience = 'study_language', studyLanguage, teacher, scheduledStartTime, scheduledEndTime, participants = [] } = req.body;

    if (audience === 'study_language' && !studyLanguage) {
      return res.status(400).json({ message: 'Study language is required for language-specific sessions.' });
    }
    if (audience === 'internship_pair' && (!Array.isArray(participants) || participants.length === 0)) {
      return res.status(400).json({ message: 'Participants are required for internship video sessions.' });
    }

    if (new Date(scheduledEndTime) <= new Date(scheduledStartTime)) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }
    
    // Generate a unique meeting ID (e.g., lc_abcdef1234)
    const meetingId = `lc_${Math.random().toString(36).substring(2, 10)}`;

    const newClass = await LiveClass.create({
      title,
      description,
      type,
      audience,
      studyLanguage: audience === 'study_language' ? studyLanguage : undefined,
      teacher: type === 'course' ? (teacher || req.user._id) : (teacher || undefined),
      participants: audience === 'internship_pair' ? participants : [],
      scheduledStartTime,
      scheduledEndTime,
      meetingId,
      status: 'scheduled'
    });

    // TODO: Send notifications/emails to all students with matching studyLanguage
    // For now, we simulate this logging
    console.log(`[Notification] Scheduled new class: ${title} for language ${studyLanguage}`);

    if (audience === 'internship_pair') {
      await notifyMany(participants.map((recipient) => ({
        recipient,
        actor: req.user._id,
        type: 'video-call',
        title: 'Video session scheduled',
        message: title,
        link: `/live/${meetingId}`,
      })));
    }

    res.status(201).json(newClass);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateLiveClass = async (req, res) => {
  try {
    if (req.body.audience === 'study_language' && !req.body.studyLanguage) {
      return res.status(400).json({ message: 'Study language is required for language-specific sessions.' });
    }
    if (req.body.audience === 'internship_pair' && (!Array.isArray(req.body.participants) || req.body.participants.length === 0)) {
      return res.status(400).json({ message: 'Participants are required for internship video sessions.' });
    }
    if (req.body.scheduledStartTime && req.body.scheduledEndTime && new Date(req.body.scheduledEndTime) <= new Date(req.body.scheduledStartTime)) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }
    if (req.body.audience === 'all_users') req.body.studyLanguage = undefined;
    if (req.body.audience !== 'internship_pair') req.body.participants = [];
    const updated = await LiveClass.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Live class not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteLiveClass = async (req, res) => {
  try {
    const deleted = await LiveClass.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Live class not found' });
    res.status(200).json({ message: 'Live class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate LiveKit token for a student or teacher to join
exports.getJoinToken = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const user = req.user; // from protect middleware

    const liveClass = await LiveClass.findOne({ meetingId });
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    // Security Check: Ensure the user belongs to the right studyLanguage or is an admin/the teacher
    const userRole = String(user.role || 'student').toLowerCase();
    const isTeacher = liveClass.teacher && liveClass.teacher.toString() === user._id.toString();
    const isAdmin = ['superadmin', 'admin', 'systemadmin', 'instituteadmin'].includes(userRole);
    const isAllUsers = liveClass.audience === 'all_users';
    const isParticipant = (liveClass.participants || []).some((participant) => participant.toString() === user._id.toString());
    const isStudentInLang = liveClass.studyLanguage && user.studyLanguage && user.studyLanguage.toString() === liveClass.studyLanguage.toString();

    if (!isTeacher && !isAdmin && !isAllUsers && !isStudentInLang && !isParticipant) {
      return res.status(403).json({ message: 'You do not have access to this scheduled session' });
    }

    const now = new Date();
    const opensAt = new Date(new Date(liveClass.scheduledStartTime).getTime() - 15 * 60 * 1000);
    const closesAt = new Date(liveClass.scheduledEndTime);
    if (!isAdmin && (now < opensAt || now > closesAt)) {
      return res.status(403).json({ message: 'This room is only available from 15 minutes before start time until the scheduled end time.' });
    }

    // Create LiveKit token
    const participantName = `${user.firstName} ${user.lastName}`;
    
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user._id.toString(),
      name: participantName,
    });
    
    // Teachers have full control over the room, students can only publish/subscribe
    at.addGrant({ 
      roomJoin: true, 
      room: meetingId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true, // required for raising hand
      roomAdmin: isTeacher || isAdmin // Teacher can mute others, kick, etc.
    });

    const token = await at.toJwt();

    res.status(200).json({ 
      token, 
      meetingId, 
      url: process.env.LIVEKIT_URL || 'ws://localhost:7880' 
    });

  } catch (error) {
    console.error('LiveKit Token Error:', error);
    res.status(500).json({ message: 'Failed to generate connection token' });
  }
};

// Generate LiveKit token for Lounge rooms (Always-on)
exports.getLoungeToken = async (req, res) => {
  try {
    const { roomId } = req.params;
    const user = req.user; // from protect middleware

    // Security Check
    const userRole = user.role || 'student';
    const isAdmin = ['systemadmin', 'instituteadmin', 'superadmin', 'admin'].includes(userRole.toLowerCase());

    if (!isAdmin) {
      return res.status(403).json({ message: 'Study lounges are now limited to administrators. Please use the scheduled online course calendar.' });
    }
    
    if (roomId !== 'lounge-global') {
      // It's a language-specific lounge. Expected format: lounge-<languageId>
      const languageId = roomId.replace('lounge-', '');
      // Check if user is enrolled in this language (or is admin)
      const isStudentInLang = user.studyLanguage && user.studyLanguage.toString() === languageId;
      
      if (!isAdmin && !isStudentInLang) {
         return res.status(403).json({ message: 'You do not have access to this language lounge' });
      }
    }

    // Create LiveKit token
    const participantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous Student';
    
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user._id.toString(),
      name: participantName,
    });
    
    // Everyone can publish and subscribe in lounges
    at.addGrant({ 
      roomJoin: true, 
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isAdmin // Admins get native mute/kick moderation controls
    });

    const token = await at.toJwt();

    res.status(200).json({ 
      token, 
      roomId, 
      url: process.env.LIVEKIT_URL || 'ws://localhost:7880' 
    });

  } catch (error) {
    console.error('LiveKit Lounge Token Error:', error);
    res.status(500).json({ message: 'Failed to generate lounge connection token' });
  }
};

// Transcribe an audio chunk using Groq Whisper API
exports.transcribeAudio = async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // Multer should place the uploaded file in req.file
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const liveClass = await LiveClass.findOne({ meetingId });
    if (!liveClass) return res.status(404).json({ message: 'Live class not found' });

    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path));
    form.append('model', 'whisper-large-v3');

    // Call Groq API
    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${GROQ_API_KEY}`
      }
    });

    const transcribedText = response.data.text;

    // Append to meeting transcript
    liveClass.transcript = liveClass.transcript 
      ? liveClass.transcript + '\n' + transcribedText 
      : transcribedText;
    await liveClass.save();

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.status(200).json({ text: transcribedText });
  } catch (error) {
    console.error('Transcription Error:', error.response?.data || error.message);
    // Cleanup if failed
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Failed to transcribe audio' });
  }
};
