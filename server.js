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

const loadConfig = () => {
	try {
		const raw = fs.readFileSync(configPath, 'utf8');
		return JSON.parse(raw);
	} catch (error) {
		console.error('Failed to read config.json:', error);
		return { phone: '+374 99 000000' };
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

		res.json({ success: true, message: 'Հայտը հաջողությամբ ուղարկվեց', data: newRequest });
	} catch (err) {
		console.error('Error creating service request:', err);
		res.status(500).json({ success: false, message: 'Սերվերի սխալ հայտը պահպանելիս' });
	}
});

// ==========================================
// ADMIN DASHBOARD & MANAGEMENT ROUTES
// ==========================================

app.get('/admin/login', (req, res) => {
	res.render('admin/login', {
		supabaseUrl: process.env.SUPABASE_URL || '',
		supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
	});
});

app.post('/admin/api/login', (req, res) => {
	const { email, password } = req.body;
	// Default dev admin fallback if Supabase auth is not active yet
	if (email === 'admin@masterkotlov.am' && password === 'admin123') {
		return res.json({ success: true, message: 'Logged in successfully' });
	}
	res.status(401).json({ success: false, message: 'Անվավեր էլ. փոստ կամ գաղտնաբառ' });
});

app.get('/admin/dashboard', (req, res) => {
	res.render('admin/dashboard', {
		supabaseUrl: process.env.SUPABASE_URL || '',
		supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
	});
});

app.get('/admin', (req, res) => {
	res.redirect('/admin/dashboard');
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

// Static assets
app.use('/parts', express.static(productsImageRoot, { index: false, redirect: false }));
app.use(express.static(__dirname));

app.listen(port, '0.0.0.0', () => {
	console.log(`Server running on http://macbook.local:${port}`);
	console.log(`Admin dashboard available at http://macbook.local:${port}/admin`);
});
