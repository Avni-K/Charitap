// Geo-blocking middleware - US only
const geoBlock = (req, res, next) => {
  // Get country from headers (set by reverse proxy/CDN like Cloudflare)
  const country = req.headers['cf-ipcountry'] || 
                  req.headers['x-country-code'] || 
                  req.headers['cloudfront-viewer-country'];
  
  // For development/localhost, allow access
  if (!country || req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }
  
  // Block if not US
  if (country !== 'US') {
    return res.status(403).json({
      error: 'Service Unavailable',
      message: 'Charitap is currently only available in the United States.',
      code: 'GEO_RESTRICTED'
    });
  }
  
  next();
};

module.exports = geoBlock;
