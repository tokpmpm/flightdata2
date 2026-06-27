const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3033;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml',
    '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
    // Decode URI to handle Chinese paths like /airport/khh/
    let decodedUrl = req.url;
    try {
        decodedUrl = decodeURIComponent(req.url);
    } catch (e) {
        console.error(e);
    }

    // Strip query string first, then resolve file path
    const cleanPath = decodedUrl.split('?')[0];
    let filePath = path.join(__dirname, '..', cleanPath);

    if (cleanPath.endsWith('/') || cleanPath === '') {
        filePath = path.join(filePath, 'index.html');
    } else {
        // If file doesn't exist and has no extension, try adding .html (clean URL fallback)
        if (!fs.existsSync(filePath) && !path.extname(filePath)) {
            const htmlPath = filePath + '.html';
            if (fs.existsSync(htmlPath)) {
                filePath = htmlPath;
            } else {
                const indexHtmlPath = path.join(filePath, 'index.html');
                if (fs.existsSync(indexHtmlPath)) {
                    filePath = indexHtmlPath;
                }
            }
        }
    }


    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', mime);
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Local dev server running at http://localhost:${PORT}`);
});
