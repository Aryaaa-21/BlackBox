const path = require('node:path');
const { spawnSync } = require('node:child_process');

const clientRoot = path.resolve(__dirname, '../..');
const vite = path.resolve(clientRoot, '../node_modules/vite/bin/vite.js');
const result = spawnSync(process.execPath, [vite, 'build'], {
  cwd: clientRoot,
  env: {
    ...process.env,
    VITE_API_URL: 'http://127.0.0.1:5001/api/v1',
    VITE_SOCKET_URL: 'http://127.0.0.1:5001',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
