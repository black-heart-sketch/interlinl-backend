const { Vimeo } = require('@vimeo/vimeo');

// Initialize Vimeo client
const vimeoClient = new Vimeo(
  process.env.VIMEO_CLIENT_ID,
  process.env.VIMEO_CLIENT_SECRET,
  process.env.VIMEO_ACCESS_TOKEN
);

// Log Vimeo client initialization for debugging
console.log('Vimeo Client Initialized:', {
  clientId: process.env.VIMEO_CLIENT_ID ? 'Set' : 'Not Set',
  clientSecret: process.env.VIMEO_CLIENT_SECRET ? 'Set' : 'Not Set',
  accessToken: process.env.VIMEO_ACCESS_TOKEN ? 'Set' : 'Not Set',
});

module.exports = vimeoClient;
