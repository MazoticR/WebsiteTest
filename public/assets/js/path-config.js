// Set base path based on environment
const isLocal = window.location.hostname === '127.0.0.1' || 
                window.location.hostname === 'localhost';

window.APP_BASE = isLocal 
  ? '/public/lekker/tools/'  // Local development path
  : '/lekker/tools/';        // Production path (Vercel)

// Dynamic resource loader
function loadResources(relativePaths) {
  relativePaths.forEach(path => {
    if (path.endsWith('.css')) {
      document.write(`<link rel="stylesheet" href="${window.APP_BASE}${path}">`);
    } else if (path.endsWith('.js')) {
      document.write(`<script src="${window.APP_BASE}${path}"><\/script>`);
    }
  });
}