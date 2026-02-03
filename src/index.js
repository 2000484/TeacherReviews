import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

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
	],
});

// Get the host for Scramjet configuration
const getHost = (req) => `${req.protocol || "http"}://${req.hostname || req.headers.host}`;

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
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				const path = (req.url || "").split("?")[0];
				// Handle both /wisp/ and /wsproxy/ for backwards compatibility
				if (path.startsWith("/wisp/") || path.startsWith("/wsproxy/")) {
					wisp.routeRequest(req, socket, head);
				} else {
					socket.end();
				}
			});
	},
});

fastify.addHook("onRequest", (request, reply, done) => {
	reply.header("X-Content-Type-Options", "nosniff");
	reply.header("Referrer-Policy", "no-referrer");
	reply.header("X-Frame-Options", "SAMEORIGIN");
	reply.header("X-XSS-Protection", "1; mode=block");
	reply.header(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains"
	);
	reply.header(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=()"
	);
	// For Spotify specifically, don't block certain headers
	reply.header("Access-Control-Allow-Origin", "*");
	reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
	reply.header("Access-Control-Allow-Headers", "*");
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
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
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
				...request.headers,
				host: parsedUrl.hostname,
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"accept-language": "en-US,en;q=0.9",
				"cache-control": "max-age=0",
				"upgrade-insecure-requests": "1",
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
