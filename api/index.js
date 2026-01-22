// Vercel Serverless Function handler
// This imports the bundled Express app created by esbuild
const { app } = require('./app.bundle.js');

module.exports = app;
