const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Accept video files only
const fileFilter = (req, file, cb) => {
  const allowedMimetypes = /video\/(mp4|webm|quicktime|x-msvideo|x-matroska|ogg)|application\/octet-stream/;
  if (allowedMimetypes.test(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|avi|mkv|ogv)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are accepted (MP4, WebM, MOV, AVI, MKV).'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

module.exports = { upload };
