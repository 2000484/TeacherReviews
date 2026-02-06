import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { dirname, resolve } from "node:path";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const require = createRequire(import.meta.url);
const epoxyEntry = require.resolve("@mercuryworkshop/epoxy-transport");
const epoxyPath = resolve(dirname(epoxyEntry));

// Disable SSL verification globally for libcurl
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.CURL_CA_BUNDLE = "";
process.env.REQUESTS_CA_BUNDLE = "";
process.env.SSL_CERT_FILE = "";
process.env.SSL_KEY_FILE = "";
process.env.OPENSSL_CONF = "";
process.env.CURL_CA_BUNDLE = "";
process.env.REQUESTS_CA_BUNDLE = "";
process.env.SSL_CERT_FILE = "";
process.env.SSL_KEY_FILE = "";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

const httpServer = createServer();

const CHAT_HISTORY_LIMIT = 100;
const CHAT_NAME_LIMIT = 30;
const CHAT_MESSAGE_LIMIT = 200;
const chatHistory = [];

const wsServer = new WebSocketServer({ noServer: true });
const WS_HEARTBEAT_MS = 25000;

const broadcastChat = (payload) => {
	const message = JSON.stringify(payload);
	wsServer.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message);
		}
	});
};

const pushChatEntry = (entry) => {
	chatHistory.push(entry);
	if (chatHistory.length > CHAT_HISTORY_LIMIT) {
		chatHistory.splice(0, chatHistory.length - CHAT_HISTORY_LIMIT);
	}

	broadcastChat({ type: "message", message: entry });
};

const normalizeChatPayload = (payload) => {
	if (!payload || payload.type !== "message") return null;

	const name = String(payload.name || "").trim();
	const message = String(payload.message || "").trim();
	const clientId = String(payload.clientId || "").trim();

	if (!name || !message) return null;
	if (name.length > CHAT_NAME_LIMIT || message.length > CHAT_MESSAGE_LIMIT) return null;

	return {
		name,
		message,
		timestamp: Date.now(),
		clientId,
	};
};

wsServer.on("connection", (socket) => {
	socket.isAlive = true;
	socket.on("pong", () => {
		socket.isAlive = true;
	});

	socket.send(JSON.stringify({ type: "history", messages: chatHistory }));

	socket.on("message", (raw) => {
		let payload;
		try {
			payload = JSON.parse(raw.toString());
		} catch {
			return;
		}

		const entry = normalizeChatPayload(payload);
		if (!entry) return;
		pushChatEntry(entry);
	});
});

const wsHeartbeat = setInterval(() => {
	wsServer.clients.forEach((client) => {
		if (client.isAlive === false) {
			client.terminate();
			return;
		}
		client.isAlive = false;
		client.ping();
	});
}, WS_HEARTBEAT_MS);

wsServer.on("close", () => {
	clearInterval(wsHeartbeat);
});

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

Object.assign(wisp.options, {
	allow_udp_streams: false,
	// Don't blacklist any hosts - allow all connections
	hostname_blacklist: [],
	// Use multiple DNS servers for better connectivity
	dns_servers: ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"],
	// Disable certificate pinning and SSL verification for development
	tls_verify: false,
	ssl_verify_peer: false,
	ssl_verify_host: false,
	tls_insecure: true,
	no_certificate_verify: true,
	cainfo: false,
	verifypeer: false,
	verifyhost: false,
	insecure: true,
	sslverifypeer: false,
	sslverifyhost: false,
	// Force accept all certificates
	ssl_verifypeer: 0,
	ssl_verifyhost: 0,
	accept_insecure_certs: true,
	allow_insecure: true,
	// Increase timeout settings for better reliability
	tcp_timeout_ms: 120000, // 2 minutes
	dns_timeout_ms: 60000,  // 1 minute
	// Enable HTTP/2 support
	http2: true,
	// Custom header rewriter to bypass reCAPTCHA checks
	headers_whitelist: [
		"user-agent",
		"accept",
		"accept-language",
		"accept-encoding",
		"dnt",
		"origin",
		"referer",
		"authorization",
		"cookie",
		"content-type",
		"spotify-app-version",
		"x-spotify-app-version",
		"sec-fetch-dest",
		"sec-fetch-mode",
		"sec-fetch-site",
		"sec-ch-ua",
		"sec-ch-ua-mobile",
		"sec-ch-ua-platform",
	],
	// Header rewriter function to add spoofed headers for Spotify
	header_rewriter: (headers) => {
		// Add Chrome user agent if not present
		if (!headers["user-agent"]) {
			headers["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
		}
		
		// Add additional headers that Spotify expects
		if (!headers["sec-ch-ua"]) {
			headers["sec-ch-ua"] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
		}
		if (!headers["sec-ch-ua-mobile"]) {
			headers["sec-ch-ua-mobile"] = "?0";
		}
		if (!headers["sec-ch-ua-platform"]) {
			headers["sec-ch-ua-platform"] = '"Windows"';
		}
		
		// Remove proxy-revealing headers
		delete headers["x-forwarded-for"];
		delete headers["x-forwarded-proto"];
		delete headers["x-forwarded-host"];
		delete headers["via"];
		delete headers["x-real-ip"];
		delete headers["cf-connecting-ip"];
		
		return headers;
	},
});

// Get the host for Scramjet configuration
const getHost = (req) => `${req.protocol || "http"}://${req.hostname || req.headers.host}`;

let serverConfigured = false;

const fastify = Fastify({
	logger: process.env.NODE_ENV === "development" ? {
		level: "info",
		transport: {
			target: "pino-pretty",
			options: {
				translateTime: "HH:MM:ss Z",
				ignore: "pid,hostname",
			},
		},
	} : false,
	serverFactory: (handler) => {
		if (!serverConfigured) {
			httpServer
				.on("request", (req, res) => {
					// Don't set restrictive COOP/COEP headers for Spotify/HBO Max/Auth requests
					if (!req.url.includes("spotify") && !req.url.includes("hbomax") && !req.url.includes("max.com") && !req.url.includes("auth.") && !req.url.includes("/scramjet/") && !req.url.includes("/api/")) {
						res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
						res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					}
					handler(req, res);
				})
				.on("upgrade", (req, socket, head) => {
					const path = (req.url || "").split("?")[0];
					if (path === "/chat") {
						wsServer.handleUpgrade(req, socket, head, (ws) => {
							wsServer.emit("connection", ws, req);
						});
						return;
					}

					// Handle both /wisp/ and /wsproxy/ for backwards compatibility
					if (path.startsWith("/wisp/") || path.startsWith("/wsproxy/")) {
						wisp.routeRequest(req, socket, head);
						return;
					}

					socket.end();
				});
			serverConfigured = true;
		}

		return httpServer;
	},
});

fastify.addHook("onRequest", (request, reply, done) => {
	reply.header("X-Content-Type-Options", "nosniff");
	
	// Allow Spotify/HBO Max requests to work without restrictive headers
	const isAuthRequest = request.url.includes("auth.hbomax.com") ||
		request.url.includes("auth.max.com") ||
		request.url.includes("/auth.");
	const isEmbedAllowedRequest = request.url.includes("spotify") ||
		request.url.includes("hbomax") ||
		request.url.includes("max.com") ||
		isAuthRequest ||
		request.url.includes("/scramjet/") ||
		request.url.includes("/api/spotify");
	
	if (!isEmbedAllowedRequest) {
		reply.header("Referrer-Policy", "no-referrer");
		reply.header("X-Frame-Options", "SAMEORIGIN");
	} else {
		reply.header("Referrer-Policy", "same-origin");
		// Don't set X-Frame-Options at all for Spotify/HBO Max to allow embedding
	}
	
	reply.header("X-XSS-Protection", "1; mode=block");
	reply.header(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains"
	);
	// Remove restrictive permissions for Spotify/HBO Max/Auth
	if (!isEmbedAllowedRequest) {
		reply.header(
			"Permissions-Policy",
			"camera=(), microphone=(), geolocation=(), payment=()"
		);
	}
	// For Spotify specifically, don't block certain headers
	reply.header("Access-Control-Allow-Origin", "*");
	reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD");
	reply.header("Access-Control-Allow-Headers", "*");
	reply.header("Access-Control-Allow-Credentials", "true");
	reply.header("Access-Control-Expose-Headers", "*");
	
	// For auth requests, ensure cookies and credentials flow through
	if (isAuthRequest) {
		reply.header("Vary", "Origin, Accept, Accept-Encoding");
	}
	
	done();
});

// Strip Content Security Policy headers from responses (especially for Spotify)
fastify.addHook("onSend", (request, reply, payload, done) => {
	const isEmbedAllowedRequest = request.url.includes("spotify") ||
		request.url.includes("hbomax") ||
		request.url.includes("max.com");	
	// Force correct content type for JavaScript resources
	const contentType = reply.getHeader("content-type");
	if ((request.url.includes(".js") || request.url.includes("javascript")) && 
	    (!contentType || contentType === "text/html")) {
		reply.removeHeader("content-security-policy");
		reply.removeHeader("content-security-policy-report-only");
		reply.removeHeader("x-content-security-policy");
		reply.removeHeader("x-webkit-csp");
		reply.header("content-type", "application/javascript; charset=utf-8");
	}
		if (isEmbedAllowedRequest) {
		// Remove CSP/Frame headers that can block proxy embedding
		reply.removeHeader("content-security-policy");
		reply.removeHeader("content-security-policy-report-only");
		reply.removeHeader("x-content-security-policy");
		reply.removeHeader("x-webkit-csp");
		reply.removeHeader("x-frame-options");
	}
	done();
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
	maxAge: "1h",
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

// Handle OPTIONS requests for CORS preflight
fastify.options("*", async (request, reply) => {
	reply.code(204).send();
});

fastify.get("/api/chat/history", async (request, reply) => {
	return reply.code(200).send({ messages: chatHistory });
});

fastify.get("/api/chat/messages", async (request, reply) => {
	const since = Number.parseInt(request.query?.since, 10);
	const sinceValue = Number.isFinite(since) ? since : 0;
	const messages = chatHistory.filter((msg) => msg.timestamp > sinceValue);
	return reply.code(200).send({ messages });
});

fastify.post("/api/chat/send", async (request, reply) => {
	const entry = normalizeChatPayload({
		type: "message",
		name: request.body?.name,
		message: request.body?.message,
		clientId: request.body?.clientId,
	});

	if (!entry) {
		return reply.code(400).send({ error: "Invalid chat payload" });
	}

	pushChatEntry(entry);
	return reply.code(200).send({ message: entry });
});

// Special HTTPS proxy for Spotify with disabled SSL verification
fastify.all("/spotify-proxy/*", async (request, reply) => {
	const https = await import("node:https");
	const url = require("node:url");
	
	try {
		const encodedUrl = request.url.substring("/spotify-proxy/".length);
		const spotifyUrl = decodeURIComponent(encodedUrl) || "https://open.spotify.com/";
		const parsedUrl = url.parse(spotifyUrl);
		
		const options = {
			hostname: parsedUrl.hostname,
			path: parsedUrl.path,
			method: request.method,
			headers: {
				host: parsedUrl.hostname,
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"accept-language": "en-US,en;q=0.9",
				"cache-control": "max-age=0",
					"upgrade-insecure-requests": "1",
				"sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": '"Windows"',
				"sec-fetch-dest": "document",
				"sec-fetch-mode": "navigate",
				"sec-fetch-site": "none",
				"sec-fetch-user": "?1",
					"x-forwarded-for": undefined,
					"x-forwarded-proto": undefined,
					"x-forwarded-host": undefined,
					"x-original-forwarded-for": undefined,
					"cf-connecting-ip": undefined,
					"cf-ipcountry": undefined,
				},
			rejectUnauthorized: false,
			checkServerIdentity: () => undefined,
		};
		
		// Remove proxy-related headers
		delete options.headers["x-forwarded-for"];
		delete options.headers["x-forwarded-proto"];
		delete options.headers["x-forwarded-host"];
		delete options.headers["x-original-forwarded-for"];
		delete options.headers["cf-connecting-ip"];
		delete options.headers["cf-ipcountry"];
		delete options.headers["via"];
		delete options.headers["connection"];
		
		return new Promise((resolve, reject) => {
			const req = https.request(options, (res) => {
				// Strip proxy-revealing headers from response
				delete res.headers["via"];
				delete res.headers["x-cache"];
				
				reply.code(res.statusCode);
				Object.keys(res.headers).forEach(key => {
					reply.header(key, res.headers[key]);
				});
				res.pipe(reply.raw);
			});
			
			req.on("error", (err) => {
				reply.code(500).send({ error: err.message });
				reject(err);
			});
			
			request.raw.pipe(req);
		});
	} catch (err) {
		reply.code(500).send({ error: err.message });
	}
});

// Route handler for Scramjet iframe proxy
fastify.all("/scramjet/*", async (request, reply) => {
	try {
		// Extract the URL from the path after /scramjet/
		const encodedUrl = request.url.substring("/scramjet/".length);
		const targetUrl = decodeURIComponent(encodedUrl);

		// Return HTML with iframe that will load the target URL through Scramjet
		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Loading...</title>
				<style>
					html, body {
						margin: 0;
						padding: 0;
						width: 100%;
						height: 100%;
						overflow: hidden;
					}
					iframe {
						width: 100%;
						height: 100%;
						border: none;
					}
				</style>
			</head>
			<body>
				<script>
					const targetUrl = '${targetUrl}';

					// Load Scramjet controller
					const script = document.createElement('script');
					script.src = '/scram/scramjet.all.js';
					document.head.appendChild(script);
					
					script.onload = async () => {
						try {
							const { ScramjetController } = window.$scramjetLoadController();
							const scramjet = new ScramjetController({
								files: {
									wasm: '/scram/scramjet.wasm.wasm',
									all: '/scram/scramjet.all.js',
									sync: '/scram/scramjet.sync.js',
								}
							});
							
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
								},
							});
							
							const rewrittenUrl = await scramjet.rewriteUrl(targetUrl);
							window.location.href = rewrittenUrl;
						} catch (err) {
							// Silently fail
						}
			</script>
		</body>
		</html>
		`;

		return reply.type("text/html").send(html);
	} catch (error) {
		return reply.code(500).send({
			error: "Failed to process proxy request",
			message: error.message,
		});
	}
});

// API endpoint to clear proxy cache and data
fastify.post("/api/clear-cache", async (request, reply) => {
	try {
		// Clear WISP cache and DNS cache
		if (wisp && wisp.options) {
			// Reset DNS cache by clearing the DNS servers list and re-initializing
			wisp.options.dns_servers = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"];
		}

		return reply.code(200).send({
			success: true,
			message: "Proxy cache, cookies, and DNS cache have been cleared",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		return reply.code(500).send({
			success: false,
			message: "Failed to clear cache",
			error: error.message,
		});
	}
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("error", (err) => {
	if (err.code === "EADDRINUSE") {
		process.exit(1);
	}
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (err) => {
	shutdown();
});

function shutdown() {
	fastify.close(() => {
		process.exit(0);
	});
	
	// Force exit after 10 seconds if graceful shutdown fails
	setTimeout(() => {
		process.exit(1);
	}, 10000);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
