const Event = require('../models/Event');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

exports.createEvent = async (req, res) => {
  try {
    const eventData = { ...req.body };

    // Prevent Mongoose CastError for empty dates
    if (eventData.endDate === '') delete eventData.endDate;
    if (eventData.date === '') delete eventData.date;

    // Prevent Mongoose CastError for numbers
    if (eventData.capacity === '') eventData.capacity = 0;
    if (eventData.attendees === '') eventData.attendees = 0;

    // Force cleanup of weird object or empty image
    if (eventData.image && typeof eventData.image === 'object') {
       delete eventData.image;
    }
    if (eventData.image === '') {
       delete eventData.image;
    }

    if (req.body.speakers && typeof req.body.speakers === 'string') {
      eventData.speakers = JSON.parse(req.body.speakers);
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/events');

      const imageFile = req.processedFiles.find(f => f.fieldName === 'image');
      if (imageFile) {
        const finalPath = path.join(finalDir, imageFile.fileName);
        await moveFile(imageFile.path, finalPath);
        eventData.image = `/events/${imageFile.fileName}`;

        // Move generated thumbnail if it exists
        if (imageFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, imageFile.thumbnailFilename);
          await moveFile(imageFile.thumbnailPath, finalThumbPath);
        }
      }

      const speakerImages = req.processedFiles.filter(f => f.fieldName === 'speakerImages');
      for (const sFile of speakerImages) {
        const finalPath = path.join(finalDir, sFile.fileName);
        await moveFile(sFile.path, finalPath);

        // Move generated thumbnail if it exists
        if (sFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, sFile.thumbnailFilename);
          await moveFile(sFile.thumbnailPath, finalThumbPath);
        }
      }

      // Assign URLs to speakers based on parsed data
      if (eventData.speakers && speakerImages.length > 0) {
          let imgIdx = 0;
          eventData.speakers.forEach(speaker => {
             if (speaker.needsImageUpload && imgIdx < speakerImages.length) {
                speaker.image = `/events/${speakerImages[imgIdx].fileName}`;
                imgIdx++;
             }
          });
      }
    }

    const event = await Event.create(eventData);
    await translationService.invalidateCache('event');
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    
    const lang = req.query.lang;
    const typeFilter = req.query.type || 'all';
    const cacheKey = `events:${typeFilter}`;

    const events = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Event.find(filter).sort({ date: -1 })
    );
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    await translationService.invalidateCache('event');
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const eventData = { ...req.body };

    if (eventData.endDate === '') delete eventData.endDate;
    if (eventData.date === '') delete eventData.date;
    if (eventData.capacity === '') eventData.capacity = 0;
    if (eventData.attendees === '') eventData.attendees = 0;
    if (eventData.image && typeof eventData.image === 'object') delete eventData.image;
    if (eventData.image === '') delete eventData.image;

    if (req.body.speakers && typeof req.body.speakers === 'string') {
      eventData.speakers = JSON.parse(req.body.speakers);
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/events');

      const imageFile = req.processedFiles.find(f => f.fieldName === 'image');
      if (imageFile) {
        const finalPath = path.join(finalDir, imageFile.fileName);
        await moveFile(imageFile.path, finalPath);
        eventData.image = `/events/${imageFile.fileName}`;

        // Move generated thumbnail if it exists
        if (imageFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, imageFile.thumbnailFilename);
          await moveFile(imageFile.thumbnailPath, finalThumbPath);
        }
      }

      const speakerImages = req.processedFiles.filter(f => f.fieldName === 'speakerImages');
      for (const sFile of speakerImages) {
        const finalPath = path.join(finalDir, sFile.fileName);
        await moveFile(sFile.path, finalPath);

        // Move generated thumbnail if it exists
        if (sFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, sFile.thumbnailFilename);
          await moveFile(sFile.thumbnailPath, finalThumbPath);
        }
      }

      if (eventData.speakers && speakerImages.length > 0) {
          let imgIdx = 0;
          eventData.speakers.forEach(speaker => {
             if (speaker.needsImageUpload && imgIdx < speakerImages.length) {
                speaker.image = `/events/${speakerImages[imgIdx].fileName}`;
                imgIdx++;
             }
          });
      }
    }

    const event = await Event.findByIdAndUpdate(req.params.id, eventData, { new: true });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await translationService.invalidateCache('event');
    res.status(200).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
