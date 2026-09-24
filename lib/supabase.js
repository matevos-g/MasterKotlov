require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
	supabase = createClient(supabaseUrl, supabaseAnonKey);
	if (supabaseServiceKey && !supabaseServiceKey.includes('your-service-role-key')) {
		supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
	} else {
		supabaseAdmin = supabase;
	}
}

const productsPath = path.join(__dirname, '..', 'data', 'products.json');
const productsImageRoot = path.join(__dirname, '..', 'images', 'products');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

const normalizeAssetPath = (assetPath = '') =>
	assetPath.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '').replace(/\/+$/, '');

const toPublicPath = (assetPath) =>
	`/${normalizeAssetPath(assetPath)
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/')}`;

const resolveDirectoryImages = (absolutePath, publicPath) => {
	if (!fs.existsSync(absolutePath)) return [];
	return fs
		.readdirSync(absolutePath)
		.filter((fileName) => imageExtensions.has(path.extname(fileName).toLowerCase()))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
		.map((fileName) => toPublicPath(`${publicPath}/${fileName}`));
};

const resolveProductImages = (product) => {
	if (Array.isArray(product.images) && product.images.length > 0) {
		return product.images;
	}

	if (!product.image && product.id) {
		const productImageDirectory = path.join(productsImageRoot, String(product.id));
		try {
			const assetStats = fs.statSync(productImageDirectory);
			if (assetStats.isDirectory()) {
				return resolveDirectoryImages(productImageDirectory, `/parts/${product.id}`);
			}
		} catch (error) {
			return [];
		}
	}

	if (!product.image) {
		return [];
	}

	if (/^https?:\/\//i.test(product.image)) {
		return [product.image];
	}

	const normalizedPath = normalizeAssetPath(product.image);
	const absolutePath = path.join(__dirname, '..', normalizedPath);

	try {
		const assetStats = fs.statSync(absolutePath);
		if (assetStats.isDirectory()) {
			return resolveDirectoryImages(absolutePath, normalizedPath);
		}
		if (assetStats.isFile() && imageExtensions.has(path.extname(normalizedPath).toLowerCase())) {
			return [toPublicPath(normalizedPath)];
		}
	} catch (error) {
		console.error(`Failed to resolve product images for "${product.image}":`, error);
	}

	return [];
};

const hydrateProduct = (product) => {
	const images = resolveProductImages(product);
	const description =
		product.description ||
		`${product.desk || ''} Տեղադրման կամ փոխարինման ժամանակ մասնագետը ստուգում է համապատասխանությունը ձեր կաթսայի մոդելին, համակարգի ճնշումը և աշխատանքի կայունությունը։ Մանրամասների, առկայության և վերջնական արժեքի համար կարող եք կապ հաստատել հեռախոսով։`;

	return {
		...product,
		url: `/parts/${encodeURIComponent(product.id)}`,
		description,
		images,
		image: images[0] || product.image || '/images/products/placeholder.jpg'
	};
};

const getProducts = async () => {
	if (supabase) {
		try {
			const { data, error } = await supabase
				.from('products')
				.select('*')
				.order('id', { ascending: true });

			if (!error && data && data.length > 0) {
				return data.map(hydrateProduct);
			}
		} catch (err) {
			console.warn('Supabase fetch products error, falling back to JSON:', err.message);
		}
	}

	// Fallback to products.json
	try {
		const raw = fs.readFileSync(productsPath, 'utf8');
		return JSON.parse(raw).map(hydrateProduct);
	} catch (error) {
		console.error('Failed to read products.json:', error);
		return [];
	}
};

const getProductById = async (id) => {
	const products = await getProducts();
	return products.find((item) => String(item.id) === String(id));
};

const getServiceRequests = async () => {
	if (supabaseAdmin) {
		try {
			const { data, error } = await supabaseAdmin
				.from('service_requests')
				.select('*')
				.order('created_at', { ascending: false });
			if (!error) return data || [];
		} catch (err) {
			console.warn('Supabase fetch service requests error:', err.message);
		}
	}
	return [];
};

const createServiceRequest = async (requestData) => {
	if (supabase) {
		const { data, error } = await supabase
			.from('service_requests')
			.insert([
				{
					first_name: requestData.firstName,
					last_name: requestData.lastName,
					phone: requestData.phone,
					problem_description: requestData.problemDescription,
					product_id: requestData.productId ? Number(requestData.productId) : null,
					product_name: requestData.productName || null,
					status: 'new'
				}
			])
			.select();
		if (error) throw error;
		return data[0];
	} else {
		// Mock local store if Supabase not connected yet
		return {
			id: 'mock-' + Date.now(),
			...requestData,
			status: 'new',
			created_at: new Date().toISOString()
		};
	}
};

module.exports = {
	supabase,
	supabaseAdmin,
	getProducts,
	getProductById,
	getServiceRequests,
	createServiceRequest,
	hydrateProduct
};
