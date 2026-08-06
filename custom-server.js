const http = require('http');

// Save the original createServer
const originalCreateServer = http.createServer;

// Override http.createServer to intercept headers and rewrite paths
http.createServer = function (requestListener) {
  const wrappedListener = (req, res) => {
    // Intercept response headers before they are written
    const originalWriteHead = res.writeHead;
    res.writeHead = function (statusCode, statusMessage, headers) {
      res.removeHeader('Server');
      res.removeHeader('X-Powered-By');
      res.setHeader('Server', ''); // Clear server identification
      
      // Sanitize headers if passed directly to writeHead
      if (headers) {
        if (headers['Server']) delete headers['Server'];
        if (headers['X-Powered-By']) delete headers['X-Powered-By'];
        if (headers['server']) delete headers['server'];
        if (headers['x-powered-by']) delete headers['x-powered-by'];
      }
      if (typeof statusMessage === 'object' && !headers) {
        headers = statusMessage;
        if (headers['Server']) delete headers['Server'];
        if (headers['X-Powered-By']) delete headers['X-Powered-By'];
        if (headers['server']) delete headers['server'];
        if (headers['x-powered-by']) delete headers['x-powered-by'];
      }

      return originalWriteHead.apply(this, arguments);
    };

    const originalSetHeader = res.setHeader;
    res.setHeader = function (name, value) {
      const lowerName = name.toLowerCase();
      if (lowerName === 'server' || lowerName === 'x-powered-by') {
        if (lowerName === 'server') {
          return originalSetHeader.call(this, name, '');
        }
        return this;
      }
      return originalSetHeader.call(this, name, value);
    };

    // Rewrite public-facing /assets/ path back to /_next/ for Next.js handler
    if (req.url && req.url.startsWith('/assets/')) {
      req.url = req.url.substring(7); // Remove "/assets" prefix (leaving "/_next/...")
    }

    return requestListener(req, res);
  };

  return originalCreateServer.call(http, wrappedListener);
};

// Execute the original Next.js standalone server entry point
require('./next-server.js');
