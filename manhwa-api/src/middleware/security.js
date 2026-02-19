const allowedOrigins = [
  'https://manhwaimperial.site',
  'https://www.manhwaimperial.site',
  'http://localhost:3000',
  'http://localhost:5173'
];

const requireValidOrigin = (req, res, next) => {
  // Allow internal requests with valid API key (e.g. Next.js SSR)
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Allow requests with no origin/referer only in development/test
  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    return next();
  }

  // 1. Strict Origin Check
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Invalid origin'
    });
  }

  // 2. Referer Check
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid referer'
        });
      }
    } catch (e) {
      // Malformed referer
      return res.status(403).json({
        success: false,
        message: 'Access denied: Malformed referer'
      });
    }
  }

  // Block completely empty headers in production
  if (process.env.NODE_ENV === 'production' && !origin && !referer) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Missing origin headers'
    });
  }

  next();
};

module.exports = { requireValidOrigin };
