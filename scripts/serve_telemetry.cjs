// Serve the compiled native Lichtblick application, including HTTP byte ranges for MCAP.
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const handler = require('../vendor/lichtblick/node_modules/serve-handler');
const publicPath = path.resolve(__dirname, '../vendor/lichtblick/web/.webpack');
if (!fs.existsSync(path.join(publicPath, 'index.html'))) {
  throw new Error('Build the native web application before serving it. See docs/DELIVERY_PLATFORM.md.');
}
const port = Number(process.env.PORT || 8080);
http.createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  const target = new URL(req.url, 'http://localhost');
  if (target.pathname === '/') req.url = '/index.html' + target.search;
  return handler(req, res, { public: publicPath, cleanUrls: false, directoryListing: false });
}).listen(port, '127.0.0.1', () => console.log(`Delivery native engine listening on loopback port ${port}`));
