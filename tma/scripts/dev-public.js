import localtunnel from 'localtunnel';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log('Starting localtunnel...');
  const tunnel = await localtunnel({ port: 5173 });

  console.log('\n======================================================');
  console.log('🚀 PUBLIC HTTPS URL: ' + tunnel.url);
  console.log('1. Open this URL on your phone or browser to test TonConnect');
  console.log('   (TonConnect requires a public HTTPS URL to work with mobile apps)');
  console.log('2. The Vite dev server is running locally and changes will hot-reload');
  console.log('======================================================\n');

  // Start Vite with the VITE_PUBLIC_URL environment variable 
  // so App.tsx can use it for the TonConnect manifest URL
  const viteProcess = spawn('npx', ['vite', '--host'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      VITE_PUBLIC_URL: tunnel.url,
    },
  });

  viteProcess.on('exit', () => {
    tunnel.close();
    process.exit();
  });

  tunnel.on('close', () => {
    console.log('Localtunnel closed');
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    tunnel.close();
    viteProcess.kill();
    process.exit();
  });
})();
