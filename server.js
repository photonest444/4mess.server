
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

const DB_FILE = path.join(publicDir, 'database.json');
const PORT = 3000;

// Function to get the machine's best IP for display purposes
const getBestIP = () => {
    const interfaces = os.networkInterfaces();
    let privateIP = null;
    let publicIP = null;

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.').map(Number);
                const isPrivate = 
                    (parts[0] === 10) ||
                    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                    (parts[0] === 192 && parts[1] === 168);

                if (!isPrivate) {
                    publicIP = iface.address; 
                } else if (!privateIP) {
                    privateIP = iface.address;
                }
            }
        }
    }
    return publicIP || privateIP || 'localhost';
};

const DISPLAY_HOST = getBestIP();

if (!fs.existsSync(DB_FILE)) {
    const initialData = { users: [], conversations: [], roles: [], ads: [], countryBans: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

const server = http.createServer((req, res) => {
    // Log incoming requests for debugging
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // Robust CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours cache for preflight

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API: Get Database
    if (req.url === '/api/database' && req.method === 'GET') {
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read database' }));
                return;
            }
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            });
            res.end(data);
        });
        return;
    }

    // API: Save Database
    if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                fs.writeFile(DB_FILE, body, (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Write failed' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 4 Messenger Server Ready`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://${DISPLAY_HOST}:${PORT}`);
    console.log(`\n💡 IF CONNECTION FAILS:`);
    console.log(`   1. Ensure port ${PORT} is open in your Windows/Linux Firewall.`);
    console.log(`   2. Ensure your router points port ${PORT} to this machine's IP.`);
    console.log(`   3. Browsers block HTTP backends from HTTPS sites (Mixed Content).`);
});
