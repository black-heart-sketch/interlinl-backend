const Section = require('../models/Section');
const Course = require('../models/Course');
const Video = require('../models/Video');
const vimeoClient = require('../config/vimeoClient');
const mongoose = require('mongoose');
const translationService = require('../services/translationService');

const getSectionByIdController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }

    const section = await Section.findById(sectionId)
      .populate('videos')
      .populate('course', 'title courseCode')
      .select('-__v')
      .lean();

    if (!section) {
      return res.status(404).json({ message: 'Section not found.' });
    }
    return res.status(200).json(section);
  } catch (error) {
    console.error('Error fetching section by ID:', error);
    return res.status(500).json({ message: 'Server error while fetching section.' });
  }
};

const updateSectionByIdController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }

    let { title, description, isLocked, isPreviewable, priceIfLocked, order, course, videos, resources, videoTranscript } = req.body;

    if (resources && typeof resources === 'string') {
      try {
        resources = JSON.parse(resources);
      } catch (e) {
        console.warn('Could not parse resources string:', e.message);
      }
    }

    if (typeof videoTranscript === 'string') {
      const transcriptName = videoTranscript.trim();
      videoTranscript = transcriptName
        ? {
            name: transcriptName,
            type: 'document'
          }
        : undefined;
    }
    
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ message: 'Section title cannot be empty.' });
    }

    const updateData = { title, description, isLocked, isPreviewable, priceIfLocked, order, course, videos, resources, videoTranscript };

    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided.' });
    }

    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('videos');

    if (!updatedSection) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    await translationService.invalidateCache('course');
    return res.status(200).json(updatedSection);
  } catch (error) {
    console.error('Error updating section:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while updating section.' });
  }
};

const deleteSectionByIdController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    await Course.findByIdAndUpdate(
      section.course,
      { $pull: { sections: sectionId } }
    );

    await Video.deleteMany({ section: sectionId });
    await Section.findByIdAndDelete(sectionId);

    await translationService.invalidateCache('course');
    return res.status(200).json({ message: 'Section and associated videos deleted successfully.' });
  } catch (error) {
    console.error('Error deleting section:', error);
    return res.status(500).json({ message: 'Server error while deleting section.' });
  }
};

const getVideosForSectionController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }

    const videos = await Video.find({ section: sectionId });
    return res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos for section:', error);
    return res.status(500).json({ message: 'Server error while fetching videos.' });
  }
};

const addOrUpdateVideoInSectionController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { vimeoVideoId, title, description, duration, markers = [], thumbnailUrl, url } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }
    if (!vimeoVideoId || !title) {
      return res.status(400).json({ message: 'VimeoVideoId and Title are required for the video.' });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    let video = await Video.findOne({ vimeoVideoId: vimeoVideoId, section: sectionId });
    if (!video) {
      video = await Video.findOne({ vimeoVideoId });
    }

    if (video) {
      const previousSectionId = video.section?.toString();
      video.title = title;
      video.thumbnailUrl = thumbnailUrl === undefined ? video.thumbnailUrl : thumbnailUrl;
      video.url = url === undefined ? video.url : url;
      video.description = description === undefined ? video.description : description;
      video.duration = duration === undefined ? video.duration : duration;
      video.markers = markers === undefined ? video.markers : markers;
      video.section = sectionId;
      if (previousSectionId && previousSectionId !== sectionId) {
        await Section.findByIdAndUpdate(previousSectionId, { $pull: { videos: video._id } });
      }
    } else {
      video = new Video({
        vimeoVideoId,
        title,
        thumbnailUrl,
        url,
        description,
        duration,
        markers,
        section: sectionId
      });
    }
    
    const savedVideo = await video.save();

    if (!section.videos.some((videoId) => videoId.toString() === savedVideo._id.toString())) {
      section.videos.push(savedVideo._id);
      await section.save();
    }
    
    await translationService.invalidateCache('course');
    return res.status(200).json(savedVideo);
  } catch (error) {
    console.error('Error upserting video in section:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while upserting video.' });
  }
};

const deleteVideoFromSection = async (req, res) => {
  const { sectionId, videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: 'Invalid Section or Video ID.' });
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    if (video.section.toString() !== sectionId) {
      return res.status(400).json({ message: 'Video does not belong to this section.' });
    }

    if (video.vimeoVideoId) {
      await new Promise((resolve) => {
        vimeoClient.request({
          method: 'DELETE',
          path: `/videos/${video.vimeoVideoId}`
        }, (error) => {
          if (error) {
            console.error('Error deleting video from Vimeo:', error);
          }
          resolve();
        });
      });
    }

    await Video.findByIdAndDelete(videoId);
    await Section.findByIdAndUpdate(sectionId, { $pull: { videos: videoId } });
    
    await translationService.invalidateCache('course');
    res.status(200).json({ message: 'Video deleted successfully.' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: 'Server error while deleting video.' });
  }
};

const updateSectionPublishedStatusController = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { published } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: 'Invalid Section ID format.' });
    }

    if (typeof published !== 'boolean') {
      return res.status(400).json({ message: 'Published status must be a boolean.' });
    }

    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      { $set: { published: published } },
      { new: true, runValidators: true }
    );

    if (!updatedSection) {
      return res.status(404).json({ message: 'Section not found.' });
    }
    
    await translationService.invalidateCache('course');
    res.status(200).json(updatedSection);
  } catch (error) {
    console.error('Error updating section published status:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error while updating section published status.' });
  }
};

module.exports = {
  getSectionByIdController,
  updateSectionByIdController,
  deleteSectionByIdController,
  getVideosForSectionController,
  addOrUpdateVideoInSectionController,
  deleteVideoFromSection,
  updateSectionPublishedStatusController
};
