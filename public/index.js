"use strict";

// DOM Elements
const omniboxForm = document.getElementById("sj-omnibox");
const omniboxInput = document.getElementById("sj-omnibox-input");
const omniboxSuggestions = document.getElementById("sj-omnibox-suggestions");
const securityIcon = document.getElementById("sj-security-icon");
const backButton = document.getElementById("sj-back");
const forwardButton = document.getElementById("sj-forward");
const reloadButton = document.getElementById("sj-reload");
const homeNavButton = document.getElementById("sj-home-nav");
const bookmarkButton = document.getElementById("sj-bookmark");
const settingsButton = document.getElementById("sj-settings-btn");
const settingsModal = document.getElementById("sj-settings-modal");
const modalOverlay = document.getElementById("sj-modal-overlay");
const modalClose = document.getElementById("sj-modal-close");
const searchEngineSelect = document.getElementById("sj-search-engine-select");
const searchEngineInput = document.getElementById("sj-search-engine");
const customSearchWrap = document.getElementById("sj-custom-search-wrap");
const autoHttpsToggle = document.getElementById("sj-auto-https");
const rememberToggle = document.getElementById("sj-remember");
const swStatus = document.getElementById("sj-sw-status");
const transportStatus = document.getElementById("sj-transport-status");
const recentList = document.getElementById("sj-recent");
const cloakTitleInput = document.getElementById("sj-cloak-title");
const cloakIconInput = document.getElementById("sj-cloak-icon");
const applyCloakButton = document.getElementById("sj-apply-cloak");
const resetCloakButton = document.getElementById("sj-reset-cloak");
const favicon = document.getElementById("sj-favicon");
const homePage = document.getElementById("sj-home-page");
const tabsContainer = document.getElementById("sj-tabs");
const tabsContent = document.getElementById("sj-tabs-content");
const newTabButton = document.getElementById("sj-new-tab");
const loadingBar = document.getElementById("sj-loading-bar");
const clickLoading = document.getElementById("sj-click-loading");
const shortcutsButton = document.getElementById("sj-shortcuts-btn");
const shortcutsModal = document.getElementById("sj-shortcuts-modal");
const shortcutsOverlay = document.getElementById("sj-shortcuts-overlay");
const shortcutsClose = document.getElementById("sj-shortcuts-close");
const tabContextMenu = document.getElementById("sj-tab-context");
const startupModal = document.getElementById("sj-startup-modal");
const startupCloak = document.getElementById("sj-startup-cloak");
const startupFullscreen = document.getElementById("sj-startup-fullscreen");
const startupBoth = document.getElementById("sj-startup-both");
const startupSkip = document.getElementById("sj-startup-skip");
const bookmarkUrlInput = document.getElementById("sj-bookmark-url");
const bookmarkNameInput = document.getElementById("sj-bookmark-name");
const addBookmarkButton = document.getElementById("sj-add-bookmark");
const bookmarksList = document.getElementById("sj-bookmarks");
const bookmarksManage = document.getElementById("sj-bookmarks-manage");

// Home navigation elements
const homeNavButtons = document.querySelectorAll(".home-nav-btn");
const homeContent = document.getElementById("sj-home-content");
const appsContent = document.getElementById("sj-apps-content");
const gamesContent = document.getElementById("sj-games-content");
const chatContent = document.getElementById("sj-chat-content");
const gamesGrid = document.getElementById("sj-games-grid");

// Chat elements
const chatMessages = document.getElementById("sj-chat-messages");
const chatNameInput = document.getElementById("sj-chat-name");
const chatInput = document.getElementById("sj-chat-input");
const chatSendButton = document.getElementById("sj-chat-send");
const chatStatus = document.getElementById("sj-chat-status");

// Chat state
let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 10000; // 10 seconds in milliseconds
const usedNames = new Set();
let currentUserName = "";
const CHAT_CACHE_KEY = "sj-chat-cache";
const CHAT_RECONNECT_BASE = 2000;
const CHAT_RECONNECT_MAX = 15000;
const CHAT_POLL_INTERVAL = 3000;
let chatSocket = null;
let chatReconnectDelay = CHAT_RECONNECT_BASE;
let chatReconnectTimer = null;
let chatPollTimer = null;
let chatLastTimestamp = 0;

const chatClientId = (() => {
	const existing = sessionStorage.getItem("sj-chat-client-id");
	if (existing) return existing;
	const generated = typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `sj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	sessionStorage.setItem("sj-chat-client-id", generated);
	return generated;
})();

// Initialize activeFrame and homeButton variables (for legacy frame handling)
let activeFrame = null;
const homeButton = homeNavButton; // Alias for backward compatibility

const quickLinks = Array.from(document.querySelectorAll("[data-quick-url]"));

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	config: {
		// Don't use revealer to avoid blocking JavaScript execution
		// revealer: "top.location",
	},
});

const idleCallback = (cb, timeout = 1200) => {
	if (typeof window.requestIdleCallback === "function") {
		return window.requestIdleCallback(cb, { timeout });
	}
	return setTimeout(cb, timeout);
};

let scramjetInitPromise = null;
let scramjetReady = false;

async function ensureScramjet() {
	if (scramjetReady) return;
	if (!scramjetInitPromise) {
		scramjetInitPromise = (async () => {
			await scramjet.init();
			await scramjet.modifyConfig({
				flags: {
					strictRewrites: false,
					rewriterLogs: false,
					captureErrors: false,
					cleanErrors: true,
					sourcemaps: false,
					allowInvalidJs: true,
					allowFailedIntercepts: true,
					// Additional flags to help bypass Spotify detection
					inlineScripts: true,
					inlineCSS: true,
					corsProxy: true,
					// Aggressive SSL bypass for Spotify
					ignoreHttpsErrors: true,
					disableSecurity: true,
					unsafeAllowURIInscripts: true,
				},
				// Inject anti-proxy-detection code
				injection: {
					code: `
						// Bypass Spotify proxy detection
						window.navigator.__defineGetter__('webdriver', () => false);
						Object.defineProperty(navigator, 'webdriver', { value: false, writable: false });
						
						// Spoof performance metrics to look normal
						window.performance.navigation = undefined;
						
						// Hide proxy indicators
						Object.defineProperty(navigator, 'plugins', {
							get: () => [1, 2, 3, 4, 5],
						});
						
						// Make requests look direct
						const originalFetch = window.fetch;
						window.fetch = function(...args) {
							const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
							
							// For auth.hbomax.com, open in new window instead of proxying
							if (typeof url === 'string' && url.includes('auth.hbomax.com')) {
								console.log('[Injection] Blocking fetch to auth.hbomax.com:', url);
								window.open(url, 'hbomax_auth', 'width=500,height=700,menubar=no,toolbar=no');
								return Promise.reject(new Error('Opening auth in new window'));
							}
							
							// For other requests, remove proxy-revealing headers
							if (args[1]) {
								args[1].headers = args[1].headers || {};
								delete args[1].headers['x-forwarded-for'];
								delete args[1].headers['x-forwarded-proto'];
								delete args[1].headers['via'];
							}
							return originalFetch.apply(this, args);
						};
						
						// Intercept XMLHttpRequest to auth.hbomax.com
						const originalOpen = XMLHttpRequest.prototype.open;
						XMLHttpRequest.prototype.open = function(method, url, ...args) {
							if (typeof url === 'string' && url.includes('auth.hbomax.com')) {
								console.log('[Injection] Blocking XHR to auth.hbomax.com:', url);
								window.open(url, 'hbomax_auth', 'width=500,height=700,menubar=no,toolbar=no');
								throw new Error('Opening auth in new window');
							}
							return originalOpen.apply(this, [method, url, ...args]);
						};
					`,
				},
			});
			scramjetReady = true;
		})();
	}
	return scramjetInitPromise;
}

function scheduleScramjetWarmup() {
	if (typeof window.requestIdleCallback !== "function") return;
	window.requestIdleCallback(
		() => {
			ensureScramjet().catch((err) => {
				console.warn("Scramjet init/config failed:", err);
			});
		},
		{ timeout: 1500 }
	);
}

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

const SEARCH_ENGINES = {
	duckduckgo: "https://duckduckgo.com/?q=%s",
	brave: "https://search.brave.com/search?q=%s",
	startpage: "https://www.startpage.com/search?q=%s",
	custom: "",
};

const DEFAULT_SEARCH_ENGINE = "duckduckgo";

const STORAGE_KEYS = {
	engine: "sj-search-engine",
	customEngine: "sj-search-custom",
	autoHttps: "sj-auto-https",
	remember: "sj-remember",
	recent: "sj-recent",
	searches: "sj-searches",
	cloakTitle: "sj-cloak-title",
	cloakIcon: "sj-cloak-icon",
	bookmarks: "sj-bookmarks",
};

const defaultTitle = document.title;
const defaultFavicon = favicon?.getAttribute("href") || "";

function toScramjetUrl(url) {
	// Use direct HTTPS proxy for Spotify to bypass SSL issues
	if (url.includes("spotify.com")) {
		return `/spotify-proxy/${encodeURIComponent(url)}`;
	}
	return `/scramjet/${encodeURIComponent(url)}`;
}

function normalizeProxyUrl(url) {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		if (host === "geofs.com" || host === "www.geofs.com") {
			parsed.hostname = "geo-fs.com";
			return parsed.toString();
		}
	} catch (err) {
		return url;
	}
	return url;
}

let tabIdCounter = 0;
const tabs = new Map();
let activeTabId = null;
let isTransportReady = false;
let isSwReady = false;
let closedTabs = [];
let contextMenuTabId = null;
let draggedTab = null;

function setBadge(element, text, tone) {
	if (!element) return;
	element.textContent = text;
	element.classList.remove("good", "warn", "bad", "neutral");
	if (tone) element.classList.add(tone);
}

let currentErrorMessage = null;
let errorTimeout = null;

function clearError() {
	currentErrorMessage = null;
	if (errorTimeout) clearTimeout(errorTimeout);
}

function showError(message, details = "") {
	console.error(message, details);
	currentErrorMessage = message;
	
	// Show user-friendly error with auto-dismiss
	const errorDiv = document.createElement("div");
	errorDiv.style.cssText = `
		position: fixed;
		top: 60px;
		right: 20px;
		background: var(--danger, #f28b82);
		color: #202124;
		padding: 12px 16px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1000;
		max-width: 300px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.3);
		animation: slideIn 0.3s ease-out;
	`;
	errorDiv.textContent = message;
	
	document.body.appendChild(errorDiv);
	
	if (errorTimeout) clearTimeout(errorTimeout);
	errorTimeout = setTimeout(() => {
		errorDiv.style.animation = "slideOut 0.3s ease-in";
		setTimeout(() => errorDiv.remove(), 300);
	}, 5000);
	
	// Also log detailed info if provided
	if (details) console.error("Details:", details);
}

function showSuccess(message) {
	const successDiv = document.createElement("div");
	successDiv.style.cssText = `
		position: fixed;
		top: 60px;
		right: 20px;
		background: var(--success, #81c995);
		color: #202124;
		padding: 12px 16px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1000;
		animation: slideIn 0.3s ease-out;
	`;
	successDiv.textContent = message;
	
	document.body.appendChild(successDiv);
	
	setTimeout(() => {
		successDiv.style.animation = "slideOut 0.3s ease-in";
		setTimeout(() => successDiv.remove(), 300);
	}, 3000);
}

function updateCustomSearchVisibility() {
	const isCustom = searchEngineSelect.value === "custom";
	customSearchWrap.style.display = isCustom ? "flex" : "none";
	if (!isCustom) {
		searchEngineInput.value = SEARCH_ENGINES[searchEngineSelect.value];
	}
}

function saveSettings() {
	try {
		localStorage.setItem(STORAGE_KEYS.engine, searchEngineSelect.value);
		localStorage.setItem(STORAGE_KEYS.customEngine, searchEngineInput.value);
		localStorage.setItem(
			STORAGE_KEYS.autoHttps,
			autoHttpsToggle.checked ? "true" : "false"
		);
		localStorage.setItem(
			STORAGE_KEYS.remember,
			rememberToggle.checked ? "true" : "false"
		);
		localStorage.setItem(STORAGE_KEYS.cloakTitle, cloakTitleInput.value);
		localStorage.setItem(STORAGE_KEYS.cloakIcon, cloakIconInput.value);
	} catch (err) {
		console.warn("Failed to save settings:", err);
		// Continue silently - localStorage might be full or disabled
	}
}

function loadSettings() {
	try {
		const engine = localStorage.getItem(STORAGE_KEYS.engine);
		const customEngine = localStorage.getItem(STORAGE_KEYS.customEngine);
		const autoHttps = localStorage.getItem(STORAGE_KEYS.autoHttps);
		const remember = localStorage.getItem(STORAGE_KEYS.remember);
		const cloakTitle = localStorage.getItem(STORAGE_KEYS.cloakTitle);
		const cloakIcon = localStorage.getItem(STORAGE_KEYS.cloakIcon);

		if (engine && SEARCH_ENGINES[engine]) {
			searchEngineSelect.value = engine;
		} else {
			searchEngineSelect.value = DEFAULT_SEARCH_ENGINE;
		}
		if (customEngine) searchEngineInput.value = customEngine;
		if (autoHttps) autoHttpsToggle.checked = autoHttps === "true";
		if (remember) rememberToggle.checked = remember === "true";
		if (cloakTitle) cloakTitleInput.value = cloakTitle;
		if (cloakIcon) cloakIconInput.value = cloakIcon;

		updateCustomSearchVisibility();
		applyCloak(cloakTitleInput.value, cloakIconInput.value);
	} catch (err) {
		console.warn("Failed to load settings:", err);
		// Use defaults - silent failure for localStorage issues
	}
}

function getTemplate() {
	if (searchEngineSelect.value === "custom") {
		return searchEngineInput.value || SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE];
	}
	return (
		SEARCH_ENGINES[searchEngineSelect.value] ||
		SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]
	);
}

function applyCloak(title, icon) {
	document.title = title || defaultTitle;
	if (favicon && icon) {
		favicon.setAttribute("href", icon);
	} else if (favicon) {
		favicon.setAttribute("href", defaultFavicon);
	}
}

function resetCloak() {
	cloakTitleInput.value = "";
	cloakIconInput.value = "";
	applyCloak("", "");
	saveSettings();
}

function showStartupModal() {
	const alreadyShown = sessionStorage.getItem("sj-startup-shown") === "true";
	const isAboutBlank = location.href === "about:blank";
	const isIframe = window.self !== window.top;
	if (!startupModal || alreadyShown || isAboutBlank || isIframe) return;
	startupModal.hidden = false;
}

function hideStartupModal() {
	if (startupModal) startupModal.hidden = true;
	sessionStorage.setItem("sj-startup-shown", "true");
}

let clickLoadingTimeout = null;
function showClickLoading() {
	if (!clickLoading) return;
	clickLoading.hidden = false;
	if (clickLoadingTimeout) clearTimeout(clickLoadingTimeout);
	clickLoadingTimeout = setTimeout(() => {
		clickLoading.hidden = true;
	}, 600);
}

function requestFullscreen() {
	if (document.fullscreenElement) return Promise.resolve();
	if (document.documentElement.requestFullscreen) {
		return document.documentElement.requestFullscreen().catch(() => {});
	}
	return Promise.resolve();
}

function openAboutBlankCloak(withFullscreen = false) {
	const url = location.href;
	const win = window.open("about:blank", "_blank");
	if (!win) {
		alert("Pop-up blocked. Please allow pop-ups to use about:blank cloaking.");
		return false;
	}

	// Focus the new window so user knows it opened
	win.focus();

	win.document.open();
	win.document.write(`<!doctype html>
<html>
<head>
	<title>Schoology</title>
	<link rel="icon" href="${location.origin}/favicon.ico">
	<meta charset="utf-8" />
	<style>
		html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
		iframe { border: none; width: 100%; height: 100%; }
		#fs-overlay { position: fixed; inset: 0; display: ${withFullscreen ? "flex" : "none"}; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); color: #fff; font-family: Arial, sans-serif; z-index: 2; }
		#fs-overlay button { background: #8ab4f8; border: none; color: #202124; padding: 12px 20px; border-radius: 999px; font-size: 14px; cursor: pointer; }
	</style>
</head>
<body>
	<div id="fs-overlay"><button>Enter fullscreen</button></div>
	<iframe src="${url}" allow="fullscreen"></iframe>
	<script>
		const overlay = document.getElementById('fs-overlay');
		const btn = overlay.querySelector('button');
		btn.addEventListener('click', async () => {
			try {
				if (document.documentElement.requestFullscreen) {
					await document.documentElement.requestFullscreen();
				}
			} catch (e) {}
			overlay.style.display = 'none';
		});
	</script>
</body>
</html>`);
	win.document.close();
	return true;
}

function getOmniboxSuggestions(query) {
	const suggestions = [];
	const normalized = query.toLowerCase().trim();
	const seen = new Set();

	if (normalized) {
		suggestions.push({
			type: "search",
			title: `Search for "${query}"`,
			value: query,
		});
		seen.add(`search:${query.toLowerCase()}`);
	}

	const recentSearches = parseSearches();
	recentSearches.forEach((item) => {
		const term = item.term;
		if (!term) return;
		if (!normalized || term.toLowerCase().includes(normalized)) {
			const key = `term:${term.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "term",
				title: term,
				value: term,
			});
		}
	});

	const recentItems = parseRecent();
	recentItems.forEach((item) => {
		const urlText = item.url.toLowerCase();
		if (!normalized || urlText.includes(normalized)) {
			const key = `url:${item.url.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "url",
				title: item.url,
				value: item.url,
			});
		}
	});

	quickLinks.forEach((link) => {
		const url = link.getAttribute("data-quick-url");
		const title = link.querySelector("span")?.textContent || url;
		if (!url) return;
		if (
			!normalized ||
			title.toLowerCase().includes(normalized) ||
			url.toLowerCase().includes(normalized)
		) {
			const key = `url:${url.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "url",
				title,
				value: url,
			});
		}
	});

	return suggestions.slice(0, 8);
}

function renderOmniboxSuggestions(query) {
	if (!omniboxSuggestions) return;
	const items = getOmniboxSuggestions(query);
	if (items.length === 0) {
		omniboxSuggestions.hidden = true;
		omniboxSuggestions.innerHTML = "";
		return;
	}

	omniboxSuggestions.innerHTML = items
		.map((item) => {
			const subtitle =
				item.type === "search"
					? "Search"
					: item.type === "term"
						? "Previous search"
						: item.value;
			return `
				<button class="suggestion-item" data-type="${item.type}" data-value="${item.value}">
					<span class="suggestion-title">${item.title}</span>
					<span class="suggestion-url">${subtitle}</span>
				</button>
			`;
		})
		.join("");

	omniboxSuggestions.hidden = false;
}

function hideOmniboxSuggestions() {
	if (!omniboxSuggestions) return;
	omniboxSuggestions.hidden = true;
}

function parseRecent() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.recent);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		return [];
	}
}

function persistRecent(items) {
	localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(items));
}

function parseSearches() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.searches);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		return [];
	}
}

function persistSearches(items) {
	try {
		localStorage.setItem(STORAGE_KEYS.searches, JSON.stringify(items));
	} catch (err) {
		// Ignore localStorage errors
	}
}

function shouldStoreSearchTerm(input) {
	const trimmed = input.trim();
	if (!trimmed) return false;
	if (typeof looksLikeSchemeUrl === "function" && looksLikeSchemeUrl(trimmed)) {
		return false;
	}
	if (typeof looksLikeHostname === "function" && looksLikeHostname(trimmed)) {
		return false;
	}
	if (!trimmed.includes(" ") && trimmed.includes(".")) return false;
	return true;
}

function addSearchTerm(term) {
	const trimmed = term.trim();
	if (!trimmed) return;
	const items = parseSearches().filter((item) => item.term !== trimmed);
	items.unshift({ term: trimmed, time: Date.now() });
	persistSearches(items.slice(0, 8));
}

function removeRecent(index) {
	const items = parseRecent();
	items.splice(index, 1);
	persistRecent(items);
	renderRecent();
}

function clearAllRecent() {
	if (!confirm("Are you sure you want to delete all history? This cannot be undone.")) {
		return;
	}
	persistRecent([]);
	renderRecent();
	showSuccess("History cleared");
}

function parseBookmarks() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.bookmarks);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		console.warn("Failed to parse bookmarks:", err);
		return [];
	}
}

function persistBookmarks(bookmarks) {
	try {
		localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
	} catch (err) {
		console.warn("Failed to save bookmarks:", err);
	}
}

function addBookmark(url, name = null) {
	if (!url || !url.trim()) return false;
	
	try {
		// Validate URL format
		const urlObj = new URL(url.startsWith("http") ? url : "https://" + url);
		const validUrl = urlObj.href;
		const bookmarkName = name?.trim() || new URL(validUrl).hostname || url;
		
		const bookmarks = parseBookmarks();
		
		// Prevent duplicates
		if (bookmarks.some(b => b.url === validUrl)) {
			return false;
		}
		
		bookmarks.unshift({
			url: validUrl,
			name: bookmarkName,
			added: Date.now(),
		});
		
		persistBookmarks(bookmarks);
		renderBookmarks();
		return true;
	} catch (err) {
		console.error("Invalid bookmark URL:", err);
		return false;
	}
}

function removeBookmark(url) {
	const bookmarks = parseBookmarks();
	const filtered = bookmarks.filter(b => b.url !== url);
	persistBookmarks(filtered);
	renderBookmarks();
}

function renderBookmarks() {
	const bookmarks = parseBookmarks();
	
	// Render home page bookmarks
	if (bookmarksList) {
		bookmarksList.innerHTML = "";
		if (bookmarks.length === 0) {
			const empty = document.createElement("div");
			empty.className = "bookmark-item";
			empty.innerHTML = "<span>No bookmarks yet</span>";
			bookmarksList.appendChild(empty);
		} else {
			bookmarks.slice(0, 4).forEach((bookmark) => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "tile";
				btn.setAttribute("data-quick-url", bookmark.url);
				const span = document.createElement("span");
				span.textContent = bookmark.name; // Use textContent to avoid XSS
				btn.appendChild(span);
				btn.addEventListener("click", () => {
					omniboxInput.value = bookmark.url;
					omniboxForm.requestSubmit();
				});
				bookmarksList.appendChild(btn);
			});
		}
	}
	
	// Render settings bookmarks manager
	if (bookmarksManage) {
		bookmarksManage.innerHTML = "";
		if (bookmarks.length === 0) {
			const empty = document.createElement("p");
			empty.style.fontSize = "0.875rem";
			empty.style.color = "var(--text-secondary)";
			empty.textContent = "No bookmarks added yet";
			bookmarksManage.appendChild(empty);
		} else {
			const list = document.createElement("div");
			list.style.display = "flex";
			list.style.flexDirection = "column";
			list.style.gap = "8px";
			
			bookmarks.forEach((bookmark) => {
				const item = document.createElement("div");
				item.style.display = "flex";
				item.style.alignItems = "center";
				item.style.justifyContent = "space-between";
				item.style.padding = "8px";
				item.style.backgroundColor = "var(--surface-2)";
				item.style.borderRadius = "4px";
				item.style.fontSize = "0.875rem";
				
				const info = document.createElement("div");
				info.style.flex = "1";
				info.style.minWidth = "0";
				
				const nameDiv = document.createElement("div");
				nameDiv.style.fontWeight = "500";
				nameDiv.style.whiteSpace = "nowrap";
				nameDiv.style.overflow = "hidden";
				nameDiv.style.textOverflow = "ellipsis";
				nameDiv.textContent = bookmark.name;
				
				const urlDiv = document.createElement("div");
				urlDiv.style.fontSize = "0.75rem";
				urlDiv.style.color = "var(--text-secondary)";
				urlDiv.style.whiteSpace = "nowrap";
				urlDiv.style.overflow = "hidden";
				urlDiv.style.textOverflow = "ellipsis";
				urlDiv.textContent = bookmark.url;
				
				info.appendChild(nameDiv);
				info.appendChild(urlDiv);
				
				const deleteBtn = document.createElement("button");
				deleteBtn.type = "button";
				deleteBtn.className = "btn ghost";
				deleteBtn.textContent = "Remove";
				deleteBtn.style.marginLeft = "8px";
				deleteBtn.style.padding = "4px 8px";
				deleteBtn.style.fontSize = "0.75rem";
				deleteBtn.addEventListener("click", () => removeBookmark(bookmark.url));
				
				item.appendChild(info);
				item.appendChild(deleteBtn);
				list.appendChild(item);
			});
			
			bookmarksManage.appendChild(list);
		}
	}
}

function addRecent(url) {
	if (!rememberToggle.checked) return;
	const items = parseRecent().filter((item) => item.url !== url);
	items.unshift({ url, time: Date.now() });
	persistRecent(items.slice(0, 8));
	renderRecent();
}

function renderRecent() {
	const items = rememberToggle.checked ? parseRecent() : [];
	recentList.innerHTML = "";
	if (!items.length) {
		const empty = document.createElement("div");
		empty.className = "recent-item";
		empty.textContent = "No history yet";
		recentList.appendChild(empty);
		return;
	}

	items.forEach((item, index) => {
		const wrapper = document.createElement("div");
		wrapper.className = "recent-item";

		const contentDiv = document.createElement("div");
		contentDiv.className = "recent-item-content";

		const button = document.createElement("button");
		button.type = "button";
		button.className = "recent-link";
		button.textContent = item.url;
		button.addEventListener("click", () => {
			omniboxInput.value = item.url;
			omniboxForm.requestSubmit();
		});

		const meta = document.createElement("span");
		meta.className = "recent-meta";
		try {
			meta.textContent = new URL(item.url).hostname;
		} catch (err) {
			meta.textContent = "";
		}

		const deleteBtn = document.createElement("button");
		deleteBtn.type = "button";
		deleteBtn.className = "btn ghost recent-delete";
		deleteBtn.textContent = "✕";
		deleteBtn.title = "Delete this history item";
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			removeRecent(index);
		});

		contentDiv.appendChild(button);
		contentDiv.appendChild(meta);
		wrapper.appendChild(contentDiv);
		wrapper.appendChild(deleteBtn);
		recentList.appendChild(wrapper);
	});
}

function createTab(url = null, isHome = true) {
	// Enforce maximum tab limit
	const maxTabs = typeof _CONFIG !== 'undefined' && _CONFIG?.ui?.maxTabs ? _CONFIG.ui.maxTabs : 20;
	if (tabs.size >= maxTabs) {
		showError(`Maximum ${maxTabs} tabs allowed`, "Close some tabs before opening new ones");
		return null;
	}
	
	const id = ++tabIdCounter;

	const tab = {
		id,
		url,
		title: isHome ? "New Tab" : "Loading...",
		favicon: defaultFavicon || "/favicon.ico",
		isHome,
		homeSection: isHome ? "home" : null,
		frame: null,
		element: null,
		wrapper: null,
		navigationHistory: [],
		currentHistoryIndex: -1,
		isNavigatingWithinHistory: false,
	};

	const tabEl = document.createElement("div");
	tabEl.className = "tab";
	tabEl.dataset.tabId = id;

	const faviconEl = document.createElement("img");
	faviconEl.className = "tab-favicon";
	faviconEl.src = tab.favicon;
	faviconEl.alt = "";
	faviconEl.addEventListener("error", () => {
		faviconEl.src = defaultFavicon || "/favicon.ico";
	});

	const titleEl = document.createElement("span");
	titleEl.className = "tab-title";
	titleEl.textContent = tab.title;

	const closeBtn = document.createElement("button");
	closeBtn.className = "tab-close";
	closeBtn.type = "button";
	closeBtn.innerHTML = "×";
	closeBtn.title = "Close tab";

	tabEl.appendChild(faviconEl);
	tabEl.appendChild(titleEl);
	tabEl.appendChild(closeBtn);

	tabEl.addEventListener("click", (e) => {
		if (e.target !== closeBtn) {
			switchTab(id);
		}
	});

	tabEl.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		showTabContextMenu(e, id);
	});

	tabEl.addEventListener("mousedown", (e) => {
		if (e.button === 1) {
			e.preventDefault();
			closeTab(id);
		}
	});

	// Drag and drop
	tabEl.draggable = true;
	tabEl.addEventListener("dragstart", (e) => {
		draggedTab = id;
		tabEl.classList.add("dragging");
		e.dataTransfer.effectAllowed = "move";
	});

	tabEl.addEventListener("dragend", () => {
		tabEl.classList.remove("dragging");
		draggedTab = null;
	});

	tabEl.addEventListener("dragover", (e) => {
		e.preventDefault();
		if (draggedTab && draggedTab !== id) {
			const rect = tabEl.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			if (e.clientX < midpoint) {
				tabEl.style.borderLeft = "2px solid var(--accent)";
			} else {
				tabEl.style.borderRight = "2px solid var(--accent)";
			}
		}
	});

	tabEl.addEventListener("dragleave", () => {
		tabEl.style.borderLeft = "";
		tabEl.style.borderRight = "";
	});

	tabEl.addEventListener("drop", (e) => {
		e.preventDefault();
		tabEl.style.borderLeft = "";
		tabEl.style.borderRight = "";

		if (draggedTab && draggedTab !== id) {
			reorderTabs(draggedTab, id);
		}
	});

	closeBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		closeTab(id);
	});

	if (newTabButton && newTabButton.parentElement === tabsContainer) {
		tabsContainer.insertBefore(tabEl, newTabButton);
	} else {
		tabsContainer.appendChild(tabEl);
	}
	tab.element = tabEl;

	if (!isHome && url) {
		const wrapper = document.createElement("div");
		wrapper.className = "tab-frame-wrapper";
		wrapper.dataset.tabId = id;
		tabsContent.appendChild(wrapper);
		tab.wrapper = wrapper;
	}

	tabs.set(id, tab);
	switchTab(id);

	if (!isHome && url) {
		loadUrlInTab(id, url);
	}

	updateOmnibox();

	return id;
}

function switchTab(id) {
	if (activeTabId === id) return;

	// Hide all tabs and wrappers first
	tabs.forEach((tab) => {
		tab.element?.classList.remove("active");
		if (tab.wrapper) tab.wrapper.classList.remove("active");
	});

	const tab = tabs.get(id);
	if (!tab) {
		console.warn(`Cannot switch to non-existent tab ${id}`);
		return;
	}

	activeTabId = id;
	tab.element?.classList.add("active");

	if (tab.isHome) {
		homePage.hidden = false;
		loadingBar.hidden = true;
		applyHomeSection(tab.homeSection || "home");
	} else {
		homePage.hidden = true;
		if (tab.wrapper) {
			tab.wrapper.classList.add("active");
		}
	}

	updateOmnibox();
	updateBackForwardButtons();
	console.log(`[Tab ${id}] Switched to tab: ${tab.title}`);
}

function closeTab(id) {
	const tab = tabs.get(id);
	if (!tab) return;
	
	// Clear URL monitor to prevent memory leaks
	if (tab.urlMonitor) {
		clearInterval(tab.urlMonitor);
		tab.urlMonitor = null;
	}

	// Save to closed tabs for reopening
	if (!tab.isHome && tab.url) {
		closedTabs.push({
			url: tab.url,
			title: tab.title,
		});
		if (closedTabs.length > 10) closedTabs.shift();
	}

	tab.element?.remove();
	tab.wrapper?.remove();
	tabs.delete(id);

	if (activeTabId === id) {
		const remaining = Array.from(tabs.keys());
		if (remaining.length > 0) {
			switchTab(remaining[remaining.length - 1]);
		} else {
			createTab(null, true);
		}
	}
}

function reorderTabs(draggedId, targetId) {
	const draggedTab = tabs.get(draggedId);
	const targetTab = tabs.get(targetId);

	if (!draggedTab || !targetTab) return;

	const draggedEl = draggedTab.element;
	const targetEl = targetTab.element;

	if (draggedEl && targetEl) {
		targetEl.parentNode.insertBefore(draggedEl, targetEl);
	}
}

function showTabContextMenu(event, tabId) {
	contextMenuTabId = tabId;
	tabContextMenu.hidden = false;
	tabContextMenu.style.left = event.clientX + "px";
	tabContextMenu.style.top = event.clientY + "px";

	const closeOthersBtn = tabContextMenu.querySelector(
		'[data-action="close-others"]'
	);
	const closeRightBtn = tabContextMenu.querySelector(
		'[data-action="close-right"]'
	);

	closeOthersBtn.disabled = tabs.size <= 1;

	const tabArray = Array.from(tabs.keys());
	const tabIndex = tabArray.indexOf(tabId);
	closeRightBtn.disabled = tabIndex === tabArray.length - 1;
}

function hideTabContextMenu() {
	tabContextMenu.hidden = true;
	contextMenuTabId = null;
}

function handleContextAction(action) {
	if (!contextMenuTabId) return;

	const tab = tabs.get(contextMenuTabId);
	if (!tab) return;

	switch (action) {
		case "reload":
			if (!tab.isHome && tab.frame && tab.url) {
				loadingBar.hidden = false;
				tab.frame.go(tab.url);
				setTimeout(() => {
					loadingBar.hidden = true;
				}, 2000);
			}
			break;
		case "duplicate":
			if (!tab.isHome && tab.url) {
				const newTabId = createTab(tab.url, false);
				console.log(`[Tab ${tab.id}] Duplicated to new tab ${newTabId}`);
			}
			break;
		case "pin":
			tab.element?.classList.toggle("pinned");
			break;
		case "close":
			closeTab(contextMenuTabId);
			break;
		case "close-others":
			Array.from(tabs.keys()).forEach((id) => {
				if (id !== contextMenuTabId) closeTab(id);
			});
			break;
		case "close-right":
			const tabArray = Array.from(tabs.keys());
			const tabIndex = tabArray.indexOf(contextMenuTabId);
			tabArray.slice(tabIndex + 1).forEach((id) => closeTab(id));
			break;
	}

	hideTabContextMenu();
}

async function loadUrlInTab(id, url) {
	const tab = tabs.get(id);
	if (!tab) {
		showError("Tab not found");
		return;
	}

	if (!url || typeof url !== "string") {
		showError("Invalid URL provided");
		return;
	}

	tab.url = url;
	tab.isHome = false;

	// Show loading bar
	loadingBar.hidden = false;

	if (!tab.wrapper) {
		const wrapper = document.createElement("div");
		wrapper.className = "tab-frame-wrapper";
		wrapper.dataset.tabId = id;
		tabsContent.appendChild(wrapper);
		tab.wrapper = wrapper;
	}

	if (!tab.frame) {
		try {
			await ensureScramjet();
			// Clear any existing URL monitor before creating new frame
			if (tab.urlMonitor) {
				clearInterval(tab.urlMonitor);
				tab.urlMonitor = null;
			}
			
			tab.frame = scramjet.createFrame();
			if (!tab.frame) {
				throw new Error("Failed to create frame");
			}
			tab.frame.frame.style.width = "100%";
			tab.frame.frame.style.height = "100%";
			tab.frame.frame.style.border = "none";
			tab.wrapper.appendChild(tab.frame.frame);

			tab.frame.frame.addEventListener("load", () => {
				loadingBar.hidden = true;
				updateTabUI(id);
			
				// Extract and update the URL from the iframe
				try {
					const iframeSrc = tab.frame.frame.src;
					if (iframeSrc && iframeSrc.includes('/scramjet/')) {
						// Extract the encoded URL from the Scramjet proxy path
						const match = iframeSrc.match(/\/scramjet\/([^?#]+)/);
						if (match && match[1]) {
							try {
								const decodedUrl = decodeURIComponent(match[1]);
								tab.url = decodedUrl;
								console.log(`[Tab ${id}] Page loaded: ${decodedUrl}`);
							} catch (e) {
								console.warn("Failed to decode URL:", e);
							}
						}
					}
				} catch (err) {
					console.log("Could not extract URL from iframe:", err.message);
				}
			
				updateOmnibox();
				
				// Track URL changes within the iframe
				try {
					const contentWindow = tab.frame.frame.contentWindow;
					if (contentWindow) {
						// Listen for history changes
						contentWindow.addEventListener("popstate", () => {
							if (id === activeTabId) {
								updateOmnibox();
							}
						});
					}
				} catch (err) {
					console.warn("Unable to attach popstate listener:", err);
				}
			});

			tab.frame.frame.addEventListener("error", (e) => {
				loadingBar.hidden = true;
				tab.title = "Error loading page";
				updateTabUI(id);
				console.error("Frame error:", e);
			});
		} catch (err) {
			loadingBar.hidden = true;
			showError("Failed to initialize frame", err?.message || String(err));
			return;
		}
	}

	// Show the wrapper immediately
	homePage.hidden = true;
	tab.wrapper.classList.add("active");

	tab.title = "Loading...";
	updateTabUI(id);

	try {
		// Pass raw URL to Scramjet - it handles proxying internally via BareMux
		tab.frame.go(url);
		tab.url = url; // Keep original URL in tab object
		
		// Initialize navigation history immediately
		if (tab.navigationHistory.length === 0) {
			tab.navigationHistory = [url];
			tab.currentHistoryIndex = 0;
		}
		
		console.log(`[Tab ${id}] Navigating to: ${url}`);
		
		// Set up URL monitoring to track navigation changes
		if (tab.urlMonitor) {
			clearInterval(tab.urlMonitor);
		}
		
		tab.urlMonitor = setInterval(() => {
			try {
				const iframeSrc = tab.frame.frame.src;
				if (iframeSrc && iframeSrc.includes('/scramjet/')) {
					const match = iframeSrc.match(/\/scramjet\/([^?#]+)/);
					if (match && match[1]) {
						const decodedUrl = decodeURIComponent(match[1]);
						if (decodedUrl !== tab.url) {
							tab.url = decodedUrl;
							// Only update navigation history if we're not navigating within existing history
							if (!tab.isNavigatingWithinHistory) {
								updateTabNavigationHistory(id, decodedUrl);
							}
							if (id === activeTabId) {
								updateOmnibox();
							}
						}
					}
				}
			} catch (e) {
				// Silently ignore errors in monitoring
			}
		}, 500); // Check every 500ms

		setTimeout(() => {
			try {
				const hostname = new URL(url).hostname;
				tab.title = hostname;
				// Use local favicon only - no external tracking services like Google
				tab.favicon = defaultFavicon || "/favicon.ico";
				updateTabUI(id);
				updateOmnibox();
				
				// Try to detect if page actually loaded by checking DOM
				try {
					const contentWindow = tab.frame.frame.contentWindow;
					if (contentWindow && contentWindow.document && contentWindow.document.body) {
						const bodyHTML = contentWindow.document.body.innerHTML;
						if (!bodyHTML || bodyHTML.trim().length === 0) {
							console.warn(`[Tab ${id}] Warning: Page body is empty for ${url}`);
							showError("Page may not have loaded correctly", "Try refreshing or check the console for errors");
						}
					}
				} catch (e) {
					console.log("Could not check page content:", e.message);
				}
			} catch (err) {
				console.error("Error updating tab:", err);
				tab.title = "Untitled";
			}
			// Hide loading bar after longer timeout for complex sites like Wordle
			loadingBar.hidden = true;
		}, 3000); // Increased to 3 seconds for slow-loading sites
	} catch (err) {
		console.error("Error loading URL:", err);
		console.error("Error stack:", err?.stack);
		tab.title = "Error";
		updateTabUI(id);
		loadingBar.hidden = true;
		showError("Failed to load URL", err?.message || String(err));
	}
}

function updateTabUI(id) {
	const tab = tabs.get(id);
	if (!tab || !tab.element) return;

	const titleEl = tab.element.querySelector(".tab-title");
	const faviconEl = tab.element.querySelector(".tab-favicon");

	// Use textContent for security (prevents XSS)
	if (titleEl) titleEl.textContent = tab.title;
	if (faviconEl) {
		faviconEl.onerror = () => {
			faviconEl.src = defaultFavicon || "/favicon.ico";
		};
		// Validate favicon URL before setting
		try {
			if (tab.favicon && (tab.favicon.startsWith('http') || tab.favicon.startsWith('/'))) {
				faviconEl.src = tab.favicon;
			} else {
				faviconEl.src = defaultFavicon || "/favicon.ico";
			}
		} catch (err) {
			faviconEl.src = defaultFavicon || "/favicon.ico";
		}
	}
}

function closeFrame() {
	if (activeFrame?.frame?.parentElement) {
		activeFrame.frame.parentElement.removeChild(activeFrame.frame);
	}
	activeFrame = null;
	document.body.classList.remove("proxy-active");
	homeButton.hidden = true;
}

async function startFrame(url) {
	try {
		await ensureScramjet();
		if (!activeFrame) {
			activeFrame = scramjet.createFrame();
			activeFrame.frame.id = "sj-frame";
			document.body.appendChild(activeFrame.frame);
		}
		document.body.classList.add("proxy-active");
		homeButton.hidden = false;
		activeFrame.go(url);
	} catch (err) {
		showError("Failed to start proxy frame", err?.message || String(err));
	}
}

async function ensureTransport() {
	if (isTransportReady) return;

	setBadge(transportStatus, "Transport: connecting", "warn");
	const websocketBase =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host;
	const wispUrl = `${websocketBase}/wisp/`;

	// Prefer WISP-only libcurl transport to avoid wsproxy ArrayBuffer issues.
	try {
		const currentTransport = await connection.getTransport();
		if (currentTransport !== "epoxy-patched") {
			console.log("Initializing epoxy transport with wisp:", wispUrl);
			await connection.setManualTransport(
				`
					const { default: EpoxyTransport } = await import("/epoxy/index.mjs");
					class PatchedEpoxyTransport extends EpoxyTransport {
						async request(remote, method, body, headers, signal) {
							let normalizedHeaders = headers;
							if (headers && !headers[Symbol.iterator] && typeof headers === "object") {
								normalizedHeaders = Object.entries(headers);
							}
							return super.request(remote, method, body, normalizedHeaders, signal);
						}
					}
					return [PatchedEpoxyTransport, "epoxy-patched"];
				`,
				[{ wisp: wispUrl }]
			);
			console.log("Transport: epoxy+wisp initialized successfully");
		}

		isTransportReady = true;
		setBadge(transportStatus, "Transport: ready", "good");
		return;
	} catch (err) {
		console.error("Failed to initialize transport:", err);
		console.error("Error details:", err?.message, err?.stack);
		setBadge(transportStatus, "Transport: failed", "bad");
		throw new Error(`Transport initialization failed: ${err?.message || "Unknown error"}`);
	}
}

async function ensureSW() {
	if (isSwReady) return;

	setBadge(swStatus, "Service worker: registering", "warn");
	await registerSW();
	isSwReady = true;
	setBadge(swStatus, "Service worker: ready", "good");
}

function updateOmnibox() {
	const tab = tabs.get(activeTabId);
	if (!tab) return;

	if (tab.isHome) {
		omniboxInput.value = "";
		omniboxInput.placeholder = "Search Google or type a URL";
		securityIcon.classList.remove("secure");
	} else {
		omniboxInput.value = tab.url || "";
		try {
			const url = new URL(tab.url);
			if (url.protocol === "https:") {
				securityIcon.classList.add("secure");
			} else {
				securityIcon.classList.remove("secure");
			}
		} catch (err) {
			securityIcon.classList.remove("secure");
		}
	}
	updateBackForwardButtons();
}

// Helper function to update tab navigation history when URL changes
function updateTabNavigationHistory(tabId, newUrl) {
	const tab = tabs.get(tabId);
	if (!tab) return;

	// Remove any forward history if we're not at the end
	if (tab.currentHistoryIndex < tab.navigationHistory.length - 1) {
		tab.navigationHistory = tab.navigationHistory.slice(0, tab.currentHistoryIndex + 1);
	}

	// Only add if it's different from the current URL
	if (tab.navigationHistory[tab.currentHistoryIndex] !== newUrl) {
		tab.navigationHistory.push(newUrl);
		tab.currentHistoryIndex = tab.navigationHistory.length - 1;
	}

	updateBackForwardButtons();
}

// Helper function to update back/forward button states
function updateBackForwardButtons() {
	const tab = tabs.get(activeTabId);
	if (!tab) {
		backButton.disabled = true;
		forwardButton.disabled = true;
		return;
	}

	// Disable back button if at the beginning of history
	backButton.disabled = tab.currentHistoryIndex <= 0;

	// Disable forward button if at the end of history
	forwardButton.disabled = tab.currentHistoryIndex >= tab.navigationHistory.length - 1;
}

omniboxForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	clearError();
	showClickLoading();
	hideOmniboxSuggestions();

	const input = omniboxInput.value.trim();
	if (!input) {
		showError("Please enter a search term or URL.");
		return;
	}

	// Validate input length
	const maxLength = typeof _CONFIG !== 'undefined' && _CONFIG?.security?.maxUrlLength ? _CONFIG.security.maxUrlLength : 2048;
	if (input.length > maxLength) {
		showError(`URL or search term is too long (max ${maxLength} characters).`);
		return;
	}

	saveSettings();
	if (shouldStoreSearchTerm(input)) {
		addSearchTerm(input);
	}

	let url;
	try {
		url = search(input, getTemplate(), {
			autoHttps: autoHttpsToggle.checked,
		});
	} catch (err) {
		showError("Failed to process your input.", err?.message || String(err));
		return;
	}

	url = normalizeProxyUrl(url);

	if (!url) {
		showError("Unable to build a URL from that input.");
		return;
	}

	try {
		await ensureSW();
	} catch (err) {
		setBadge(swStatus, "Service worker: failed", "bad");
		showError(
			"Failed to register service worker.",
			err?.message || String(err)
		);
		return;
	}

	try {
		await ensureTransport();
	} catch (err) {
		setBadge(transportStatus, "Transport: failed", "bad");
		showError("Transport setup failed. Check your connection.", err?.message || String(err));
		return;
	}

	try {
		const currentTab = tabs.get(activeTabId);
		if (currentTab?.isHome) {
			await loadUrlInTab(activeTabId, url);
		} else {
			const newTabId = createTab(url, false);
			if (!newTabId) {
				// Tab creation failed (hit limit), load in current tab instead
				if (currentTab && !currentTab.isHome) {
					await loadUrlInTab(activeTabId, url);
				}
			}
		}

		addRecent(url);
	} catch (err) {
		showError("Failed to load page.", err?.message || String(err));
	}
});

searchEngineSelect.addEventListener("change", () => {
	updateCustomSearchVisibility();
	saveSettings();
});

searchEngineInput.addEventListener("change", saveSettings);

autoHttpsToggle.addEventListener("change", saveSettings);
rememberToggle.addEventListener("change", () => {
	saveSettings();
	renderRecent();
});

applyCloakButton.addEventListener("click", () => {
	applyCloak(cloakTitleInput.value, cloakIconInput.value);
	saveSettings();
});

resetCloakButton.addEventListener("click", resetCloak);

// Navigation controls
backButton.addEventListener("click", async () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (!tab || !tab.frame) return;

	// Navigate through our tracked history
	if (tab.currentHistoryIndex > 0) {
		tab.currentHistoryIndex--;
		const urlToLoad = tab.navigationHistory[tab.currentHistoryIndex];
		tab.url = urlToLoad;
		tab.isNavigatingWithinHistory = true;
		updateOmnibox();
		updateBackForwardButtons();
		try {
			tab.frame.go(urlToLoad);
			console.log(`[Tab ${tab.id}] Back to: ${urlToLoad}`);
		} catch (err) {
			console.error("Error navigating back:", err);
			showError("Failed to navigate back", err?.message);
		}
		// Reset flag after navigation completes
		setTimeout(() => {
			tab.isNavigatingWithinHistory = false;
		}, 1000);
	}
});

forwardButton.addEventListener("click", async () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (!tab || !tab.frame) return;

	// Navigate through our tracked history
	if (tab.currentHistoryIndex < tab.navigationHistory.length - 1) {
		tab.currentHistoryIndex++;
		const urlToLoad = tab.navigationHistory[tab.currentHistoryIndex];
		tab.url = urlToLoad;
		tab.isNavigatingWithinHistory = true;
		updateOmnibox();
		updateBackForwardButtons();
		try {
			tab.frame.go(urlToLoad);
			console.log(`[Tab ${tab.id}] Forward to: ${urlToLoad}`);
		} catch (err) {
			console.error("Error navigating forward:", err);
			showError("Failed to navigate forward", err?.message);
		}
		// Reset flag after navigation completes
		setTimeout(() => {
			tab.isNavigatingWithinHistory = false;
		}, 1000);
	}
});

reloadButton.addEventListener("click", () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (tab?.isHome) {
		renderRecent();
		renderBookmarks();
	} else if (tab?.frame && tab?.url) {
		// For Scramjet frames, reload using the go method with current URL
		loadingBar.hidden = false;
		try {
			tab.frame.go(tab.url);
			console.log(`[Tab ${tab.id}] Reloading: ${tab.url}`);
			setTimeout(() => {
				loadingBar.hidden = true;
			}, 2000);
		} catch (err) {
			console.error("Error reloading:", err);
			loadingBar.hidden = true;
			showError("Failed to reload page", err?.message);
		}
	} else if (tab?.frame) {
		// Fallback for frames without URL
		try {
			tab.frame.frame.contentWindow?.location.reload();
		} catch (err) {
			console.error("Error reloading frame:", err);
		}
	}
});

homeNavButton.addEventListener("click", () => {
	showClickLoading();
	if (activeTabId) {
		const tab = tabs.get(activeTabId);
		if (tab && !tab.isHome) {
			closeTab(activeTabId);
		}
		createTab(null, true);
	}
});

settingsButton.addEventListener("click", () => {
	showClickLoading();
	settingsModal.hidden = false;
});

modalClose.addEventListener("click", () => {
	settingsModal.hidden = true;
});

modalOverlay.addEventListener("click", () => {
	settingsModal.hidden = true;
});

bookmarkButton.addEventListener("click", () => {
	const tab = tabs.get(activeTabId);
	if (tab?.url) {
		const name = prompt("Bookmark name:", new URL(tab.url).hostname || tab.url);
		if (name !== null) {
			if (addBookmark(tab.url, name)) {
				showClickLoading();
				const feedback = document.createElement("div");
				feedback.textContent = "✓ Bookmark saved";
				feedback.style.cssText = "position: fixed; top: 20px; right: 20px; background: #34a853; color: white; padding: 12px 16px; border-radius: 4px; font-size: 14px; z-index: 1000;";
				document.body.appendChild(feedback);
				setTimeout(() => feedback.remove(), 2000);
			} else {
				alert("Bookmark already exists or invalid URL");
			}
		}
	} else {
		alert("No URL to bookmark. Navigate to a website first.");
	}
});

omniboxInput.addEventListener("focus", () => {
	omniboxInput.select();
});

newTabButton.addEventListener("click", () => {
	showClickLoading();
	createTab(null, true);
});

window.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "t") {
		event.preventDefault();
		const maxTabs = typeof _CONFIG !== 'undefined' && _CONFIG?.ui?.maxTabs ? _CONFIG.ui.maxTabs : 20;
		if (tabs.size < maxTabs) {
			createTab(null, true);
		} else {
			showError(`Maximum ${maxTabs} tabs reached`);
		}
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
		if (activeTabId && tabs.size > 1) {
			event.preventDefault();
			closeTab(activeTabId);
		}
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
		event.preventDefault();
		omniboxInput.focus();
		omniboxInput.select();
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
		event.preventDefault();
		reloadButton.click();
	}
	// Show shortcuts with Ctrl+/
	if (event.ctrlKey && event.key === "/") {
		event.preventDefault();
		shortcutsModal.hidden = false;
	}
	// Reopen closed tab with Ctrl+Shift+T
	if (event.ctrlKey && event.shiftKey && event.key === "T") {
		event.preventDefault();
		const lastClosed = closedTabs.pop();
		if (lastClosed) {
			createTab(lastClosed.url, false);
		}
	}
	// Cycle tabs with Ctrl+Tab and Ctrl+Shift+Tab
	if (event.ctrlKey && event.key === "Tab") {
		event.preventDefault();
		const tabArray = Array.from(tabs.keys());
		const currentIndex = tabArray.indexOf(activeTabId);

		if (event.shiftKey) {
			const prevIndex =
				currentIndex > 0 ? currentIndex - 1 : tabArray.length - 1;
			switchTab(tabArray[prevIndex]);
		} else {
			const nextIndex =
				currentIndex < tabArray.length - 1 ? currentIndex + 1 : 0;
			switchTab(tabArray[nextIndex]);
		}
	}
	// Jump to specific tab with Ctrl+1-9
	if (event.ctrlKey && event.key >= "1" && event.key <= "9") {
		event.preventDefault();
		const index = parseInt(event.key) - 1;
		const tabArray = Array.from(tabs.keys());
		if (index < tabArray.length) {
			switchTab(tabArray[index]);
		}
	}
	// Fullscreen with F11
	if (event.key === "F11") {
		event.preventDefault();
		requestFullscreen();
	}
});
quickLinks.forEach((link) => {
	link.addEventListener("click", () => {
		const url = link.getAttribute("data-quick-url");
		if (!url) return;
		omniboxInput.value = url;
		omniboxForm.requestSubmit();
	});
});

homePage.addEventListener("click", (event) => {
	const tile = event.target.closest("a.app-tile, a.game-tile");
	if (!tile) return;
	const url = tile.getAttribute("href");
	if (!url) return;
	event.preventDefault();
	openProxyUrl(url, { newTab: true });
});

// Context menu handlers
tabContextMenu.querySelectorAll("[data-action]").forEach((btn) => {
	btn.addEventListener("click", (e) => {
		const action = e.target.getAttribute("data-action");
		handleContextAction(action);
	});
});

document.addEventListener("click", () => {
	hideTabContextMenu();
});

document.addEventListener("click", (e) => {
	const clickable = e.target.closest(
		"button, a, .tab, .tile, .context-item, .suggestion-item, .recent-item button"
	);
	if (clickable) showClickLoading();
});

// Shortcuts modal handlers
shortcutsButton.addEventListener("click", () => {
	showClickLoading();
	shortcutsModal.hidden = false;
});

shortcutsClose.addEventListener("click", () => {
	shortcutsModal.hidden = true;
});

shortcutsOverlay.addEventListener("click", () => {
	shortcutsModal.hidden = true;
});

startupSkip.addEventListener("click", () => {
	hideStartupModal();
});

startupFullscreen.addEventListener("click", async () => {
	startupFullscreen.classList.add("loading");
	await requestFullscreen();
	hideStartupModal();
	startupFullscreen.classList.remove("loading");
});

startupCloak.addEventListener("click", () => {
	startupCloak.classList.add("loading");
	hideStartupModal();
	openAboutBlankCloak(false);
	startupCloak.classList.remove("loading");
});

startupBoth.addEventListener("click", () => {
	startupBoth.classList.add("loading");
	hideStartupModal();
	openAboutBlankCloak(true);
	startupBoth.classList.remove("loading");
});

// Omnibox suggestions
omniboxInput.addEventListener("input", () => {
	renderOmniboxSuggestions(omniboxInput.value);
});

omniboxInput.addEventListener("focus", () => {
	renderOmniboxSuggestions(omniboxInput.value);
});

omniboxInput.addEventListener("blur", () => {
	setTimeout(() => {
		hideOmniboxSuggestions();
	}, 120);
});

document.addEventListener("click", (e) => {
	if (!omniboxSuggestions.contains(e.target) && e.target !== omniboxInput) {
		hideOmniboxSuggestions();
	}
});

omniboxSuggestions.addEventListener("click", (e) => {
	const target = e.target.closest(".suggestion-item");
	if (!target) return;
	const value = target.getAttribute("data-value");
	const type = target.getAttribute("data-type");
	if (!value) return;

	if (type === "search") {
		omniboxInput.value = value;
	} else {
		omniboxInput.value = value;
	}
	omniboxForm.requestSubmit();
	hideOmniboxSuggestions();
});

loadSettings();
renderGames();
createTab(null, true);
idleCallback(() => {
	renderRecent();
	renderBookmarks();
}, 200);
scheduleScramjetWarmup();

// Add bookmark button handler
addBookmarkButton.addEventListener("click", () => {
	const url = bookmarkUrlInput.value.trim();
	const name = bookmarkNameInput.value.trim();
	
	if (!url) {
		alert("Please enter a URL");
		return;
	}
	
	if (addBookmark(url, name)) {
		bookmarkUrlInput.value = "";
		bookmarkNameInput.value = "";
		renderBookmarks();
	} else {
		alert("Failed to add bookmark. It may already exist.");
	}
});

// Allow Enter key in bookmark inputs
bookmarkUrlInput?.addEventListener("keypress", (e) => {
	if (e.key === "Enter") addBookmarkButton.click();
});

bookmarkNameInput?.addEventListener("keypress", (e) => {
	if (e.key === "Enter") addBookmarkButton.click();
});

// Clear history button
const clearHistoryButton = document.getElementById("sj-clear-history");
if (clearHistoryButton) {
	clearHistoryButton.addEventListener("click", clearAllRecent);
}

function applyHomeSection(section) {
	homeContent.hidden = section !== "home";
	appsContent.hidden = section !== "apps";
	gamesContent.hidden = section !== "games";
	chatContent.hidden = section !== "chat";

	homeNavButtons.forEach((btn) => {
		btn.classList.toggle("active", btn.getAttribute("data-nav") === section);
	});
}

function setHomeSection(section, tabId = activeTabId) {
	const tab = tabs.get(tabId);
	if (!tab || !tab.isHome) return;
	tab.homeSection = section;
	applyHomeSection(section);
}

homeNavButtons.forEach((btn) => {
	btn.addEventListener("click", () => {
		setHomeSection(btn.getAttribute("data-nav"));
	});
});

async function openProxyUrl(rawUrl, { newTab = true } = {}) {
	if (!rawUrl) return;
	let url = rawUrl;
	try {
		url = search(rawUrl, getTemplate(), {
			autoHttps: autoHttpsToggle.checked,
		});
	} catch (err) {
		showError("Failed to process the URL.", err?.message || String(err));
		return;
	}

	url = normalizeProxyUrl(url);

	if (!url) {
		showError("Unable to build a URL from that input.");
		return;
	}

	try {
		await ensureSW();
	} catch (err) {
		setBadge(swStatus, "Service worker: failed", "bad");
		showError("Failed to register service worker.", err?.message || String(err));
		return;
	}

	try {
		await ensureTransport();
	} catch (err) {
		setBadge(transportStatus, "Transport: failed", "bad");
		showError("Transport setup failed. Check your connection.", err?.message || String(err));
		return;
	}

	const currentTab = tabs.get(activeTabId);
	if (newTab) {
		const newTabId = createTab(url, false);
		if (!newTabId && currentTab && !currentTab.isHome) {
			await loadUrlInTab(activeTabId, url);
		}
	} else if (currentTab?.isHome) {
		await loadUrlInTab(activeTabId, url);
	}

	addRecent(url);
}

function renderGames() {
	if (!gamesGrid) return;

	const games = [
		{ name: "Run 3", url: "https://www.coolmathgames.com/0-run-3", source: "Coolmath" },
		{ name: "Run 2", url: "https://www.coolmathgames.com/0-run-2", source: "Coolmath" },
		{ name: "Run", url: "https://www.coolmathgames.com/0-run", source: "Coolmath" },
		{ name: "Fireboy & Watergirl: Forest Temple", url: "https://www.coolmathgames.com/0-fireboy-and-watergirl-forest-temple", source: "Coolmath" },
		{ name: "Fireboy & Watergirl: Ice Temple", url: "https://www.coolmathgames.com/0-fireboy-and-watergirl-ice-temple", source: "Coolmath" },
		{ name: "Fireboy & Watergirl: Crystal Temple", url: "https://www.coolmathgames.com/0-fireboy-and-watergirl-crystal-temple", source: "Coolmath" },
		{ name: "Fireboy & Watergirl: Light Temple", url: "https://www.coolmathgames.com/0-fireboy-and-watergirl-light-temple", source: "Coolmath" },
		{ name: "Fireboy & Watergirl: Elements", url: "https://www.coolmathgames.com/0-fireboy-and-watergirl-elements", source: "Coolmath" },
		{ name: "World's Hardest Game", url: "https://www.coolmathgames.com/0-worlds-hardest-game", source: "Coolmath" },
		{ name: "World's Hardest Game 2", url: "https://www.coolmathgames.com/0-worlds-hardest-game-2", source: "Coolmath" },
		{ name: "Bloxorz", url: "https://www.coolmathgames.com/0-bloxorz", source: "Coolmath" },
		{ name: "2048", url: "https://www.coolmathgames.com/0-2048", source: "Coolmath" },
		{ name: "Moto X3M", url: "https://www.coolmathgames.com/0-moto-x3m", source: "Coolmath" },
		{ name: "Moto X3M 2", url: "https://www.coolmathgames.com/0-moto-x3m-2", source: "Coolmath" },
		{ name: "Moto X3M 3", url: "https://www.coolmathgames.com/0-moto-x3m-3", source: "Coolmath" },
		{ name: "Moto X3M Winter", url: "https://www.coolmathgames.com/0-moto-x3m-4-winter", source: "Coolmath" },
		{ name: "Moto X3M Pool Party", url: "https://www.coolmathgames.com/0-moto-x3m-5-pool-party", source: "Coolmath" },
		{ name: "Moto X3M Spooky Land", url: "https://www.coolmathgames.com/0-moto-x3m-6-spooky-land", source: "Coolmath" },
		{ name: "Tiny Fishing", url: "https://www.coolmathgames.com/0-tiny-fishing", source: "Coolmath" },
		{ name: "Duck Life", url: "https://www.coolmathgames.com/0-duck-life", source: "Coolmath" },
		{ name: "Duck Life 2", url: "https://www.coolmathgames.com/0-duck-life-2", source: "Coolmath" },
		{ name: "Duck Life 3", url: "https://www.coolmathgames.com/0-duck-life-3", source: "Coolmath" },
		{ name: "Duck Life 4", url: "https://www.coolmathgames.com/0-duck-life-4", source: "Coolmath" },
		{ name: "Sugar, Sugar", url: "https://www.coolmathgames.com/0-sugar-sugar", source: "Coolmath" },
		{ name: "Sugar, Sugar 2", url: "https://www.coolmathgames.com/0-sugar-sugar-2", source: "Coolmath" },
		{ name: "Sugar, Sugar 3", url: "https://www.coolmathgames.com/0-sugar-sugar-3", source: "Coolmath" },
		{ name: "Papa's Pizzeria", url: "https://www.coolmathgames.com/0-papas-pizzeria", source: "Coolmath" },
		{ name: "Papa's Freezeria", url: "https://www.coolmathgames.com/0-papas-freezeria", source: "Coolmath" },
		{ name: "Papa's Burgeria", url: "https://www.coolmathgames.com/0-papas-burgeria", source: "Coolmath" },
		{ name: "Papa's Taco Mia", url: "https://www.coolmathgames.com/0-papas-taco-mia", source: "Coolmath" },
		{ name: "Papa's Hot Doggeria", url: "https://www.coolmathgames.com/0-papas-hot-doggeria", source: "Coolmath" },
		{ name: "Papa's Pancakeria", url: "https://www.coolmathgames.com/0-papas-pancakeria", source: "Coolmath" },
		{ name: "Papa's Sushiria", url: "https://www.coolmathgames.com/0-papas-sushiria", source: "Coolmath" },
		{ name: "Papa's Donuteria", url: "https://www.coolmathgames.com/0-papas-donuteria", source: "Coolmath" },
		{ name: "Papa's Cupcakeria", url: "https://www.coolmathgames.com/0-papas-cupcakeria", source: "Coolmath" },
		{ name: "Papa's Bakeria", url: "https://www.coolmathgames.com/0-papas-bakeria", source: "Coolmath" },
		{ name: "Papa's Wingeria", url: "https://www.coolmathgames.com/0-papas-wingeria", source: "Coolmath" },
		{ name: "Papa's Pastaria", url: "https://www.coolmathgames.com/0-papas-pastaria", source: "Coolmath" },
		{ name: "Papa's Cheeseria", url: "https://www.coolmathgames.com/0-papas-cheeseria", source: "Coolmath" },
		{ name: "Red Ball 4", url: "https://www.coolmathgames.com/0-red-ball-4", source: "Coolmath" },
		{ name: "Subway Surfers", url: "https://poki.com/en/g/subway-surfers", source: "Poki" },
		{ name: "Temple Run 2", url: "https://poki.com/en/g/temple-run-2", source: "Poki" },
		{ name: "Drive Mad", url: "https://poki.com/en/g/drive-mad", source: "Poki" },
		{ name: "Smash Karts", url: "https://poki.com/en/g/smash-karts", source: "Poki" },
		{ name: "Stickman Hook", url: "https://poki.com/en/g/stickman-hook", source: "Poki" },
		{ name: "Basketball Stars", url: "https://poki.com/en/g/basketball-stars", source: "Poki" },
		{ name: "Football Legends 2021", url: "https://poki.com/en/g/football-legends-2021", source: "Poki" },
		{ name: "Rooftop Snipers", url: "https://poki.com/en/g/rooftop-snipers", source: "Poki" },
		{ name: "Vex 7", url: "https://poki.com/en/g/vex-7", source: "Poki" },
		{ name: "Vex 8", url: "https://poki.com/en/g/vex-8", source: "Poki" },
		{ name: "Moto X3M (Poki)", url: "https://poki.com/en/g/moto-x3m", source: "Poki" },
		{ name: "Moto X3M 2 (Poki)", url: "https://poki.com/en/g/moto-x3m-2", source: "Poki" },
		{ name: "Moto X3M 3 (Poki)", url: "https://poki.com/en/g/moto-x3m-3", source: "Poki" },
		{ name: "Moto X3M Winter (Poki)", url: "https://poki.com/en/g/moto-x3m-winter", source: "Poki" },
		{ name: "Moto X3M Pool Party (Poki)", url: "https://poki.com/en/g/moto-x3m-pool-party", source: "Poki" },
		{ name: "Slope", url: "https://poki.com/en/g/slope", source: "Poki" },
		{ name: "Penalty Kick Online", url: "https://poki.com/en/g/penalty-kick-online", source: "Poki" },
		{ name: "Red Ball 4 (Poki)", url: "https://poki.com/en/g/red-ball-4", source: "Poki" },
		{ name: "Drift Boss", url: "https://poki.com/en/g/drift-boss", source: "Poki" },
		{ name: "Getaway Shootout", url: "https://poki.com/en/g/getaway-shootout", source: "Poki" },
		{ name: "Krunker", url: "https://www.crazygames.com/game/krunker-io", source: "CrazyGames" },
		{ name: "Shell Shockers", url: "https://www.crazygames.com/game/shell-shockers", source: "CrazyGames" },
		{ name: "BuildNow GG", url: "https://www.crazygames.com/game/buildnow-gg", source: "CrazyGames" },
		{ name: "1v1.LOL", url: "https://www.crazygames.com/game/1v1-lol", source: "CrazyGames" },
		{ name: "Basket Random", url: "https://www.crazygames.com/game/basket-random", source: "CrazyGames" },
		{ name: "Football Legends", url: "https://www.crazygames.com/game/football-legends", source: "CrazyGames" },
		{ name: "Drift Hunters", url: "https://www.crazygames.com/game/drift-hunters", source: "CrazyGames" },
		{ name: "Madalin Stunt Cars 2", url: "https://www.crazygames.com/game/madalin-stunt-cars-2", source: "CrazyGames" },
		{ name: "Madalin Stunt Cars 3", url: "https://www.crazygames.com/game/madalin-stunt-cars-3", source: "CrazyGames" },
		{ name: "Bullet Force", url: "https://www.crazygames.com/game/bullet-force", source: "CrazyGames" },
		{ name: "Zombs Royale", url: "https://www.crazygames.com/game/zombs-royale", source: "CrazyGames" },
		{ name: "Paper.io 2", url: "https://www.crazygames.com/game/paper-io-2", source: "CrazyGames" },
		{ name: "Hole.io", url: "https://www.crazygames.com/game/hole-io", source: "CrazyGames" },
		{ name: "EvoWars.io", url: "https://www.crazygames.com/game/evowars-io", source: "CrazyGames" },
		{ name: "Worms Zone", url: "https://www.crazygames.com/game/worms-zone", source: "CrazyGames" },
		{ name: "Narrow.One", url: "https://www.crazygames.com/game/narrow-one", source: "CrazyGames" },
		{ name: "Bloxd.io", url: "https://www.crazygames.com/game/bloxd-io", source: "CrazyGames" },
		{ name: "Snow Rider 3D", url: "https://www.crazygames.com/game/snow-rider-3d", source: "CrazyGames" },
		{ name: "Parkour Block 3D", url: "https://www.crazygames.com/game/parkour-block-3d", source: "CrazyGames" },
		{ name: "Stickman Hook (CrazyGames)", url: "https://www.crazygames.com/game/stickman-hook", source: "CrazyGames" },
		{ name: "Kingdom Rush", url: "https://www.kongregate.com/games/ironhidegames/kingdom-rush", source: "Kongregate" },
		{ name: "Kingdom Rush Frontiers", url: "https://www.kongregate.com/games/ironhidegames/kingdom-rush-frontiers", source: "Kongregate" },
		{ name: "GemCraft", url: "https://www.kongregate.com/games/gameinabottle/gemcraft", source: "Kongregate" },
		{ name: "Learn to Fly", url: "https://www.kongregate.com/games/light_bringer777/learn-to-fly", source: "Kongregate" },
		{ name: "Learn to Fly 2", url: "https://www.kongregate.com/games/light_bringer777/learn-to-fly-2", source: "Kongregate" },
		{ name: "Bloons TD", url: "https://www.kongregate.com/games/ninjakiwi/bloons-td", source: "Kongregate" },
		{ name: "Bloons TD 5", url: "https://www.kongregate.com/games/ninjakiwi/bloons-td-5", source: "Kongregate" },
		{ name: "Bad Ice-Cream", url: "https://www.kongregate.com/games/nitrome/bad-ice-cream", source: "Kongregate" },
		{ name: "Bad Ice-Cream 2", url: "https://www.kongregate.com/games/nitrome/bad-ice-cream-2", source: "Kongregate" },
		{ name: "Bad Ice-Cream 3", url: "https://www.kongregate.com/games/nitrome/bad-ice-cream-3", source: "Kongregate" },
		{ name: "The Last Stand", url: "https://armorgames.com/play/269/the-last-stand", source: "Armor Games" },
		{ name: "The Last Stand 2", url: "https://armorgames.com/play/1443/the-last-stand-2", source: "Armor Games" },
		{ name: "The Last Stand: Union City", url: "https://armorgames.com/play/5785/the-last-stand-union-city", source: "Armor Games" },
		{ name: "StrikeForce Kitty", url: "https://armorgames.com/play/12870/strikeforce-kitty", source: "Armor Games" },
		{ name: "StrikeForce Kitty 2", url: "https://armorgames.com/play/13765/strikeforce-kitty-2", source: "Armor Games" },
		{ name: "8 Ball Pool", url: "https://www.miniclip.com/games/8-ball-pool-multiplayer/en/", source: "Miniclip" },
		{ name: "Agar.io", url: "https://www.miniclip.com/games/agar-io/en/", source: "Miniclip" },
		{ name: "Basketball Stars (Miniclip)", url: "https://www.miniclip.com/games/basketball-stars/en/", source: "Miniclip" },
		{ name: "Soccer Stars", url: "https://www.miniclip.com/games/soccer-stars/en/", source: "Miniclip" },
		{ name: "Mini Golf King", url: "https://www.miniclip.com/games/mini-golf-king/en/", source: "Miniclip" },
	];

	gamesGrid.innerHTML = "";
	games.forEach((game) => {
		const tile = document.createElement("a");
		tile.className = "game-tile";
		tile.href = game.url;
		tile.setAttribute("data-source", game.source);

		const icon = document.createElement("div");
		icon.className = "game-icon";
		icon.textContent = game.source === "Coolmath" ? "🧩" : "🎮";

		const name = document.createElement("span");
		name.textContent = game.name;

		tile.appendChild(icon);
		tile.appendChild(name);
		gamesGrid.appendChild(tile);
	});
}

// Chat functionality
async function sendChatMessage() {
	const name = chatNameInput.value.trim();
	const message = chatInput.value.trim();

	if (!name) {
		chatStatus.textContent = "❌ Please enter your name";
		chatStatus.style.color = "var(--danger)";
		setTimeout(() => (chatStatus.textContent = ""), 3000);
		return;
	}

	if (!message) {
		chatStatus.textContent = "❌ Message cannot be empty";
		chatStatus.style.color = "var(--danger)";
		setTimeout(() => (chatStatus.textContent = ""), 3000);
		return;
	}

	const now = Date.now();
	if (now - lastMessageTime < MESSAGE_COOLDOWN) {
		const remaining = Math.ceil((MESSAGE_COOLDOWN - (now - lastMessageTime)) / 1000);
		chatStatus.textContent = `⏳ Wait ${remaining}s before sending another message`;
		chatStatus.style.color = "var(--warning)";
		return;
	}

	// Check if name is unique (locally for now)
	if (!currentUserName) {
		currentUserName = name;
		usedNames.add(name.toLowerCase());
	} else if (currentUserName !== name) {
		chatStatus.textContent = "❌ You must keep the same name in this session";
		chatStatus.style.color = "var(--danger)";
		setTimeout(() => (chatStatus.textContent = ""), 3000);
		return;
	}

	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		setChatStatus("Chat is disconnected. Trying fallback...", "warning");
		connectChatSocket();
		const fallbackOk = await sendChatFallback(name, message);
		if (!fallbackOk) return;

		// Reset input
		chatInput.value = "";
		chatStatus.textContent = "✓ Message sent";
		chatStatus.style.color = "var(--success)";
		setTimeout(() => (chatStatus.textContent = ""), 2000);
		lastMessageTime = now;
		return;
	}

	if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
		chatSocket.send(
			JSON.stringify({
				type: "message",
				name,
				message,
				clientId: chatClientId,
			})
		);
	}

	// Reset input
	chatInput.value = "";
	chatStatus.textContent = "✓ Message sent";
	chatStatus.style.color = "var(--success)";
	setTimeout(() => (chatStatus.textContent = ""), 2000);

	lastMessageTime = now;
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function appendChatMessage(msg) {
	const isOwn = msg.clientId && msg.clientId === chatClientId;
	const messageEl = document.createElement("div");
	messageEl.className = `chat-message ${isOwn ? "own" : ""}`;
	messageEl.innerHTML = `
		<div>
			<div class="chat-message-author">${escapeHtml(msg.name)}</div>
			<div class="chat-message-text">${escapeHtml(msg.message)}</div>
		</div>
	`;
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	if (typeof msg.timestamp === "number" && msg.timestamp > chatLastTimestamp) {
		chatLastTimestamp = msg.timestamp;
	}

	const cached = JSON.parse(localStorage.getItem(CHAT_CACHE_KEY) || "[]");
	cached.push({
		name: msg.name,
		message: msg.message,
		timestamp: msg.timestamp,
		clientId: msg.clientId || "",
	});
	if (cached.length > 100) cached.splice(0, cached.length - 100);
	localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(cached));
}

function renderChatHistory(messages) {
	chatMessages.innerHTML = "";
	messages.forEach((msg) => appendChatMessage(msg));
	const latest = messages.reduce((max, msg) => (
		typeof msg.timestamp === "number" && msg.timestamp > max ? msg.timestamp : max
	), 0);
	chatLastTimestamp = Math.max(chatLastTimestamp, latest);
}

function loadChatHistory() {
	const cached = JSON.parse(localStorage.getItem(CHAT_CACHE_KEY) || "[]");
	if (cached.length) {
		renderChatHistory(cached);
	}
}

function setChatStatus(text, tone) {
	chatStatus.textContent = text;
	if (!tone) {
		chatStatus.style.color = "";
		return;
	}
	const colorMap = {
		success: "var(--success)",
		warning: "var(--warning)",
		danger: "var(--danger)",
	};
	chatStatus.style.color = colorMap[tone] || "";
}

function scheduleChatReconnect() {
	if (chatReconnectTimer) return;
	chatReconnectTimer = setTimeout(() => {
		chatReconnectTimer = null;
		chatReconnectDelay = Math.min(chatReconnectDelay * 1.5, CHAT_RECONNECT_MAX);
		connectChatSocket();
	}, chatReconnectDelay);
}

function startChatPolling() {
	if (chatPollTimer) return;
	setChatStatus("Polling for updates...", "warning");
	chatPollTimer = setInterval(() => {
		pollChatMessages();
	}, CHAT_POLL_INTERVAL);
}

function stopChatPolling() {
	if (!chatPollTimer) return;
	clearInterval(chatPollTimer);
	chatPollTimer = null;
}

async function pollChatMessages() {
	try {
		const response = await fetch(`/api/chat/messages?since=${chatLastTimestamp}`, {
			cache: "no-store",
		});
		if (!response.ok) return;
		const data = await response.json();
		if (!data || !Array.isArray(data.messages)) return;
		data.messages.forEach((msg) => appendChatMessage(msg));
	} catch {
		setChatStatus("Polling failed", "danger");
	}
}

async function sendChatFallback(name, message) {
	try {
		const response = await fetch("/api/chat/send", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name,
				message,
				clientId: chatClientId,
			}),
		});
		if (!response.ok) {
			setChatStatus("Message failed to send", "danger");
			return false;
		}
		const data = await response.json();
		if (data?.message) {
			appendChatMessage(data.message);
		}
		return true;
	} catch {
		setChatStatus("Message failed to send", "danger");
		return false;
	}
}

function connectChatSocket() {
	if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) {
		return;
	}

	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const wsUrl = `${protocol}://${window.location.host}/chat`;
	chatSocket = new WebSocket(wsUrl);
	setChatStatus("Connecting...", "warning");

	chatSocket.addEventListener("open", () => {
		chatReconnectDelay = CHAT_RECONNECT_BASE;
		stopChatPolling();
		setChatStatus("Connected", "success");
		setTimeout(() => setChatStatus(""), 1500);
	});

	chatSocket.addEventListener("message", (event) => {
		let payload;
		try {
			payload = JSON.parse(event.data);
		} catch {
			return;
		}

		if (payload.type === "history" && Array.isArray(payload.messages)) {
			renderChatHistory(payload.messages);
			localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(payload.messages));
			return;
		}

		if (payload.type === "message" && payload.message) {
			appendChatMessage(payload.message);
		}
	});

	chatSocket.addEventListener("close", () => {
		startChatPolling();
		setChatStatus("Disconnected. Retrying...", "warning");
		scheduleChatReconnect();
	});

	chatSocket.addEventListener("error", () => {
		setChatStatus("Connection error", "danger");
	});
}

document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") {
		connectChatSocket();
	}
});

window.addEventListener("online", () => {
	connectChatSocket();
});

// Chat event listeners
chatSendButton.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => {
	if (e.key === "Enter") {
		sendChatMessage();
	}
});

// Load chat history on startup
loadChatHistory();
connectChatSocket();

