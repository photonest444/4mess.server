
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

const DB_FILE = path.join(publicDir, 'database.json');
const PORT = 3000;

const getBestIP = () => {
    const interfaces = os.networkInterfaces();
    let privateIP = null;
    let publicIP = null;
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.').map(Number);
                const isPrivate = (parts[0] === 10) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
                if (!isPrivate) publicIP = iface.address; else if (!privateIP) privateIP = iface.address;
            }
        }
    }
    return publicIP || privateIP || 'localhost';
};

const DISPLAY_HOST = getBestIP();

const loadDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { 
            users: [], 
            conversations: [], 
            roles: [], 
            ads: [], 
            countryBans: [],
            systemSettings: { 
                maintenanceMode: false, 
                serverPassword: '',
                requirePassword: true,
                requireCaptcha: true
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Server-Password');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const dbData = loadDB();
    const settings = dbData.systemSettings || {};
    const serverPassword = settings.serverPassword || '';
    const clientPassword = req.headers['x-server-password'];

    // Public Endpoint: Client queries this to know what security screen to show
    if (req.url === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // Never return the actual password here!
        const publicSettings = {
            maintenanceMode: settings.maintenanceMode,
            requirePassword: settings.requirePassword !== false && !!serverPassword,
            requireCaptcha: settings.requireCaptcha !== false
        };
        res.end(JSON.stringify(publicSettings));
        return;
    }

    // Protected Endpoints
    const isPasswordRequired = settings.requirePassword !== false && !!serverPassword;
    if (isPasswordRequired && serverPassword !== clientPassword) {
        console.warn(`[AUTH FAIL] Denied access to ${req.url} - Incorrect Password`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }

    if (req.url === '/api/database' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dbData));
        return;
    }

    if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                fs.writeFile(DB_FILE, body, (err) => {
                    if (err) { res.writeHead(500); res.end(); return; }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) { res.writeHead(400); res.end(); }
        });
        return;
    }
    res.writeHead(404); res.end();
});

// Explicitly bind to 0.0.0.0 to allow access from other devices in the network
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 4 Messenger Server Ready at http://${DISPLAY_HOST}:${PORT}`);
    console.log(`🔗 Database endpoint: http://0.0.0.0:${PORT}/api/database`);
});
