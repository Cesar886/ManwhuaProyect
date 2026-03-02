const express = require('express');
const router = express.Router();
const { createOrder, captureOrder } = require('../controllers/donation.controller');
const { donationLimiter } = require('../middleware/rateLimit');

// POST /api/donations/create-order
router.post('/create-order', donationLimiter, createOrder);

// POST /api/donations/capture/:orderID
router.post('/capture/:orderID', donationLimiter, captureOrder);

module.exports = router;
