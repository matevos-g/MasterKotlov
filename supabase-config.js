// Client-side Supabase Configuration for Cloudflare Pages static site

window.SUPABASE_CONFIG = {
	url: "https://givjzuweurhdqkizbjhr.supabase.co",
	anonKey: "sb_publishable_0Deg4PTUFtSg8uAE5PeXmQ_WnCNpeRJ"
};

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
