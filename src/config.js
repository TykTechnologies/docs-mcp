import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const defaultConfig = {
	// Directory to include in the package (for static docs)
	includeDir: null,

	// Git repository URL (for dynamic docs)
	gitUrl: null,

	// Git branch or tag to checkout
	gitRef: 'main',

	// Auto-update interval in minutes (0 to disable)
	autoUpdateInterval: 0, // Default to 0 (disabled)

	// Data directory for searching
	dataDir: path.resolve(__dirname, '..', 'data'),

	// MCP Tool configuration
	toolName: 'search_docs',
	toolDescription: 'Search documentation using the probe search engine.',

	// Ignore patterns
	ignorePatterns: [
		'node_modules',
		'.git',
		'dist',
		'build',
		'coverage'
	],
	// Enable cleanup of large/binary files after build (default: true)
	enableBuildCleanup: true
};

/**
 * Load configuration from config file and environment variables
 * @returns {Object} Configuration object
 */
export function loadConfig() {
	// Parse command line arguments
	const args = minimist(process.argv.slice(2));

	// Check for config file path in arguments
	const configPath = args.config || path.resolve(__dirname, '..', 'docs-mcp.config.json');

	let config = { ...defaultConfig };

	// Load configuration from file if it exists
	if (fs.existsSync(configPath)) {
		try {
			const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
			config = { ...config, ...fileConfig };
			console.error(`Loaded configuration from ${configPath}`);
		} catch (error) {
			console.error(`Error loading configuration from ${configPath}:`, error);
		}
	} else {
		console.error(`No configuration file found at ${configPath}, using defaults`);
	}

	// Override with environment variables
	if (process.env.INCLUDE_DIR) config.includeDir = process.env.INCLUDE_DIR;
	if (process.env.GIT_URL) config.gitUrl = process.env.GIT_URL;
	if (process.env.GIT_REF) config.gitRef = process.env.GIT_REF;
	if (process.env.AUTO_UPDATE_INTERVAL) config.autoUpdateInterval = parseInt(process.env.AUTO_UPDATE_INTERVAL, 10);
	if (process.env.DATA_DIR) config.dataDir = process.env.DATA_DIR;
	if (process.env.TOOL_NAME) config.toolName = process.env.TOOL_NAME;
	if (process.env.TOOL_DESCRIPTION) config.toolDescription = process.env.TOOL_DESCRIPTION;

	// Override with command line arguments
	if (args.includeDir) config.includeDir = args.includeDir;
	if (args.gitUrl) config.gitUrl = args.gitUrl;
	if (args.gitRef) config.gitRef = args.gitRef;
	if (args.autoUpdateInterval !== undefined) config.autoUpdateInterval = parseInt(args.autoUpdateInterval, 10);
	if (args.dataDir) config.dataDir = args.dataDir;
	if (args.toolName) config.toolName = args.toolName;
	if (args.toolDescription) config.toolDescription = args.toolDescription;
	if (args.enableBuildCleanup !== undefined) config.enableBuildCleanup = args.enableBuildCleanup === true || args.enableBuildCleanup === 'true';

	// Ensure dataDir is an absolute path
	if (!path.isAbsolute(config.dataDir)) {
		config.dataDir = path.resolve(process.cwd(), config.dataDir);
	}

	// Ensure includeDir is an absolute path if provided
	if (config.includeDir && !path.isAbsolute(config.includeDir)) {
		config.includeDir = path.resolve(process.cwd(), config.includeDir);
	}

	// Validate configuration
	if (config.includeDir && config.gitUrl) {
		console.warn('Both includeDir and gitUrl are specified. Using gitUrl.');
		config.includeDir = null; // Prioritize gitUrl
	}
	if (!config.includeDir && !config.gitUrl) {
		console.warn('Neither includeDir nor gitUrl is specified. The data directory will be empty unless manually populated.');
	}

	return config;
}