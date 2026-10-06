const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.next', 'standalone', 'apps', 'frontend');
if (!fs.existsSync(path.join(target, 'server.js'))) throw new Error('Run npm run build first');
fs.cpSync(path.join(root, '.next', 'static'), path.join(target, '.next', 'static'), { recursive: true });
fs.cpSync(path.join(root, 'public'), path.join(target, 'public'), { recursive: true });
