#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the main script
const mainScript = resolve(__dirname, '..', 'src', 'index.js');

// Execute the main script with the current process arguments
const args = process.argv.slice(2);
const child = spawn(process.execPath, [mainScript, ...args], {
	stdio: 'inherit'
});

// Handle process exit
child.on('exit', (code) => {
	process.exit(code);
});
