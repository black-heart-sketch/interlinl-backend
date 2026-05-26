const express = require('express');
const router = express.Router();
const {
  getSectionByIdController,
  updateSectionByIdController,
  deleteSectionByIdController,
  getVideosForSectionController,
  addOrUpdateVideoInSectionController,
  deleteVideoFromSection,
  updateSectionPublishedStatusController
} = require('../controllers/sectionController');
const { isAuth, roleCheck } = require('../middleware/auth');
const courseManagers = ['SystemAdmin', 'InstituteAdmin', 'Teacher'];

router.get('/:sectionId', isAuth, getSectionByIdController);
router.put('/:sectionId', isAuth, roleCheck(courseManagers), updateSectionByIdController);
router.delete('/:sectionId', isAuth, roleCheck(courseManagers), deleteSectionByIdController);
router.patch('/:sectionId/publish', isAuth, roleCheck(courseManagers), updateSectionPublishedStatusController);

router.get('/:sectionId/videos', isAuth, getVideosForSectionController);
router.put('/:sectionId/videos', isAuth, roleCheck(courseManagers), addOrUpdateVideoInSectionController);
router.delete('/:sectionId/videos/:videoId', isAuth, roleCheck(courseManagers), deleteVideoFromSection);

module.exports = router;
