const vimeoClient = require('../config/vimeoClient');
const { getIO } = require('../socket');
const fs = require('fs');

const uploadVideoToVimeo = (req, res) => {
  console.log("Start Vimeo Upload");
  const uploadJobId = req.body.uploadJobId || req.headers['x-upload-job-id'];

  if (!req.file) {
    return res.status(400).json({ message: 'No video file provided.' });
  }
  const { path: filePath, originalname } = req.file;
  const { title: bodyTitle, description: bodyDescription } = req.body;

  const videoName = bodyTitle || originalname.split('.').slice(0, -1).join('.') || 'Untitled Video';
  const videoDescription = bodyDescription || '';

  console.log(`[UploadJob ${uploadJobId || 'N/A'}] Video upload requested: ${filePath}`);
  console.log(`[UploadJob ${uploadJobId || 'N/A'}] Details: name=${videoName}, desc=${videoDescription}`);

  const io = getIO();

  vimeoClient.upload(
    filePath,
    {
      name: videoName,
      description: videoDescription,
      privacy: {
        view: 'anybody',
        embed: 'public',
      },
    },
    (uri) => {
      console.log(`[UploadJob ${uploadJobId || 'N/A'}] Vimeo URI: ${uri}. Fetching details...`);
      
      vimeoClient.request(
        {
          method: 'GET',
          path: uri + '?fields=link,uri,duration,name,description,privacy,transcode.status,pictures.sizes', 
        },
        (error, body, statusCode, headers) => {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error(`[UploadJob ${uploadJobId || 'N/A'}] Error deleting temp file ${filePath}:`, unlinkErr);
            else console.log(`[UploadJob ${uploadJobId || 'N/A'}] Deleted temp file ${filePath}`);
          });

          if (error) {
            console.error(`[UploadJob ${uploadJobId || 'N/A'}] Failed to fetch video details:`, error);
            return res.status(500).json({ message: 'Vimeo upload succeeded, but failed to get video details.', errorDetails: error.message });
          }

          if (statusCode >= 400) {
            console.error(`[UploadJob ${uploadJobId || 'N/A'}] Error fetching details (Status ${statusCode}):`, body);
            return res.status(statusCode).json({ message: `Error fetching video details.`, errorBody: body });
          }

          const vimeoLink = body.link;
          const vimeoDuration = body.duration || 0;
          
          let vimeoVideoIdWithHash = null;
          if (vimeoLink) {
            const parts = vimeoLink.split('vimeo.com/');
            if (parts.length > 1) {
              vimeoVideoIdWithHash = parts[1].split('?')[0].split('#')[0];
            }
          }

          if (!vimeoVideoIdWithHash) {
            console.error(`[UploadJob ${uploadJobId || 'N/A'}] Could not extract ID/Hash from link: ${vimeoLink}`);
            return res.status(500).json({ message: 'Failed to parse video ID/Hash from Vimeo link.' });
          }

          let thumbnailUrl = null;
          if (body.pictures && body.pictures.sizes && body.pictures.sizes.length > 0) {
            const preferredWidth = 640;
            let bestThumbnail = body.pictures.sizes.find(size => size.width === preferredWidth);
            if (!bestThumbnail) {
              bestThumbnail = body.pictures.sizes.find(size => size.width >= 320 && size.width <= 960) || body.pictures.sizes[body.pictures.sizes.length - 1];
            }
            if (bestThumbnail) thumbnailUrl = bestThumbnail.link_with_play_button || bestThumbnail.link;
          }
          
          console.log(`[UploadJob ${uploadJobId || 'N/A'}] Vimeo upload completed: ID/Hash ${vimeoVideoIdWithHash}`);

          const responsePayload = {
            vimeoVideoId: vimeoVideoIdWithHash,
            url: vimeoLink,
            duration: vimeoDuration,
            thumbnailUrl: thumbnailUrl,
            title: body.name || videoName,
            description: body.description || videoDescription
          };

          if (uploadJobId && io) {
            io.to(uploadJobId).emit('vimeoUploadComplete', responsePayload);
          }
          
          res.status(200).json(responsePayload);
        }
      );
    },
    (bytesUploaded, bytesTotal) => {
      const percentage = ((bytesUploaded / bytesTotal) * 100);
      if (uploadJobId && io) {
        io.to(uploadJobId).emit('vimeoUploadProgress', { uploadJobId, progress: parseFloat(percentage.toFixed(2)) });
      }
    },
    (error) => {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`[UploadJob ${uploadJobId || 'N/A'}] Error deleting temp file:`, unlinkErr);
      });

      console.error(`[UploadJob ${uploadJobId || 'N/A'}] Vimeo upload failed:`, error);
      if (uploadJobId && io) {
        io.to(uploadJobId).emit('vimeoUploadError', { uploadJobId, message: 'Vimeo upload process failed.', errorDetails: error.message });
      }
      res.status(500).json({ message: 'Vimeo upload process failed.', errorDetails: error.message });
    }
  );
};

module.exports = {
  uploadVideoToVimeo,
};
