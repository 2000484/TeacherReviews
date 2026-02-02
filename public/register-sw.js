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
		// Dev helper: clear old registrations on localhost to avoid stale workers
		if (swAllowedHostnames.includes(location.hostname)) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((reg) => reg.unregister()));
		}

		const registration = await navigator.serviceWorker.register(stockSW);
		console.log("Service Worker registered successfully:", registration.scope);
		return registration;
	} catch (error) {
		console.error("Service Worker registration failed:", error);
		throw error;
	}
}
