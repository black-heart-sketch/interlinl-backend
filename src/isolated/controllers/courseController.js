const asyncHandler = require('express-async-handler');
const Course = require('../models/Course');
const Section = require('../models/Section');
const Video = require('../models/Video');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs/promises');
const { moveFile } = require('../middleware/multer');
const translationService = require('../services/translationService');

/**
 * Helper function to process and save videos (and their markers)
 */
const processVideos = async (videosData, sectionId) => {
  const videoIds = [];
  for (const videoData of videosData) {
    let video;
    if (videoData._id && !videoData._id.startsWith('temp-')) {
      // Existing video, update it
      video = await Video.findByIdAndUpdate(
        videoData._id,
        {
          vimeoVideoId: videoData.vimeoVideoId,
          title: videoData.title,
          description: videoData.description,
          duration: videoData.duration,
          thumbnailUrl: videoData.thumbnailUrl,
          markers: videoData.markers || []
        },
        { new: true, runValidators: true }
      );
    } else {
      // New video, create it
      video = new Video({
        vimeoVideoId: videoData.vimeoVideoId,
        title: videoData.title,
        description: videoData.description,
        duration: videoData.duration,
        thumbnailUrl: videoData.thumbnailUrl,
        section: sectionId,
        markers: videoData.markers || []
      });
      await video.save();
    }
    videoIds.push(video._id);
  }
  return videoIds;
};

// @desc    Create a new course (Original)
// @route   POST /api/courses
// @access  Private/Admin
const createCourse = asyncHandler(async (req, res) => {
  const { title, description, institute, instructor, studyLanguage } = req.body;
  
  let thumbnail, syllabus;

  if (req.processedFiles) {
    const assetsPath = path.join(__dirname, '../../assets');
    
    if (req.processedFiles.thumbnail) {
      const file = req.processedFiles.thumbnail[0];
      const finalPath = path.join(assetsPath, 'images/courses/thumbnails', file.fileName);
      await moveFile(file.path, finalPath);
      thumbnail = file.fileName;

      if (file.thumbnailPath) {
        const finalThumbPath = path.join(assetsPath, 'images/courses/thumbnails', file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }
    
    if (req.processedFiles.syllabus) {
      const file = req.processedFiles.syllabus[0];
      const finalPath = path.join(assetsPath, 'documents/courses/thumbnails', file.fileName);
      await moveFile(file.path, finalPath);
      syllabus = file.fileName;

      if (file.thumbnailPath) {
        const finalThumbPath = path.join(assetsPath, 'documents/courses/thumbnails', file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }
  }

  const course = await Course.create({
    title,
    description,
    thumbnail,
    syllabus,
    institute,
    instructor,
    studyLanguage
  });

  await translationService.invalidateCache('course');
  res.status(201).json(course);
});

// @desc    Get all courses (Original)
// @route   GET /api/courses
// @access  Public
const getCourses = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = 'courses:all';
  const courses = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Course.find({})
      .populate('institute', 'name')
      .populate('instructor', 'firstName lastName')
      .populate('studyLanguage', 'name')
  );
  res.json(courses);
});

// @desc    Get course by ID (Original)
// @route   GET /api/courses/:id
// @access  Public
const getCourseById = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = `course:${req.params.id}`;
  const course = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Course.findById(req.params.id)
      .populate('institute', 'name')
      .populate('instructor', 'firstName lastName')
      .populate('students', 'firstName lastName')
      .populate('studyLanguage', 'name')
      .populate({
        path: 'sections',
        model: 'Section',
        options: { sort: { order: 1 } },
        populate: {
          path: 'videos',
          model: 'Video'
        }
      })
  );
  
  if (course) {
    res.json(course);
  } else {
    res.status(404);
    throw new Error('Course not found');
  }
});

// @desc    Update course (Original)
// @route   PUT /api/courses/:id
// @access  Private/Admin
const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (course) {
    course.title = req.body.title || course.title;
    course.description = req.body.description || course.description;
    course.institute = req.body.institute || course.institute;
    course.instructor = req.body.instructor || course.instructor;
    course.studyLanguage = req.body.studyLanguage || course.studyLanguage;

    if (req.processedFiles) {
      const assetsPath = path.join(__dirname, '../../assets');
      
      if (req.processedFiles.thumbnail) {
        const file = req.processedFiles.thumbnail[0];
        const finalPath = path.join(assetsPath, 'images/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        course.thumbnail = file.fileName;

        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
      
      if (req.processedFiles.syllabus) {
        const file = req.processedFiles.syllabus[0];
        const finalPath = path.join(assetsPath, 'documents/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        course.syllabus = file.fileName;

        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'documents/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
    }

    const updatedCourse = await course.save();
    await translationService.invalidateCache('course');
    res.json(updatedCourse);
  } else {
    res.status(404);
    throw new Error('Course not found');
  }
});

// @desc    Delete course (Original)
// @route   DELETE /api/courses/:id
// @access  Private/Admin
const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (course) {
    await course.deleteOne();
    await translationService.invalidateCache('course');
    res.json({ message: 'Course removed' });
  } else {
    res.status(404);
    throw new Error('Course not found');
  }
});

// --- NEW CONTROLLERS PORTED FROM WOWINVEST ---

/**
 * Create a new course.
 * Corresponds to: POST /api/courses
 */
const createCourseController = async (req, res) => {
  console.log('Incoming req.body:', req.body);

  try {
    const {
      title,
      plan,
      status,
      price,
      description,
      category,
      image,
      paymentType,
      difficulty,
      instructor,
      institute,
      studyLanguage,
      level
    } = req.body;

    if (!title || !plan || !status || price === undefined) {
      return res.status(400).json({ message: 'Missing required course fields.' });
    }

    const course = new Course({
      title,
      description,
      price,
      category,
      plan,
      thumbnail: image,
      status,
      paymentType,
      difficulty: difficulty || 'All Levels',
      level: level || 'none',
      instructor,
      institute,
      studyLanguage,
      attachments: [],
      sections: []
    });

    const myCourse = await course.save();
    console.log('My course data: ', myCourse);

    await translationService.invalidateCache('course');

    return res.status(201).json(myCourse);
  } catch (error) {
    console.error('Error creating course:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while creating course.' });
  }
};

/**
 * Retrieve all courses.
 * Corresponds to: GET /api/courses (instructor context)
 */
const getAllCoursesController = async (req, res) => {
  console.log('getAllCoursesController called');
  try {
    const { search, category, status, studyLanguage } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (status) query.status = status;
    if (studyLanguage) query.studyLanguage = studyLanguage;

    const courses = await Course.find(query)
      .select('_id courseCode title thumbnail description category plan price status archivedAt difficulty studyLanguage createdAt updatedAt')
      .populate('studyLanguage', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    console.log('Total courses:', courses.length);

    const formattedCourses = courses.map(course => {
      return {
        id: course._id,
        _id: course._id,
        courseCode: course.courseCode,
        title: course.title,
        description: course.description,
        category: course.category,
        price: course.price,
        status: course.status,
        thumbnail: course.thumbnail,
        image: course.thumbnail,
        plan: course.plan,
        difficulty: course.difficulty,
        studyLanguage: course.studyLanguage,
        archivedAt: course.archivedAt || null,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      };
    });
    
    console.log('Done');
    
    return res.status(200).json({
      courses: formattedCourses,
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return res.status(500).json({ message: 'Server error while fetching courses.' });
  }
};

/**
 * Retrieve a single course by its ID.
 * Corresponds to: GET /api/courses/:courseId
 */
const getCourseByIdController = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }

    const course = await Course.findById(courseId)
      .populate({
        path: 'sections',
        model: 'Section',
        options: { sort: { order: 1 } },
        select: '-course -createdAt -updatedAt',
        populate: {
          path: 'videos',
          model: 'Video',
          select: 'vimeoVideoId title description duration thumbnailUrl markers url'
        }
      })
      .populate('instructor', 'firstName lastName email')
      .populate('institute', 'name')
      .select('-__v')
      .lean();

    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (course.attachments && course.attachments.length > 0) {
      course.attachments = course.attachments.map(att => ({
        ...att,
        filePath: `${baseUrl}/assets/documents/courses/${course._id}/${att.name}`,
        size: att.size,
        thumbnailPath: att.thumbnailName ? `${baseUrl}/assets/images/courses/thumbnails/${course._id}/${att.thumbnailName}` : null
      }));
    }

    return res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course by ID:', error);
    return res.status(500).json({ message: 'Server error while fetching course.' });
  }
};

/**
 * Status-only update controller
 */
const updateCourseStatusController = async (req, res) => {
  console.log('Started Status Update');
  
  const { courseId } = req.params;
  const { status, archivedAt } = req.body;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid Course ID format.' });
  }

  try {
    const course = await Course.findByIdAndUpdate(
      courseId,
      { status, archivedAt },
      { new: true, runValidators: true }
    ).select('_id title status archivedAt');

    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await translationService.invalidateCache('course');
    console.log('Done');
    return res.status(200).json(course);
    
  } catch (error) {
    console.error('Error updating course status:', error);
    return res.status(500).json({ message: 'Server error while updating course status.' });
  }
};

/**
 * Basic info update controller
 */
const updateCourseBasicInfoController = async (req, res) => {
  const { courseId } = req.params;
  let {
    title, description, price, category, plan, chapters, attachments, paymentType, difficulty, studyLanguage, institute, instructor, status, archivedAt, level
  } = req.body;
  console.log('Course Update Started');

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid Course ID format.' });
  }

  try {
    if (chapters && typeof chapters === 'string') {
      try {
        chapters = JSON.parse(chapters);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid chapters format. Expected a JSON array.' });
      }
    }
    if (attachments && typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid attachments format. Expected a JSON array.' });
      }
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (price !== undefined) course.price = Number(price) || 0;
    if (category) course.category = category;
    if (plan) course.plan = plan;
    if (paymentType) course.paymentType = paymentType;
    if (difficulty) course.difficulty = difficulty;
    if (studyLanguage) course.studyLanguage = studyLanguage;
    if (institute) course.institute = institute;
    if (instructor) course.instructor = instructor;
    if (status) course.status = status;
    if (archivedAt !== undefined) course.archivedAt = archivedAt || null;
    if (level !== undefined) course.level = level;

    // Only update sections list if chapters array provided — extract ObjectIds
    if (Array.isArray(chapters) && chapters.length > 0) {
      course.sections = chapters.map(c => c._id || c.id || c).filter(Boolean);
    }
    // Update existing attachments list (keep server-uploaded ones, just update metadata)
    if (Array.isArray(attachments)) {
      course.attachments = attachments.map(a => ({
        id: a.id,
        name: a.name,
        thumbnailName: a.thumbnailName || '',
        type: a.type || 'document',
        size: a.size || 0,
        url: a.url || '',
      }));
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const courseDir = path.join(__dirname, '../../assets/documents/courses', course._id.toString());
      const thumbnailDir = path.join(__dirname, '../../assets/images/courses/thumbnails');

      await fs.mkdir(courseDir, { recursive: true });
      await fs.mkdir(thumbnailDir, { recursive: true });

      for (const [index, file] of req.processedFiles.entries()) {
        const { fieldName, path: tempPath, thumbnailPath, fileName, thumbnailFilename, originalName, type, fileSize } = file;

        if (fieldName === 'thumbnail') {
          // Thumbnail image goes to the images/thumbnails folder
          const destPath = path.join(thumbnailDir, fileName);
          await fs.rename(tempPath, destPath);
          if (thumbnailPath && thumbnailFilename) {
            const thumbDestPath = path.join(thumbnailDir, thumbnailFilename);
            await fs.rename(thumbnailPath, thumbDestPath).catch(() => {});
          }
          course.thumbnail = `/assets/images/courses/thumbnails/${fileName}`;
        } else if (fieldName === 'newAttachments') {
          // Course attachments go to documents/courses/:id/
          const destPath = path.join(courseDir, fileName);
          await fs.rename(tempPath, destPath);

          if (!course.attachments) course.attachments = [];

          let fileTypeForSchema = 'document';
          if (type && type.startsWith('image/')) fileTypeForSchema = 'image';
          else if (type && type.startsWith('video/')) fileTypeForSchema = 'video';

          const fileUrl = `/assets/documents/courses/${course._id.toString()}/${fileName}`;
          course.attachments.push({
            id: Date.now() + index,
            name: originalName,
            thumbnailName: thumbnailFilename || '',
            type: fileTypeForSchema,
            size: fileSize,
            url: fileUrl,
          });
        }
      }
    }

    const updatedCourse = await course.save();
    await translationService.invalidateCache('course');
    console.log('Done with the Course update.');
    return res.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Error updating course basic info:', error);
    return res.status(500).json({ message: 'Server error while updating course.' });
  }
};

/**
 * Sections-only update controller
 */
const updateCourseSectionsController = async (req, res) => {
  const { courseId } = req.params;
  const { sections: chapters } = req.body;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid Course ID format.' });
  }

  try {
    const course = await Course.findById(courseId).populate({
      path: 'sections',
      select: '_id title videos order',
      populate: { path: 'videos', select: '_id vimeoVideoId title' }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    if (chapters && Array.isArray(chapters)) {
      course.sections = chapters.map(c => c.id || c._id || c);
      await course.save();
    }

    await translationService.invalidateCache('course');

    const updatedCourse = await Course.findById(courseId)
      .populate({
        path: 'sections',
        options: { sort: { order: 1 } },
        populate: { path: 'videos', select: 'vimeoVideoId title description duration thumbnailUrl markers url' }
      })
      .lean();

    return res.status(200).json(updatedCourse);

  } catch (error) {
    console.error('Error updating course sections:', error);
    return res.status(500).json({ message: 'Server error while updating sections.' });
  }
};

/**
 * Optimized main update controller that handles selective updates
 */
const updateCourseSelectiveController = async (req, res) => {
  const { courseId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid Course ID format.' });
  }

  const {
    title, description, price, category, plan, image, status, attachments, chapters
  } = req.body;

  const hasBasicFields = title || description || price || category || plan || image || status || attachments;
  const hasSections = chapters && chapters.length > 0;

  if (!hasBasicFields && !hasSections) {
    return res.status(400).json({ message: 'No valid update fields provided.' });
  }

  if (Object.keys(req.body).length <= 2 && (status || req.body.archivedAt !== undefined)) {
    return updateCourseStatusController(req, res);
  }

  if (hasBasicFields && !hasSections) {
    return updateCourseBasicInfoController(req, res);
  }

  if (!hasBasicFields && hasSections) {
    return updateCourseSectionsController(req, res);
  }

  return updateCourseController(req, res);
};

/**
 * Update an existing course's metadata, sections, and videos.
 * Corresponds to: PUT /api/courses/:courseId
 */
const updateCourseController = async (req, res) => {
  console.log('Started updateCourseController');

  const { courseId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid Course ID format.' });
  }

  const {
    title, description, price, category, plan, image, status, chapters, attachments, paymentType, difficulty, studyLanguage, institute, instructor, level
  } = req.body;

  try {
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    course.title = title || course.title;
    course.description = description || course.description;
    course.price = price !== undefined ? price : course.price;
    course.category = category || course.category;
    course.plan = plan || course.plan;
    course.paymentType = paymentType || course.paymentType;
    course.difficulty = difficulty || course.difficulty;
    course.thumbnail = image || course.thumbnail;
    course.status = status || course.status;
    course.attachments = attachments || course.attachments;
    course.studyLanguage = studyLanguage || course.studyLanguage;
    course.institute = institute || course.institute;
    course.instructor = instructor || course.instructor;
    if (level !== undefined) course.level = level;

    if (chapters) {
      course.sections = chapters.map(chapter => chapter.id || chapter._id || chapter);
    }

    await course.save();
    await translationService.invalidateCache('course');

    const populatedCourse = await Course.findById(courseId)
      .populate({
        path: 'sections',
        options: { sort: { order: 1 } },
        select: 'title description published isLocked isPreviewable priceIfLocked order videos',
        populate: {
          path: 'videos',
          select: 'vimeoVideoId title description duration thumbnailUrl markers url'
        }
      })
      .populate('instructor', 'firstName lastName email')
      .populate('institute', 'name')
      .lean();

    console.log('Done');
    return res.status(200).json(populatedCourse);

  } catch (error) {
    console.error('Error updating course:', error);
    if (error.name === 'ValidationError' || error.message.includes('Missing required')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while updating course.' });
  }
};

/**
 * Delete a course by its ID.
 * Corresponds to: DELETE /api/courses/:courseId
 */
const deleteCourseController = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('course id to delete:', courseId);
    
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const sections = await Section.find({ course: courseId });
    const sectionIds = sections.map(s => s._id);

    if (sectionIds.length > 0) {
      await Video.deleteMany({ section: { $in: sectionIds } });
      await Section.deleteMany({ _id: { $in: sectionIds } });
    }

    await Course.findByIdAndDelete(courseId);
    await translationService.invalidateCache('course');

    return res.status(200).json({ message: 'Course and all associated content deleted successfully.' });

  } catch (error) {
    console.error('Error deleting course:', error);
    return res.status(500).json({ message: 'Server error while deleting course.' });
  }
};

/**
 * Add a new section to an existing course.
 * Corresponds to: POST /api/courses/:courseId/sections
 */
const addSectionToCourseController = async (req, res) => {
  console.log('Chapter adding starting');
  try {
    const { courseId } = req.params;
    const { title, description, isLocked, isPreviewable, priceIfLocked, order, videoUrl, videoName, duration, thumbnailUrl, mcqs, resourcesData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid Course ID format.' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Section title is required.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const newSection = new Section({
      title,
      description,
      isLocked: isLocked !== undefined ? isLocked : true,
      isPreviewable: isPreviewable !== undefined ? isPreviewable : false,
      priceIfLocked: priceIfLocked || 0,
      order: order || (course.sections.length + 1),
      course: course._id,
      videos: [],
      resources: []
    });

    // Handle attached resource files if any
    const flatFiles = req.processedFiles
      ? (Array.isArray(req.processedFiles)
          ? req.processedFiles
          : Object.values(req.processedFiles).flat())
      : [];

    if (flatFiles.length > 0) {
      const sectionDir = path.join(__dirname, '../../assets/documents/courses', course._id.toString(), newSection._id.toString());
      await fs.mkdir(sectionDir, { recursive: true });

      let parsedResourcesData = [];
      if (resourcesData) {
        try {
          parsedResourcesData = JSON.parse(resourcesData);
        } catch (e) {
          return res.status(400).json({ message: 'Invalid resourcesData format. Expected a JSON array.' });
        }
      }

      for (const file of flatFiles) {
        const { path: tempPath, fileName, originalName, fileSize } = file;
        const finalPath = path.join(sectionDir, fileName);
        await fs.rename(tempPath, finalPath);

        const resourceInfo = parsedResourcesData.find(r => r.name === originalName) || {};
        newSection.resources.push({
          name: originalName,
          type: resourceInfo.type || 'document',
          content: resourceInfo.content || '',
          size: fileSize,
          transcript: resourceInfo.transcript || '',
          url: `/assets/documents/courses/${course._id.toString()}/${newSection._id.toString()}/${fileName}`,
          width: resourceInfo.width,
          videoTranscript: resourceInfo.videoTranscript,
        });
      }
    }

    await newSection.save();

    if (videoUrl) {
      const videoData = {
        vimeoVideoId: videoUrl,
        title: videoName || title,
        description,
        duration,
        thumbnailUrl,
        markers: mcqs
      };
      newSection.videos = await processVideos([videoData], newSection._id, null);
      await newSection.save();
    }

    course.sections.push(newSection._id);
    await course.save();

    await translationService.invalidateCache('course');

    const populatedSection = await Section.findById(newSection._id).populate({
      path: 'videos',
      model: 'Video',
      select: 'vimeoVideoId title description duration thumbnailUrl markers url'
    });
    console.log('Done adding the chapter');
    return res.status(201).json(populatedSection);

  } catch (error) {
    console.error('Error adding section to course:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while adding section.' });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  
  createCourseController,
  getAllCoursesController,
  getCourseByIdController,
  updateCourseController,
  updateCourseStatusController,
  updateCourseBasicInfoController,
  updateCourseSectionsController,
  updateCourseSelectiveController,
  deleteCourseController,
  addSectionToCourseController
};
