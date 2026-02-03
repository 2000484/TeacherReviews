// Configuration for the proxy
const _CONFIG = {
	// Default search engine - using DuckDuckGo (no reCAPTCHA required)
	defaultSearchEngine: "duckduckgo",
	
	// Transport settings - use WISP for server-side proxying
	transport: {
		type: "wisp",
		wisp: {
			endpoint: "/wisp/",
		},
	},
	
	// Feature flags
	features: {
		enableBookmarks: true,
		enableHistory: true,
		enableTabs: true,
		enableCloaking: true,
		enableShortcuts: true,
	},
	
	// UI settings
	ui: {
		maxTabs: 20,
		maxHistoryItems: 50,
		maxBookmarks: 100,
		loadingTimeout: 3000,
	},
	
	// Security settings
	security: {
		allowedProtocols: ["http:", "https:", "ftp:"],
		maxUrlLength: 2048,
		sanitizeInput: true,
	},
};
