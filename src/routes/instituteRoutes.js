const express = require('express');
const {
  createInstitute,
  getInstitutes,
  getInstituteById,
  updateInstitute,
  deleteInstitute
} = require('../controllers/instituteController');
const { isAuth, roleCheck } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/multer');

const router = express.Router();

router.route('/')
  .get(getInstitutes)
  .post(isAuth, roleCheck(['SystemAdmin']), uploadMultiple([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), createInstitute);

router.route('/:id')
  .get(getInstituteById)
  .put(isAuth, roleCheck(['SystemAdmin', 'InstituteAdmin']), uploadMultiple([{ name: 'logo', maxCount: 1 }, { name: 'background', maxCount: 1 }]), updateInstitute)
  .delete(isAuth, roleCheck(['SystemAdmin']), deleteInstitute);

module.exports = router;
