"use strict";
const stockSW = "./sw.js";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	try {
		// Dev helper: unregister only if path doesn't match to avoid stale workers
		if (swAllowedHostnames.includes(location.hostname)) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			for (const reg of registrations) {
				if (reg.active && !reg.active.scriptURL.includes(stockSW)) {
					console.log("Unregistering stale service worker:", reg.active.scriptURL);
					await reg.unregister();
				}
			}
		}

		const registration = await navigator.serviceWorker.register(stockSW, {
			scope: "/",
			updateViaCache: "none",
		});
		console.log("Service Worker registered successfully:", registration.scope);
		
		// Wait for the service worker to be ready
		await navigator.serviceWorker.ready;
		console.log("Service Worker is ready");
		
		return registration;
	} catch (error) {
		console.error("Service Worker registration failed:", error);
		throw error;
	}
}
