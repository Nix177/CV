import http from 'http';
import fs from 'fs';
import path from 'path';
import chat from '../api/chat.js';
import ff from '../api/ff-chat.js';
import lang from '../api/lang-seed.js';

const PORT = 3000;
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf'
};

const handlers = {
    '/api/chat': chat,
    '/api/ff-chat': ff,
    '/api/lang-seed': lang
};

function handleApi(req, res, handler) {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
        // Mock Vercel props
        const rawBody = Buffer.concat(body).toString();
        try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            req.body = rawBody;
        }

        // Helpers
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (data) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
        };
        res.send = (data) => { res.end(data); return res; };

        try {
            await handler(req, res);
        } catch (e) {
            console.error("API Error:", e);
            if (!res.headersSent) res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    console.log(req.method, url.pathname);

    if (handlers[url.pathname]) {
        return handleApi(req, res, handlers[url.pathname]);
    }

    // Static
    let file = path.join(process.cwd(), 'public', url.pathname === '/' ? 'index.html' : url.pathname);

    // Clean URL support (e.g. /chatbot -> /chatbot.html)
    if (!fs.existsSync(file) && !path.extname(file)) {
        if (fs.existsSync(file + '.html')) file += '.html';
    }

    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    } else {
        res.statusCode = 404;
        res.end('Not found: ' + url.pathname);
    }
});

server.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});
