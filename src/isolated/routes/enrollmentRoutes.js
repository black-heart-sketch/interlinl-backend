const express = require('express');
const router = express.Router();
const { 
    createEnrollmentController, 
    updateEnrollmentProgressController,
    getMyEnrollmentsController,
    getEnrollmentStatusForCourseController,
    initiateCoursePaymentController,
    getCoursePaymentStatusController,
    requestSectionAccessController
} = require('../controllers/enrollmentController');
const { isAuth } = require('../middleware/auth');

router.post('/', isAuth, createEnrollmentController);
router.get('/my', isAuth, getMyEnrollmentsController);
router.get('/course/:courseId/status', isAuth, getEnrollmentStatusForCourseController);
router.post('/course/:courseId/initiate-payment', isAuth, initiateCoursePaymentController);
router.get('/course-payment-status/:transactionId', isAuth, getCoursePaymentStatusController);
router.post('/:enrollmentId/progress', isAuth, updateEnrollmentProgressController);
router.post('/:enrollmentId/section-access', isAuth, requestSectionAccessController);

module.exports = router;
