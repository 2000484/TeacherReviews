importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
	const requestUrl = event.request?.url || "";
	console.log("[SW] Intercepting request:", requestUrl);
	
	const isMaxAuth = requestUrl.includes("auth.hbomax.com") ||
		requestUrl.includes("auth.max.com") ||
		requestUrl.includes("/auth.") && (requestUrl.includes("hbomax.com") || requestUrl.includes("max.com"));
	
	// For auth requests, bypass Scramjet entirely and use direct fetch through BareMux
	if (isMaxAuth) {
		console.log("[SW] Auth request detected, attempting direct fetch:", requestUrl);
		try {
			const response = await fetch(event.request);
			console.log("[SW] Auth direct fetch succeeded! Status:", response.status);
			
			// Strip CSP headers for auth responses
			const headers = new Headers(response.headers);
			headers.delete('content-security-policy');
			headers.delete('content-security-policy-report-only');
			headers.delete('x-content-security-policy');
			headers.delete('x-webkit-csp');
			headers.delete('x-frame-options');
			headers.delete('frame-ancestors');
			headers.delete('x-xss-protection');
			headers.delete('x-content-type-options');
			headers.set('access-control-allow-credentials', 'true');
			
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers
			});
		} catch (authErr) {
			console.error("[SW] CRITICAL - Auth fetch failed completely");
			console.error("[SW] Error name:", authErr.name);
			console.error("[SW] Error message:", authErr.message);
			console.error("[SW] Error type:", authErr.constructor.name);
			console.error("[SW] Full error:", authErr);
			
			// Log the exact failure type
			if (authErr.message.includes('refused')) {
				console.error("[SW] Connection REFUSED by server");
			} else if (authErr.message.includes('timeout')) {
				console.error("[SW] Connection TIMEOUT");
			} else if (authErr.message.includes('DNS')) {
				console.error("[SW] DNS resolution failed");
			} else if (authErr.message.includes('CORS')) {
				console.error("[SW] CORS error");
			} else if (authErr.message.includes('cert')) {
				console.error("[SW] Certificate error");
			} else {
				console.error("[SW] Unknown connection error");
			}
			
			return new Response("Auth connection failed: " + authErr.message, { 
				status: 503,
				headers: { "content-type": "text/plain" }
			});
		}
	}
	
	try {
		await scramjet.loadConfig();
		if (scramjet.route(event)) {
			console.log("[SW] Scramjet routing request:", requestUrl);

			let response;
			try {
				console.log("[SW] Attempting Scramjet fetch for:", requestUrl);
				response = await scramjet.fetch(event);
				console.log("[SW] Scramjet fetch succeeded, status:", response?.status);
			} catch (err) {
				console.error("[SW] Scramjet fetch error:", err.message || err);
				console.error("[SW] Error type:", err.constructor.name);
				
				// For auth requests that fail, try direct fetch with specific headers
				if (isMaxAuth) {
					console.log("[SW] Auth request failed, attempting direct fetch with auth headers");
					try {
						const authRequest = new Request(event.request, {
							headers: new Headers({
								...Object.fromEntries(event.request.headers),
								'Accept': '*/*',
								'Accept-Language': 'en-US,en;q=0.9',
								'Connection': 'keep-alive',
								'Upgrade-Insecure-Requests': '1',
							})
						});
						console.log("[SW] Attempting direct fetch for auth:", requestUrl);
						response = await fetch(authRequest);
						console.log("[SW] Direct auth fetch succeeded, status:", response?.status);
					} catch (authErr) {
						console.error("[SW] Direct auth fetch error:", authErr.message || authErr);
					}
				}
				
				// If still no response, try standard fallback
				if (!response) {
					try {
						console.log("[SW] Attempting fallback direct fetch for:", requestUrl);
						response = await fetch(event.request);
						console.log("[SW] Fallback fetch succeeded, status:", response?.status);
					} catch (fetchErr) {
						console.error("[SW] Fallback fetch error:", fetchErr.message || fetchErr);
						response = null;
					}
				}
			}
			
			if (!response) {
				console.error("[SW] All fetch attempts failed for:", requestUrl);
				return new Response("Fetch failed - connection refused", { 
					status: 503,
					headers: { "content-type": "text/plain" }
				});
			}
			
			// Strip CSP/frame headers from ALL HBO Max and auth responses (critical for auth pages)
			const url = requestUrl;
			if (url.includes("spotify") || url.includes("hbomax") || url.includes("max.com") || isMaxAuth) {
				console.log("[SW] Applying HBO Max header stripping for:", url);
				const headers = new Headers(response.headers);
				// Aggressively remove all CSP-related headers for auth pages
				headers.delete('content-security-policy');
				headers.delete('content-security-policy-report-only');
				headers.delete('x-content-security-policy');
				headers.delete('x-webkit-csp');
				headers.delete('x-frame-options');
				headers.delete('x-frame-options');
				headers.delete('frame-ancestors');
				headers.delete('x-xss-protection');
				headers.delete('x-content-type-options');
				
				// For auth pages, ensure we support credentials
				if (isMaxAuth) {
					headers.set('access-control-allow-credentials', 'true');
				}
				
				// Preserve content type
				const contentType = response.headers.get('content-type');
				if (contentType) {
					headers.set('content-type', contentType);
				}
				
				// Clone response with modified headers
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: headers
				});
			}
			
			return response;
		}
		
		console.log("[SW] Scramjet did not route, using direct fetch:", requestUrl);
		return fetch(event.request);
	} catch (err) {
		console.error("[SW] Service worker error:", err);
		return fetch(event.request).catch(() => {
			return new Response("Service worker error: " + err.message, { status: 500 });
		});
	}
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
