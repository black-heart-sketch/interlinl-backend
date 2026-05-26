const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { pdf2png } = require('pdf2image');

// Configure Multer to store files in a temp directory first
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(__dirname, '../temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const originalFilename = file.originalname;
    const timestampedFilename = `${Date.now()}-${originalFilename}`;
    cb(null, timestampedFilename);
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /pdf|jpeg|jpg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, JPEG, JPG, and PNG files are supported'));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to create a thumbnail
//test
async function createThumbnail(filePath,purpose) {

  if(purpose === "profilePic"){
      try {
        const fileExt = path.extname(filePath).toLowerCase();
        const thumbnailPath = filePath.replace(fileExt, '-thumbnail.png');

        if (fileExt === '.pdf') {
          const options = { density: 150, saveFilename: 'thumbnail', savePath: path.dirname(filePath), format: 'png' };
          const [firstPageImage] = await pdf2png(filePath, options); // Generate an image from the first page
          await fs.rename(firstPageImage.path, thumbnailPath); // Rename the generated thumbnail
        } else {
          // For images, use sharp to resize
          await sharp(filePath)
            .resize(350, 350, {
              fit: 'inside',
              withoutEnlargement: true,
              position: 'center',
            })        
            .toFile(thumbnailPath);
        }
        
        return path.basename(thumbnailPath);
      } catch (error) {
        console.error('Thumbnail creation error:', error);
        return null;
      }
  }else if(purpose === "projectPic"){
    try {
      const fileExt = path.extname(filePath).toLowerCase();
      const thumbnailPath = filePath.replace(fileExt, '-thumbnail.png');

      if (fileExt === '.pdf') {
        const options = { density: 150, saveFilename: 'thumbnail', savePath: path.dirname(filePath), format: 'png' };
        const [firstPageImage] = await pdf2png(filePath, options); // Generate an image from the first page
        await fs.rename(firstPageImage.path, thumbnailPath); // Rename the generated thumbnail
      } else {
        // For images, use sharp to resize
        await sharp(filePath)
          .resize(540, 320, {
            fit: 'inside',
            withoutEnlargement: true,
            position: 'center',
          })        
          .toFile(thumbnailPath);
      }
      
      return path.basename(thumbnailPath);
    } catch (error) {
      console.error('Thumbnail creation error:', error);
      return null;
    }
    
  }else{
    try {
      const fileExt = path.extname(filePath).toLowerCase();
      const thumbnailPath = filePath.replace(fileExt, '-thumbnail.png');

      if (fileExt === '.pdf') {
        const options = { density: 150, saveFilename: 'thumbnail', savePath: path.dirname(filePath), format: 'png' };
        const [firstPageImage] = await pdf2png(filePath, options); // Generate an image from the first page
        await fs.rename(firstPageImage.path, thumbnailPath); // Rename the generated thumbnail
      } else {
        // For images, use sharp to resize
        await sharp(filePath)
          .resize(350, 350, {
            fit: 'inside',
            withoutEnlargement: true,
            position: 'center',
          })        
          .toFile(thumbnailPath);
      }
      
      return path.basename(thumbnailPath);
    } catch (error) {
      console.error('Thumbnail creation error:', error);
      return null;
    }
  }

}

// Helper function to move file
async function moveFile(tempPath, finalPath) {
  try {
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(tempPath, finalPath);
  } catch (error) {
    throw new Error(`Error moving file: ${error.message}`);
  }
}

// Utility function to clean up filesasync function cleanupFiles(files) {
  async function cleanupFiles(files) {
    for (const file of files) {
      try {
        // Check if the main file exists before deleting
        await fs.access(file.path);
        await fs.unlink(file.path);
        
        // Check if the thumbnail exists before deleting
        if (file.thumbnailPath) {
          await fs.access(file.thumbnailPath);
          await fs.unlink(file.thumbnailPath);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error(`File not found during cleanup: ${file.path}`);
        } else {
          console.error(`Error cleaning up file ${file.path}:`, error);
        }
      }
    }
  }
  



// Process uploaded files
async function processUploadedFiles(files,purpose) {
  const processedFiles = [];
  const filesToCleanup = [];
  
  try {
    for (const file of files) {
      const thumbnailFilename = await createThumbnail(file.path,purpose);
      const thumbnailPath = thumbnailFilename ? 
        path.join(path.dirname(file.path), thumbnailFilename) : null;

      processedFiles.push({
        fileName: file.filename,
        originalName: file.originalname,
        path: file.path,
        thumbnailPath,
        thumbnailFilename
      });
      
      filesToCleanup.push({
        path: file.path,
        thumbnailPath
      });
    }
    return processedFiles;
  } catch (error) {
    await cleanupFiles(filesToCleanup);
    throw error;
  }
}

// Middleware for handling single file upload
function uploadSingle(fieldName,purpose) {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) return next();

        const [processedFile] = await processUploadedFiles([req.file],req.body.purpose);
        req.processedFile = processedFile;
        next();
      } catch (error) {
        if (req.file) {
          await cleanupFiles([{ path: req.file.path }]);
        }
        next(error);
      }
    });
  };
}

// Middleware for handling multiple file uploads
function uploadMultiple(fieldName, maxCount = 10) {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.files || req.files.length === 0) return next();

        req.processedFiles = await processUploadedFiles(req.files);
        next();
      } catch (error) {
        if (req.files) {
          await cleanupFiles(req.files.map(file => ({ path: file.path })));
        }
        next(error);
      }
    });
  };
}

function uploadMultipleWithDifferentFields(fields) {
  return async (req, res, next) => {
    const uploadInstance = multer({
      storage,
      fileFilter: (req, file, cb) => {
        const fieldConfig = fields.find(f => f.name === file.fieldname);
        if (!fieldConfig || !fieldConfig.allowedTypes) {
          return cb(new Error(`No file type restrictions defined for ${file.fieldname}`));
        }

        const filetypes = new RegExp(fieldConfig.allowedTypes.join('|'));
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (extname && mimetype) {
          return cb(null, true);
        } else {
          cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldConfig.allowedTypes.join(', ')}`));
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
    });

    uploadInstance.fields(fields)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.files || Object.keys(req.files).length === 0) return next();

        req.processedFiles = {};
        for (const [fieldName, files] of Object.entries(req.files)) {
          req.processedFiles[fieldName] = await processUploadedFiles(files, req.body.purpose);
        }
        next();
      } catch (error) {
        if (req.files) {
          const allFiles = Object.values(req.files).flat();
          await cleanupFiles(allFiles.map(file => ({ path: file.path })));
        }
        next(error);
      }
    });
  };
}


module.exports = {
  upload,           // Raw multer instance
  uploadSingle,     // Middleware for single file
  uploadMultiple,   // Middleware for multiple files
  uploadMultipleWithDifferentFields, // Middleware for multiple files with different field names
  moveFile,         // Utility to move files
  cleanupFiles      // Utility to cleanup files
};




function uploadMultipleWithDifferentFields(fields) {
    return async (req, res, next) => {
      const uploadInstance = multer({
        storage,
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['pdf', 'jpeg', 'jpg', 'png'];
          const filetypes = new RegExp(allowedTypes.join('|'));
          const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
          const mimetype = filetypes.test(file.mimetype);
          
          if (extname && mimetype) {
            return cb(null, true);
          } else {
            cb(new Error(`Invalid file type for ${file.fieldname}. Only PDF, JPEG, JPG, and PNG files are supported.`));
          }
        },
        limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
      });
  
      uploadInstance.fields(fields)(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
  
        try {
          if (!req.files || Object.keys(req.files).length === 0) return next();
  
          req.processedFiles = {};
          for (const [fieldName, files] of Object.entries(req.files)) {
            const processedFiles = [];
            for (const file of files) {
              const fileExt = path.extname(file.originalname);
              const fileNameWithoutExt = path.basename(file.originalname, fileExt);
              
              // Move and rename original file
              const originalFileName = `${fileNameWithoutExt}-original${fileExt}`;
              const originalFilePath = path.join('uploads', fieldName, originalFileName);
              await moveFile(file.path, originalFilePath);
  
              // Create and move thumbnail
              const thumbnailFileName = `${fileNameWithoutExt}-thumbnail.png`;
              const thumbnailTempPath = await createThumbnail(originalFilePath, req.body.purpose);
              const thumbnailFilePath = path.join('uploads', fieldName, thumbnailFileName);
              if (thumbnailTempPath) {
                await moveFile(thumbnailTempPath, thumbnailFilePath);
              }
  
              processedFiles.push({
                fieldName: fieldName,
                originalName: file.originalname,
                originalPath: originalFilePath,
                thumbnailPath: thumbnailFilePath,
                thumbnailFilename: thumbnailFileName
              });
            }
            req.processedFiles[fieldName] = processedFiles;
          }
          next();
        } catch (error) {
          if (req.files) {
            const allFiles = Object.values(req.files).flat();
            await cleanupFiles(allFiles.map(file => ({ path: file.path })));
          }
          next(error);
        }
      });
    };
  }
  