const express = require('express');
const router = express.Router();
const {
  createVideoController,
  addMarkerToVideoController,
  updateMarkerInVideoController,
  deleteMarkerFromVideoController,
  getVideoByIdController
} = require('../controllers/videoController');
const { isAuth, roleCheck } = require('../middleware/auth');
const courseManagers = ['SystemAdmin', 'InstituteAdmin', 'Teacher'];

router.post('/', isAuth, roleCheck(courseManagers), createVideoController);
router.get('/:videoId', isAuth, getVideoByIdController);
router.post('/:videoId/markers', isAuth, roleCheck(courseManagers), addMarkerToVideoController);
router.patch('/:videoId/markers/:markerId', isAuth, roleCheck(courseManagers), updateMarkerInVideoController);
router.delete('/:videoId/markers/:markerId', isAuth, roleCheck(courseManagers), deleteMarkerFromVideoController);

module.exports = router;
