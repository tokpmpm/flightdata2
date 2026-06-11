const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3036;

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0]; // strip query string
    let filePath = path.join(__dirname, '..', urlPath);
    
    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(__dirname, '..', 'index.html');
    } else if (urlPath.endsWith('/')) {
        filePath = path.join(__dirname, '..', urlPath, 'index.html');
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.json') contentType = 'application/json';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Local test server is running at http://localhost:${PORT}`);
    console.log(`📂 You can verify the outlook report at: http://localhost:${PORT}/insights/2026-taiwan-aviation-market-outlook/\n`);
});
