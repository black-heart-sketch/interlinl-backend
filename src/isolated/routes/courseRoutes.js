const express = require('express');
const {
  // New full-featured controllers
  createCourseController,
  getAllCoursesController,
  getCourseByIdController,
  updateCourseController,
  updateCourseStatusController,
  updateCourseBasicInfoController,
  deleteCourseController,
  addSectionToCourseController,
} = require('../controllers/courseController');
const { isAuth, roleCheck } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/multer');

const router = express.Router();
const courseManagers = ['SystemAdmin', 'InstituteAdmin', 'Teacher'];

// File upload fields for course creation / update
const courseUploadFields = uploadMultiple([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'newAttachments', maxCount: 10 },
]);

// ── List / Create ──────────────────────────────────────────────────────────────
router.route('/')
  .get(getAllCoursesController)
  .post(
    isAuth,
    roleCheck(courseManagers),
    courseUploadFields,
    createCourseController
  );

// ── Status update (must be before /:id routes to avoid conflicts) ──────────────
router.patch(
  '/:courseId/status',
  isAuth,
  roleCheck(courseManagers),
  updateCourseStatusController
);

// ── Basic-info update (thumbnail + attachments) ────────────────────────────────
router.patch(
  '/:courseId/basic',
  isAuth,
  roleCheck(courseManagers),
  courseUploadFields,
  updateCourseBasicInfoController
);

// ── Add section / chapter to a course ─────────────────────────────────────────
router.post(
  '/:courseId/sections',
  isAuth,
  roleCheck(courseManagers),
  addSectionToCourseController
);

// ── Single-course CRUD ─────────────────────────────────────────────────────────
router.route('/:courseId')
  .get(getCourseByIdController)
  .put(
    isAuth,
    roleCheck(courseManagers),
    courseUploadFields,
    updateCourseController
  )
  .delete(
    isAuth,
    roleCheck(courseManagers),
    deleteCourseController
  );

module.exports = router;
