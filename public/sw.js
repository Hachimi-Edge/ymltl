const CACHE_NAME = "yaml-translator-cache-v1";
const CORE_ASSETS = [
    "index.html",
    "manifest.json",
    "skeleton.min.css",
    "yaml.min.js",
    "alpinejs.min.js",
    "style.css",
    "main.js",
    "font-awesome-4.7.0/css/font-awesome.min.css",
    "font-awesome-4.7.0/fonts/fontawesome-webfont.woff2",
    "font-awesome-4.7.0/fonts/fontawesome-webfont.woff",
    "font-awesome-4.7.0/fonts/fontawesome-webfont.ttf"
];


self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(CORE_ASSETS);
		}).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				);
			})
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					return response;
				})
				.catch(() => {
					return caches.match(request).then((cached) => {
						return cached || caches.match("index.html");
					});
				})
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			const network = fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					return response;
				})
				.catch(() => cached);
			return cached || network;
		})
	);
});
