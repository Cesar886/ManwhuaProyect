const express = require('express');
const router = express.Router();
const { createOrder, captureOrder } = require('../controllers/donation.controller');

// POST /api/donations/create-order
router.post('/create-order', createOrder);

// POST /api/donations/capture/:orderID
router.post('/capture/:orderID', captureOrder);

module.exports = router;
