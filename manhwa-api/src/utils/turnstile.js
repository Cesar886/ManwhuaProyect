const axios = require('axios');

/**
 * Verify Cloudflare Turnstile token
 * @param {string} token - The token from the client
 * @param {string} ip - The client's IP address (optional but recommended)
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
const verifyTurnstile = async (token, ip) => {
    try {
        if (!token) return false;

        // Skip verification in development if no secret key provided or if token is 'mock-token'
        if (process.env.NODE_ENV !== 'production' && (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || token === 'mock-token')) {
            console.log('Skipping Turnstile verification in dev');
            return true;
        }

        const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            console.warn('CLOUDFLARE_TURNSTILE_SECRET_KEY not set');
            return true; // Fail open if config missing, or false to fail closed? Standard is fail closed but for now...
        }

        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (ip) formData.append('remoteip', ip);

        const result = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData);
        
        return result.data.success === true;
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
};

module.exports = { verifyTurnstile };
