const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const trackController = require('../controllers/track.controller');

router.use(authenticate);

router.post('/session-start', trackController.trackSessionStart);
router.post('/chapter-progress', trackController.trackChapterProgress);
router.post('/chapter-complete', trackController.trackChapterComplete);
router.post('/work-abandon', trackController.trackWorkAbandon);
router.post('/search-query', trackController.trackSearchQuery);
router.post('/recommendation-impression', trackController.trackRecommendationImpression);
router.post('/recommendation-click', trackController.trackRecommendationClick);
router.post('/session-end', trackController.trackSessionEnd);

module.exports = router;