require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const {
	supabase,
	supabaseAdmin,
	getProducts,
	getProductById,
	getServiceRequests,
	createServiceRequest,
	hydrateProduct
} = require('./lib/supabase');

const app = express();
const port = process.env.PORT || 10000;
const configPath = path.join(__dirname, 'data', 'config.json');
const productsImageRoot = path.join(__dirname, 'images', 'products');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const defaultConfig = {
	brandName: "MasterKotlov",
	brandSubtext: "Կաթսաների վերանորոգում",
	phone: "+374 99 000000",
	email: "info@masterkotlov.am",
	address: "Երևան, Հայաստան",
	workingHours: "Երկ - Շբթ: 09:00 - 20:00",
	telegramUrl: "https://t.me/masterkotlov",
	whatsappUrl: "https://wa.me/37499000000",
	instagramUrl: "https://instagram.com/masterkotlov",
	facebookUrl: "https://facebook.com/masterkotlov",
	bookButtonText: "Ամրագրել",

	heroTitle: "Կաթսաների արագ և անվտանգ վերանորոգում",
	heroSubtitle: "Ախտորոշում, վերանորոգում և սեզոնային սպասարկում գազային ու պինդ վառելիքի կաթսաների համար։ Մասնագետը գալիս է նույն օրը, բացատրում է խնդրի պատճառը և կատարում աշխատանքը երաշխիքով։",
	heroCtaText: "Թողնել Սպասարկման Հայտ",
	heroSecondaryCtaText: "Տեսնել ծառայությունները",
	heroImageUrl: "/parts/1/photo_2026-09-24_22-10-10.jpg",

	navLink1: "Գլխավոր",
	navLink2: "Ծառայություններ",
	navLink3: "Ապրանքներ",
	navLink4: "Պահեստամասեր",

	servicesTitle: "Ամենապահանջված ծառայությունները",
	servicesSubtitle: "Աշխատանքը կատարվում է մաքուր և հստակ փուլերով. նախ ախտորոշում, հետո համաձայնեցված վերանորոգում և վերջում փորձարկում։",

	service1Title: "Ախտորոշում և գործարկում",
	service1Desc: "Ստուգվում է ավտոմատիկան, այրման ռեժիմը և ջերմային արդյունավետությունը, որպեսզի սարքը աշխատի կայուն։",
	service1Image: "/parts/1/photo_2026-09-24_22-10-11.jpg",

	service2Title: "Գազային կաթսաների վերանորոգում",
	service2Desc: "Սխալների կոդերի վերացում, հանգույցների փոխարինում և անվտանգության պարամետրերի ճշգրտում։",
	service2Image: "/parts/1/photo_2026-09-24_22-10-12.jpg",

	service3Title: "Սեզոնային սպասարկում",
	service3Desc: "Ջերմափոխանակիչի մաքրում, քաշի ստուգում և կանխարգելիչ աշխատանքներ մինչև սեզոնի մեկնարկ։",
	service3Image: "/parts/1/photo_2026-09-24_22-10-13.jpg",

	footerDesc: "Գազային և էլեկտրական կաթսաների պրոֆեսիոնալ վերանորոգում և սպասարկում Երևանում և հարակից շրջաններում։",
	copyrightText: "© MasterKotlov: Բոլոր իրավունքները պաշտպանված են:"
};

const loadConfig = () => {
	try {
		const raw = fs.readFileSync(configPath, 'utf8');
		return { ...defaultConfig, ...JSON.parse(raw) };
	} catch (error) {
		console.error('Failed to read config.json:', error);
		return defaultConfig;
	}
};

// ==========================================
// PUBLIC USER ROUTES
// ==========================================

app.get('/', async (req, res) => {
	const products = await getProducts();
	const topProducts = products.filter((product) => product.top);
	res.render('index', { topProducts, config: loadConfig(), activePath: '/' });
});

app.get('/products', async (req, res) => {
	const products = await getProducts();
	res.render('products', { products, config: loadConfig(), activePath: '/products' });
});

app.get('/parts/:id', async (req, res) => {
	const product = await getProductById(req.params.id);

	if (!product) {
		res.status(404).send('Product not found');
		return;
	}

	res.render('product-detail', { product, config: loadConfig(), activePath: '/products' });
});

// Public API endpoints
app.get('/api/products', async (req, res) => {
	const products = await getProducts();
	res.json(products);
});

const { sendPushNotificationToAll } = require('./lib/push-service');

// Submit Service Request / Order Endpoint
app.post('/api/service-request', async (req, res) => {
	try {
		const { firstName, lastName, phone, problemDescription, productId, productName } = req.body;
		if (!firstName || !lastName || !phone || !problemDescription) {
			return res.status(400).json({ success: false, message: 'Խնդրում ենք լրացնել բոլոր պարտադիր դաշտերը' });
		}

		const newRequest = await createServiceRequest({
			firstName,
			lastName,
			phone,
			problemDescription,
			productId,
			productName
		});

		// Trigger background Web Push to all devices (including closed app devices)
		sendPushNotificationToAll({
			title: 'Նոր Պատվեր',
			body: `${firstName} ${lastName}`.trim() || 'Հաճախորդ',
			url: '/admin/mobile/'
		}, supabaseAdmin || supabase);

		res.json({ success: true, message: 'Հայտը հաջողությամբ ուղարկվեց', data: newRequest });
	} catch (err) {
		console.error('Error creating service request:', err);
		res.status(500).json({ success: false, message: 'Սերվերի սխալ հայտը պահպանելիս' });
	}
});

// Explicit Web Push Endpoint
app.post('/api/send-push', async (req, res) => {
	try {
		const { title, body, url } = req.body;
		await sendPushNotificationToAll({
			title: title || 'Նոր Պատվեր',
			body: body || 'Հաճախորդ',
			url: url || '/admin/mobile/'
		}, supabaseAdmin || supabase);
		res.json({ success: true });
	} catch (err) {
		console.error('Send push API error:', err);
		res.status(500).json({ success: false, message: 'Push notification delivery error' });
	}
});

// ==========================================
// ADMIN DASHBOARD & MANAGEMENT ROUTES
// ==========================================

app.get('/admin/web/login', (req, res) => {
	res.render('admin/web/login');
});

app.get('/admin/web/products/:id', (req, res) => {
	res.render('admin/web/product-edit');
});

app.get('/admin/web', (req, res) => {
	res.render('admin/web/index');
});

app.get('/admin/mobile/login', (req, res) => {
	res.render('admin/mobile/login');
});

app.get('/admin/mobile/products/:id', (req, res) => {
	res.render('admin/mobile/product-edit');
});

app.get('/admin/mobile', (req, res) => {
	res.render('admin/mobile/index');
});

app.get('/admin', (req, res) => {
	res.render('admin/router');
});



// Admin Orders API
app.get('/admin/api/orders', async (req, res) => {
	const requests = await getServiceRequests();
	res.json(requests);
});

app.patch('/admin/api/orders/:id', async (req, res) => {
	const { status } = req.body;
	if (supabaseAdmin) {
		const { data, error } = await supabaseAdmin
			.from('service_requests')
			.update({ status })
			.eq('id', req.params.id)
			.select();
		if (error) return res.status(500).json({ success: false, error: error.message });
		return res.json({ success: true, data });
	}
	res.json({ success: true, message: 'Updated status (mock)' });
});

// Admin Products API
app.post('/admin/api/products', async (req, res) => {
	const { name, price, desk, description, top, images } = req.body;
	if (supabaseAdmin) {
		const { data, error } = await supabaseAdmin
			.from('products')
			.insert([{ name, price, desk, description, top, images }])
			.select();
		if (error) return res.status(500).json({ success: false, error: error.message });
		return res.json({ success: true, data: data[0] });
	}
	res.status(400).json({ success: false, message: 'Supabase integration required for product creation' });
});

app.put('/admin/api/products/:id', async (req, res) => {
	const { name, price, desk, description, top, images } = req.body;
	if (supabaseAdmin) {
		const { data, error } = await supabaseAdmin
			.from('products')
			.update({ name, price, desk, description, top, images })
			.eq('id', req.params.id)
			.select();
		if (error) return res.status(500).json({ success: false, error: error.message });
		return res.json({ success: true, data: data[0] });
	}
	res.json({ success: true, message: 'Updated product (mock)' });
});

app.delete('/admin/api/products/:id', async (req, res) => {
	if (supabaseAdmin) {
		const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id);
		if (error) return res.status(500).json({ success: false, error: error.message });
		return res.json({ success: true });
	}
	res.json({ success: true, message: 'Deleted product (mock)' });
});

// Admin CMS Settings API
app.get('/admin/api/config', (req, res) => {
	res.json(loadConfig());
});

app.post('/admin/api/config', async (req, res) => {
	try {
		const newConfig = { ...loadConfig(), ...req.body };
		fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');

		if (supabaseAdmin) {
			try {
				await supabaseAdmin
					.from('site_settings')
					.upsert([{ id: 'default', config: newConfig, updated_at: new Date().toISOString() }]);
			} catch (err) {
				console.warn('Could not sync settings to Supabase site_settings table:', err.message);
			}
		}

		res.json({ success: true, data: newConfig });
	} catch (err) {
		console.error('Error saving config:', err);
		res.status(500).json({ success: false, message: 'Սխալ կայքի կարգավորումները պահպանելիս' });
	}
});

// Static assets
app.use('/parts', express.static(productsImageRoot, { index: false, redirect: false }));
app.use(express.static(__dirname));

app.listen(port, '0.0.0.0', () => {
	console.log(`Server running on http://macbook.local:${port}`);
	console.log(`Admin dashboard available at http://macbook.local:${port}/admin`);
});
