import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [join(__dirname, 'src/app.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(__dirname, '../../api/app.bundle.js'),
  external: [
    // Node built-ins
    'crypto',
    'fs',
    'path',
    'http',
    'https',
    'net',
    'stream',
    'url',
    'util',
    'zlib',
    'events',
    'buffer',
    'querystring',
    'os',
    'child_process',
    'tls',
    // Keep external for Vercel to resolve
    '@supabase/supabase-js',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false, // Keep readable for debugging
  sourcemap: true,
});

console.log('API bundle created at api/app.bundle.js');
