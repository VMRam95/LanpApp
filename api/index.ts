// Vercel Serverless Function handler
// This imports the bundled Express app created by esbuild
// @ts-expect-error - Bundle is generated at build time
import { app } from './app.bundle.mjs';

export default app;
