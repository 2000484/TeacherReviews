"use strict";
/**
 * Converts user input to a fully qualified URL
 * @param {string} input
 * @param {string} template Template for a search query.
 * @param {{ autoHttps?: boolean }} [options]
 * @returns {string} Fully qualified URL
 */
function search(input, template, options = {}) {
	const trimmed = input.trim();
	if (!trimmed) return "";

	// Validate input length
	if (trimmed.length > 2048) {
		console.warn("Input exceeds maximum length of 2048 characters");
		return "";
	}

	// Validate template
	if (!template || typeof template !== "string" || !template.includes("%s")) {
		console.warn("Invalid search template");
		return "";
	}

	if (looksLikeSchemeUrl(trimmed)) {
		try {
			const url = new URL(trimmed);
			// Whitelist safe protocols
			if (!["http:", "https:", "ftp:"].includes(url.protocol)) {
				console.warn(`Unsafe protocol: ${url.protocol}`);
				return template.replace("%s", encodeURIComponent(trimmed));
			}
			return url.toString();
		} catch (err) {
			console.warn("Invalid URL scheme:", err);
			return template.replace("%s", encodeURIComponent(trimmed));
		}
	}

	if (trimmed.includes(" ")) {
		return template.replace("%s", encodeURIComponent(trimmed));
	}

	if (looksLikeHostname(trimmed)) {
		const protocol = options.autoHttps ? "https://" : "http://";
		try {
			const url = new URL(`${protocol}${trimmed}`);
			return url.toString();
		} catch (err) {
			console.warn("Invalid hostname:", err);
			return template.replace("%s", encodeURIComponent(trimmed));
		}
	}

	return template.replace("%s", encodeURIComponent(trimmed));
}

function looksLikeSchemeUrl(value) {
	return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function looksLikeHostname(value) {
	// Check for localhost
	if (value === "localhost") return true;
	
	// Check for IPv4 address
	if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(value)) {
		// Validate IPv4 octets are 0-255
		const octets = value.split(":")[0].split(".");
		return octets.every((octet) => {
			const num = parseInt(octet, 10);
			return num >= 0 && num <= 255;
		});
	}
	
	// Check for domain name (must have a dot)
	if (value.includes(".") && !value.endsWith(".")) {
		// Additional validation: each part should be alphanumeric with hyphens
		const parts = value.split(".");
		return parts.every((part) => /^[a-z0-9-]+$/i.test(part) && part.length > 0);
	}
	
	return false;
}
