const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { exec } = require('child_process');
const util = require('util');
const { createCanvas } = require('canvas');

const execPromise = util.promisify(exec);

// Helper to convert Office docs to PDF using LibreOffice
async function convertOfficeToPdf(inputPath, outputDir) {
    const command = `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
    try {
        const { stderr } = await execPromise(command);
        if (stderr) {
            // LibreOffice often outputs to stderr even on success, so we treat it as a warning.
            console.warn(`LibreOffice conversion for ${inputPath} produced warnings: ${stderr}`);
        }

        const outputPdfPath = path.join(outputDir, path.basename(inputPath, path.extname(inputPath)) + '.pdf');
        
        // Verify that the file was created and is not empty
        const stats = await fs.stat(outputPdfPath);
        if (stats.size === 0) {
            throw new Error('LibreOffice conversion resulted in an empty PDF file.');
        }

        return outputPdfPath;
    } catch (error) {
        console.error(`LibreOffice conversion failed for ${inputPath}. Ensure LibreOffice is installed and in the system's PATH.`);
        // Log the full error, including stdout/stderr if available from execPromise
        console.error('Error details:', error.stderr || error.stdout || error.message);
        throw new Error('Failed to convert office document to PDF.');
    }
}

// Helper to generate a thumbnail from a PDF
async function generatePdfThumbnail(pdfPath, outputDir, baseName) {
    const thumbnailStem = path.join(outputDir, `${baseName}-thumbnail`);
    const command = `pdftoppm -png -f 1 -singlefile -scale-to 150 "${pdfPath}" "${thumbnailStem}"`;
    
    try {
        const { stderr } = await execPromise(command);
        if (stderr) {
            console.warn(`pdftoppm for ${pdfPath} produced warnings: ${stderr}`);
        }

        const thumbnailPath = `${thumbnailStem}.png`;

        // Verify that the thumbnail was created and is not empty
        const stats = await fs.stat(thumbnailPath);
        if (stats.size === 0) {
            await fs.unlink(thumbnailPath).catch(e => console.error(`Failed to clean up empty thumbnail: ${e}`));
            throw new Error('pdftoppm created an empty thumbnail file.');
        }

        return thumbnailPath;
    } catch (error) {
        console.error(`pdftoppm failed for ${pdfPath}. Ensure poppler-utils is installed and in the system's PATH.`);
        console.error('Error details:', error.stderr || error.stdout || error.message);
        throw new Error('Failed to generate PDF thumbnail.');
    }
}

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

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images, documents, and video/audio files
  const allowedExtensions = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv|mp3|wav|ogg|aac/;
  const allowedMimetypes = /pdf|msword|wordprocessingml|ms-excel|spreadsheetml|ms-powerpoint|presentationml|text|jpg|jpeg|png|gif|webp|mp4|webm|quicktime|x-msvideo|x-matroska|mpeg|ogg|wav|aac|mp3/;
  
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
  const mimetype = allowedMimetypes.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPEG, JPG, PNG, MP4, WebM, MOV, MP3, WAV'));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for video support
});

// Function to create a thumbnail for supported file types
async function createThumbnail(filePath, purpose) {
  const fileExt = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, fileExt);
  const outputDir = path.dirname(filePath);
  const finalThumbnailPath = path.join(outputDir, `${baseName}-thumbnail.png`);

  // Validate purpose: now allows 'logo', 'background', or 'generic'
  const allowedPurposes = [
          'academicTranscript',
          'researchProposal',
          'idCard',
          'logo',
          'background',
          'thumbnail',
          'syllabus',
          'document',
          'generic',
          'library',
          'course',
          'video',
          'audio'
        ];
        console.log('purpose', purpose)

        if (!allowedPurposes.includes(purpose)) {
          console.error(`Invalid purpose for thumbnail creation: ${purpose}`);
          return null;
        }

  // if (!purpose || !['logo', 'background', 'generic', 'documents'].includes(purpose)) {
  // }

  try {
    if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
      await sharp(filePath)
        .resize(150, 150, { // Standardized size
          fit: 'inside',
          withoutEnlargement: true,
          position: 'center',
        })
        .toFile(finalThumbnailPath);
      console.log('Image thumbnail created successfully:', finalThumbnailPath);
      return path.basename(finalThumbnailPath);
    } 
    else if (fileExt === '.pdf') {
        const generatedThumbnailPath = await generatePdfThumbnail(filePath, outputDir, baseName);
        console.log('PDF thumbnail created successfully:', generatedThumbnailPath);
        return path.basename(generatedThumbnailPath);
    }
    else if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(fileExt)) {
        let tempPdfPath;
        try {
            tempPdfPath = await convertOfficeToPdf(filePath, outputDir);
            const generatedThumbnailPath = await generatePdfThumbnail(tempPdfPath, outputDir, baseName);
            console.log(`${fileExt.toUpperCase()} thumbnail created successfully:`, generatedThumbnailPath);
            return path.basename(generatedThumbnailPath);
        } finally {
            if (tempPdfPath) {
                await fs.unlink(tempPdfPath).catch(err => console.error(`Error deleting temp PDF: ${err}`));
            }
        }
    }
    else if (fileExt === '.txt') {
      const canvas = createCanvas(150, 150); // Standardized size
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Text File Preview', canvas.width / 2, canvas.height / 2);
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(finalThumbnailPath, buffer);
      console.log('TXT thumbnail created successfully:', finalThumbnailPath);
      return path.basename(finalThumbnailPath);
    }
    else {
      // Premium gradient canvas thumbnail for other file types (videos, audios, zip, etc.)
      const canvas = createCanvas(150, 150);
      const ctx = canvas.getContext('2d');
      
      // Determine modern HSL gradient based on extension
      let gradStart = '#1e293b', gradEnd = '#0f172a'; // Default slate
      let icon = '📁';
      let typeLabel = fileExt.slice(1).toUpperCase() || 'FILE';

      if (['.mp4', '.avi', '.mov', '.mkv'].includes(fileExt)) {
        gradStart = '#8b5cf6'; gradEnd = '#4c1d95'; // Purple gradient
        icon = '🎬';
      } else if (['.mp3', '.wav', '.ogg', '.aac', '.m4a'].includes(fileExt)) {
        gradStart = '#f59e0b'; gradEnd = '#78350f'; // Amber/Orange gradient
        icon = '🎧';
      } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(fileExt)) {
        gradStart = '#6b7280'; gradEnd = '#374151'; // Grey gradient
        icon = '📦';
      } else if (['.html', '.css', '.js', '.json', '.jsx', '.tsx'].includes(fileExt)) {
        gradStart = '#3b82f6'; gradEnd = '#1d4ed8'; // Blue gradient
        icon = '💻';
      }

      const grad = ctx.createLinearGradient(0, 0, 150, 150);
      grad.addColorStop(0, gradStart);
      grad.addColorStop(1, gradEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Icon
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - 10);

      // Type text label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(typeLabel, canvas.width / 2, canvas.height / 2 + 35);

      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(finalThumbnailPath, buffer);
      console.log(`${typeLabel} gradient canvas thumbnail created successfully:`, finalThumbnailPath);
      return path.basename(finalThumbnailPath);
    }
  } catch (error) {
    console.error('Thumbnail creation error:', error);
    return null;
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

// Utility function to clean up files
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
        // It's okay if the file is already gone
      } else {
        console.error(`Error cleaning up file ${file.path}:`, error);
      }
    }
  }
}

// Process uploaded files
async function processUploadedFiles(files, fieldName) {
  const processedFiles = [];
  const filesToCleanup = [];
  
  try {
    for (const file of files) {
        const fileName = file.originalname;
        let purpose = fileName.split('_')[0];
        const type = fileName.split('.').pop();

        // If the purpose is not in the allowed list, default to 'generic'
        const allowedPurposes = [
          'academicTranscript',
          'researchProposal',
          'idCard',
          'logo',
          'background',
          'thumbnail',
          'syllabus',
          'document',
          'generic',
          'library',
          'course',
          'video',
          'audio'
        ];
        console.log('purpose', purpose)

        if (!allowedPurposes.includes(purpose)) {
          purpose = 'generic';
        }


        const thumbnailFilename = await createThumbnail(file.path, purpose);

        const thumbnailPath = thumbnailFilename ?
            path.join(path.dirname(file.path), thumbnailFilename) : null;
       console.log('fileSize', file.size)
        processedFiles.push({
            fieldName: fieldName,
            fileName: file.filename,
            originalName: file.originalname,
            path: file.path,
            thumbnailPath,
            thumbnailFilename,
            purpose, // This will now be 'generic' for applicable files
            type ,
            fileSize: file.size
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
function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) return next();
        
        const [processedFile] = await processUploadedFiles([req.file], fieldName);
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
function uploadMultiple(fields, maxCount = 10) {
  console.log('Multer logged')
  return (req, res, next) => {
    const formattedFields = Array.isArray(fields)
      ? fields
      : [{ name: fields, maxCount }];

    upload.fields(formattedFields)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.files || Object.keys(req.files).length === 0) return next();

        let processedFiles = [];
        for (const fieldName in req.files) {
          const filesFromField = req.files[fieldName];
          const processed = await processUploadedFiles(filesFromField, fieldName);
          processedFiles = processedFiles.concat(processed);
        }

        req.processedFiles = processedFiles;
        
        // Map fields onto array object to ensure complete backward compatibility
        for (const fieldName in req.files) {
          req.processedFiles[fieldName] = processedFiles.filter(f => f.fieldName === fieldName);
        }
        
        next();
      } catch (error) {
        if (req.files) {
          const filesToCleanup = Object.values(req.files).flat().map(file => ({ path: file.path }));
          await cleanupFiles(filesToCleanup);
        }
        next(error);
      }
    });
  };
}

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  moveFile,
  cleanupFiles
};