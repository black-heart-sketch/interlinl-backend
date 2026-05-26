const express = require('express');
const {
  createResearch,
  getResearch,
  getResearchById,
  updateResearch,
  deleteResearch
} = require('../controllers/researchController');
const { isAuth } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/multer');
const logEvent = require('../middleware/eventLogger');

const router = express.Router();

router.route('/')
  .get(getResearch)
  .post(isAuth, uploadMultiple([{ name: 'thumbnail', maxCount: 1 }, { name: 'documents', maxCount: 5 }]), createResearch);

router.route('/:researchId')
  .get(logEvent, getResearchById)
  .put(isAuth, uploadMultiple([{ name: 'thumbnail', maxCount: 1 }, { name: 'documents', maxCount: 5 }]), updateResearch)
  .delete(isAuth, deleteResearch);

module.exports = router;
