const express = require('express');
const { uploadVideoToVimeo } = require('../controllers/uploadController');
const { upload } = require('../middleware/videoUpload');
const { isAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', isAuth, upload.single('video'), uploadVideoToVimeo);

module.exports = router;
