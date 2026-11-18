// Build the game, then serve it on all interfaces (0.0.0.0) for LAN play.
// Usage: npm run prod            (port 4173)
//        PORT=8080 npm run prod
import os from 'node:os';
import { build, preview } from 'vite';

const port = Number(process.env.PORT) || 4173;

await build({ logLevel: 'warn', build: { chunkSizeWarningLimit: 1500 } });
const server = await preview({ preview: { host: '0.0.0.0', port, strictPort: false }, logLevel: 'silent' });

const actual = server.httpServer.address().port;
const lan = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

const line = '─'.repeat(52);
console.log(`\n${line}\n  🌸 Bloom & Doom is being served (bound to 0.0.0.0:${actual})\n${line}`);
console.log(`  Local:   http://localhost:${actual}/`);
if (lan.length) for (const ip of lan) console.log(`  LAN:     http://${ip}:${actual}/`);
else console.log('  LAN:     (no network interface found)');
console.log(`${line}\n  Press Ctrl+C to stop.\n`);
