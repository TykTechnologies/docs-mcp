#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import simpleGit from 'simple-git';
import axios from 'axios'; // Import axios
import * as tar from 'tar'; // Import tar using namespace
import { loadConfig } from '../src/config.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load configuration
const config = loadConfig();

// Directory to store documentation files
const dataDir = config.dataDir; // Use configured data directory

/**
 * Prepare the data directory by either copying static files or cloning a Git repo.
 */
async function prepareDataDir() {
	console.log('Building docs-mcp package...');

	// Create data directory if it doesn't exist
	await fs.ensureDir(dataDir);

	// Clear the data directory first
	await fs.emptyDir(dataDir);

	if (config.gitUrl) {
		// Check if we should use Git clone or download tarball
		if (config.autoUpdateInterval > 0) {
			console.log(`Auto-update enabled (interval: ${config.autoUpdateInterval} mins). Using git clone.`);
			await cloneGitRepo();
		} else {
			console.log('Auto-update disabled. Attempting to download tarball archive.');
			await downloadAndExtractTarball();
		}
	} else if (config.includeDir) {
		await copyIncludedDir();
	} else {
		console.log('No includeDir or gitUrl specified. Created empty data directory.');
	}

	// Note: Build completion message moved to the main build function after cleanup
}

/**
 * Clone the Git repository to the data directory.
 */
async function cloneGitRepo() {
	console.log(`Cloning Git repository ${config.gitUrl} (ref: ${config.gitRef}) to ${dataDir}...`);
	const git = simpleGit();

	try {
		// Clone with depth 1 as before, but only if auto-update is enabled
		await git.clone(config.gitUrl, dataDir, ['--branch', config.gitRef, '--depth', '1']);
		console.log(`Successfully cloned repository to ${dataDir}`);
	} catch (error) {
		console.error(`Error cloning Git repository:`, error);
		throw error; // Re-throw to stop the build
	}
}

/**
 * Copy included directory to the data directory.
 */
async function copyIncludedDir() {
	console.log(`Copying ${config.includeDir} to ${dataDir}...`);

	try {
		// Get all files in the directory, respecting .gitignore
		const files = await glob('**/*', {
			cwd: config.includeDir,
			nodir: true,
			ignore: config.ignorePatterns,
			dot: true,
			gitignore: true  // This will respect .gitignore files
		});

		console.log(`Found ${files.length} files in ${config.includeDir} (respecting .gitignore)`);

		// Copy each file
		for (const file of files) {
			const sourcePath = path.join(config.includeDir, file);
			const targetPath = path.join(dataDir, file);

			// Ensure the target directory exists
			await fs.ensureDir(path.dirname(targetPath));

			// Copy the file
			await fs.copy(sourcePath, targetPath);
		}

		console.log(`Successfully copied ${files.length} files to ${dataDir}`);
	} catch (error) {
		console.error(`Error copying ${config.includeDir}:`, error);
		throw error; // Re-throw to stop the build
	}
}

/**
 * Downloads and extracts a tarball archive from a Git repository URL.
 * Assumes GitHub URL structure for archive download.
 */
async function downloadAndExtractTarball() {
	// Basic parsing for GitHub URLs (can be made more robust)
	const match = config.gitUrl.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/);
	if (!match) {
		console.error(`Cannot determine tarball URL from gitUrl: ${config.gitUrl}. Falling back to git clone.`);
		// Fallback to clone if URL parsing fails or isn't GitHub
		await cloneGitRepo();
		return;
	}

	const owner = match[1];
	const repo = match[2];
	let ref = config.gitRef || 'main'; // Start with configured ref or default 'main'

	const downloadAttempt = async (currentRef) => {
		const tarballUrl = `https://github.com/${owner}/${repo}/archive/${currentRef}.tar.gz`;
		console.log(`Attempting to download archive (${currentRef}) from ${tarballUrl} to ${dataDir}...`);

		const response = await axios({
			method: 'get',
			url: tarballUrl,
			responseType: 'stream',
			validateStatus: (status) => status >= 200 && status < 300, // Don't throw for non-2xx
		});

		// Pipe the download stream directly to tar extractor
		await new Promise((resolve, reject) => {
			response.data
				.pipe(
					tar.x({
						strip: 1, // Remove the top-level directory
						C: dataDir, // Extract to dataDir
					})
				)
				.on('finish', resolve)
				.on('error', reject);
		});
		console.log(`Successfully downloaded and extracted archive (${currentRef}) to ${dataDir}`);
	};

	try { // Outer try block (starts line 150 in previous read)
		await downloadAttempt(ref);
	} catch (error) {
		// Check if it was a 404 error and we tried 'main'
		if (ref === 'main' && error.response && error.response.status === 404) {
			console.warn(`Download failed for ref 'main' (404). Retrying with 'master'...`);
			ref = 'master'; // Set ref to master for the retry
			try { // Inner try block for master retry (starts line 157 in previous read)
				await downloadAttempt(ref);
			} catch (retryError) {
				console.error(`Retry with 'master' also failed: ${retryError.message}`);
				console.error('Falling back to git clone...');
				await fallbackToClone(); // Use a separate function for fallback
			} // End of inner try block for master retry
		} else { // This else belongs to the outer try/catch (line 150)
			// Handle other errors (non-404 on 'main', or any error on 'master' or specific ref)
			console.error(`Error downloading or extracting tarball (${ref}): ${error.message}`);
			console.error('Falling back to git clone...');
			await fallbackToClone(); // Use a separate function for fallback
		}
	} // End of outer try block (starting line 150)
}

// Helper function for fallback logic
async function fallbackToClone() {
	try {
		await cloneGitRepo();
	} catch (cloneError) {
		console.error(`Fallback git clone failed:`, cloneError);
		throw cloneError; // Re-throw the clone error if fallback fails
	}
}

/**
 * Cleans up the data directory by removing large files and common binary/media types.
 */
async function cleanupDataDir() {
	console.log(`Cleaning up data directory: ${dataDir}...`);
	const files = await glob('**/*', { cwd: dataDir, nodir: true, dot: true, absolute: true });
	let removedCount = 0;
	const maxSize = 100 * 1024; // 100 KB
	const forbiddenExtensions = new Set([
		// Images
		'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico',
		// Videos
		'.mp4', '.mov', '.avi', '.wmv', '.mkv', '.flv', '.webm',
		// Audio
		'.mp3', '.wav', '.ogg', '.aac', '.flac',
		// Archives
		'.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
		// Documents (often large or binary)
		'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
		// Executables / Libraries
		'.exe', '.dll', '.so', '.dylib', '.app',
		// Other potentially large/binary
		'.psd', '.ai', '.iso', '.dmg', '.pkg', '.deb', '.rpm'
	]);

	for (const file of files) {
		try {
			const stats = await fs.stat(file);
			const ext = path.extname(file).toLowerCase();

			if (forbiddenExtensions.has(ext) || stats.size > maxSize) {
				console.log(`Removing: ${file} (Size: ${stats.size} bytes, Ext: ${ext})`);
				await fs.remove(file);
				removedCount++;
			}
		} catch (error) {
			// Ignore errors for files that might disappear during iteration (e.g., broken symlinks)
			if (error.code !== 'ENOENT') {
				console.warn(`Could not process file ${file} during cleanup: ${error.message}`);
			}
		}
	}
	console.log(`Cleanup complete. Removed ${removedCount} files.`);
}

/**
 * Create a default configuration file if it doesn't exist.
 */
async function createDefaultConfig() {
	const configPath = path.join(rootDir, 'docs-mcp.config.json');

	if (!fs.existsSync(configPath)) {
		const defaultConfig = {
			includeDir: null,
			gitUrl: null,
			gitRef: 'main',
			autoUpdateInterval: 0, // Default changed previously
			enableBuildCleanup: true, // Added previously
			ignorePatterns: [
				'node_modules',
				'.git',
				'dist',
				'build',
				'coverage'
			]
		};

		await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
		console.log(`Created default configuration file at ${configPath}`);
	}
}

// Run the build process
async function build() {
	try {
		await createDefaultConfig();
		await prepareDataDir();

		// Perform cleanup if enabled
		if (config.enableBuildCleanup) {
			await cleanupDataDir();
		} else {
			console.log('Build cleanup is disabled via configuration.');
		}

		// Make the bin script executable
		const binPath = path.join(rootDir, 'bin', 'mcp');
		await fs.chmod(binPath, 0o755);
		console.log(`Made bin script executable: ${binPath}`);

		console.log('Build process finished successfully!'); // Moved completion message here
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

build();