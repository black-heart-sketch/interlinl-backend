const Video = require('../models/Video');
const mongoose = require('mongoose');
const translationService = require('../services/translationService');

const createVideoController = async (req, res) => {
  try {
    console.log('Adding video to the DB');
    const { vimeoVideoId, title, description, duration } = req.body;

    if (!vimeoVideoId || !title) {
      return res.status(400).json({ message: "VimeoVideoId and Title are required." });
    }

    const existingVideo = await Video.findOne({ vimeoVideoId });
    if (existingVideo) {
      return res.status(409).json({ message: 'Video with this Vimeo ID already exists.', video: existingVideo });
    }

    const video = new Video({ 
      vimeoVideoId, 
      title, 
      description, 
      duration, 
      markers: []
    });
    const savedVideo = await video.save();

    await translationService.invalidateCache('course');
    res.status(201).json(savedVideo);
  } catch (error) {
    console.error('Error creating video:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while creating video.' });
  }
};

const addMarkerToVideoController = async (req, res) => {
  console.log('Adding Video Marker');
  try {
    const { videoId } = req.params;
    const { time, title, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid Video ID format.' });
    }
    if (time === undefined || !title || description === undefined) {
      return res.status(400).json({ message: 'Marker time, title, and description are required.' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    const newMarker = { time, title, description };
    video.markers.push(newMarker);
    await video.save();

    const addedMarkerWithId = video.markers[video.markers.length - 1];

    await translationService.invalidateCache('course');
    res.status(201).json(addedMarkerWithId);
    console.log('Marker Added Successfully!');
  } catch (error) {
    console.error('Error adding marker to video:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while adding marker.' });
  }
};

const updateMarkerInVideoController = async (req, res) => {
  try {
    const { videoId, markerId } = req.params;
    const { time, title, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(markerId)) {
      return res.status(400).json({ message: 'Invalid Video or Marker ID format.' });
    }
    if (time === undefined || !title || description === undefined) {
      return res.status(400).json({ message: 'Marker time, title, and description are required.' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    const marker = video.markers.id(markerId);
    if (!marker) {
      return res.status(404).json({ message: 'Marker not found on this video.' });
    }

    marker.time = time;
    marker.title = title;
    marker.description = description;
    await video.save();

    await translationService.invalidateCache('course');
    return res.status(200).json(marker);
  } catch (error) {
    console.error('Error updating marker on video:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while updating marker.' });
  }
};

const deleteMarkerFromVideoController = async (req, res) => {
  try {
    const { videoId, markerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(markerId)) {
      return res.status(400).json({ message: 'Invalid Video or Marker ID format.' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    const markerExists = video.markers.some(marker => marker._id.equals(markerId));
    if (!markerExists) {
      return res.status(404).json({ message: 'Marker not found on this video.' });
    }

    video.markers.pull({ _id: markerId });
    await video.save();

    await translationService.invalidateCache('course');
    res.status(200).json({ message: 'Marker deleted successfully.', video });
  } catch (error) {
    console.error('Error deleting marker from video:', error);
    return res.status(500).json({ message: 'Server error while deleting marker.' });
  }
};

const getVideoByIdController = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid Video ID format.' });
    }
    const video = await Video.findById(videoId).populate('section', 'title');
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }
    return res.status(200).json(video);
  } catch (error) {
    console.error('Error fetching video by ID:', error);
    return res.status(500).json({ message: 'Server error while fetching video.' });
  }
};

module.exports = {
  createVideoController,
  addMarkerToVideoController,
  updateMarkerInVideoController,
  deleteMarkerFromVideoController,
  getVideoByIdController
};
