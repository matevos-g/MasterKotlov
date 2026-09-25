// Client-side Supabase Configuration & Web Push Dispatcher for Cloudflare Pages static site

window.SUPABASE_CONFIG = {
	url: "https://givjzuweurhdqkizbjhr.supabase.co",
	anonKey: "sb_publishable_0Deg4PTUFtSg8uAE5PeXmQ_WnCNpeRJ"
};

// VAPID Web Push Keys
window.VAPID_PUBLIC_KEY = 'BG_RlCgVM2RmnBFpnF1oXpl7vZOEB1FJQ4CZJVXKy7vxpb5wl4uXZjw8lle7oecK3ahT6b7odsyID1Pv0EVlGtM';
window.VAPID_PRIVATE_KEY = '3DGMT5We-O67A7OTqWzizcPk9ceajeg2GmNRjapcE6w';

// Initialize Supabase client globally with session persistence (1 week+)
(function() {
	if (window.supabase && window.SUPABASE_CONFIG.url) {
		window.supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
				storage: window.localStorage
			}
		});
	} else {
		window.supabaseClient = null;
	}
})();

// Web Push Helpers
function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

function bytesToBase64Url(bytes) {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateVapidJwt(endpointUrl) {
	try {
		const urlObj = new URL(endpointUrl);
		const origin = urlObj.origin;

		const pubBytes = urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY);
		const xBytes = pubBytes.slice(1, 33);
		const yBytes = pubBytes.slice(33, 65);

		const jwk = {
			kty: 'EC',
			crv: 'P-256',
			x: bytesToBase64Url(xBytes),
			y: bytesToBase64Url(yBytes),
			d: window.VAPID_PRIVATE_KEY,
			ext: true
		};

		const importedKey = await crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['sign']
		);

		const header = { alg: 'ES256', typ: 'JWT' };
		const payload = {
			aud: origin,
			exp: Math.floor(Date.now() / 1000) + 43200,
			sub: 'mailto:info@masterkotlov.am'
		};

		const jsonToBase64Url = (obj) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
		const unsignedToken = jsonToBase64Url(header) + '.' + jsonToBase64Url(payload);

		const signatureBuffer = await crypto.subtle.sign(
			{ name: 'ECDSA', hash: { name: 'SHA-256' } },
			importedKey,
			new TextEncoder().encode(unsignedToken)
		);

		return unsignedToken + '.' + bytesToBase64Url(new Uint8Array(signatureBuffer));
	} catch (e) {
		console.warn('VAPID JWT generation error:', e);
		return null;
	}
}

async function dispatchWebPushToAll(payload) {
	if (!window.supabaseClient) return;

	try {
		let subscriptions = [];
		// 1. Primary: fetch from push_subscriptions table
		try {
			const { data } = await window.supabaseClient.from('push_subscriptions').select('*');
			if (data && data.length) subscriptions = data;
		} catch (e) {}

		// 2. Fallback: fetch from site_settings config
		try {
			const { data } = await window.supabaseClient.from('site_settings').select('*').eq('id', 'default').single();
			if (data && data.config && data.config.pushSubscriptions) {
				data.config.pushSubscriptions.forEach(fs => {
					if (!subscriptions.some(s => s.endpoint === fs.endpoint)) {
						subscriptions.push(fs);
					}
				});
			}
		} catch (e) {}

		console.log(`Dispatching Web Push to ${subscriptions.length} active admin subscriptions...`);

		for (const sub of subscriptions) {
			if (!sub.endpoint) continue;
			try {
				const jwt = await generateVapidJwt(sub.endpoint);
				if (!jwt) continue;

				await fetch(sub.endpoint, {
					method: 'POST',
					headers: {
						'Authorization': `vapid t=${jwt}, k=${window.VAPID_PUBLIC_KEY}`,
						'TTL': '60'
					},
					mode: 'no-cors'
				}).catch(() => {});
			} catch (err) {
				console.warn('Web push dispatch error for', sub.endpoint, err);
			}
		}
	} catch (err) {
		console.warn('dispatchWebPushToAll error:', err);
	}
}

window.urlBase64ToUint8Array = urlBase64ToUint8Array;
window.dispatchWebPushToAll = dispatchWebPushToAll;

