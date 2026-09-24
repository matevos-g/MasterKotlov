const webpush = require('web-push');

const VAPID_PUBLIC_KEY = 'BG_RlCgVM2RmnBFpnF1oXpl7vZOEB1FJQ4CZJVXKy7vxpb5wl4uXZjw8lle7oecK3ahT6b7odsyID1Pv0EVlGtM';
const VAPID_PRIVATE_KEY = '3DGMT5We-O67A7OTqWzizcPk9ceajeg2GmNRjapcE6w';

webpush.setVapidDetails(
	'mailto:info@masterkotlov.am',
	VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY
);

async function sendPushNotificationToAll(payload, supabaseClient) {
	try {
		let subscriptions = [];
		if (supabaseClient) {
			const { data } = await supabaseClient.from('push_subscriptions').select('*');
			if (data) subscriptions = data;
		}

		console.log(`Sending Web Push notification to ${subscriptions.length} active subscriptions...`);

		const pushPromises = subscriptions.map(async (sub) => {
			const pushSubscription = {
				endpoint: sub.endpoint,
				keys: {
					p256dh: sub.p256dh,
					auth: sub.auth
				}
			};

			try {
				await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
				console.log(`Successfully delivered push to ${sub.endpoint.slice(0, 30)}...`);
			} catch (err) {
				console.warn(`Web push delivery error for ${sub.endpoint.slice(0, 30)}:`, err.statusCode || err.message);
				if (err.statusCode === 410 || err.statusCode === 404) {
					// Expired or uninstalled subscription -> delete from DB
					if (supabaseClient) {
						await supabaseClient.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
					}
				}
			}
		});

		await Promise.all(pushPromises);
	} catch (err) {
		console.error('sendPushNotificationToAll error:', err);
	}
}

module.exports = {
	VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY,
	sendPushNotificationToAll
};
