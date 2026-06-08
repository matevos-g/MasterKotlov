const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;
const productsPath = path.join(__dirname, 'data', 'products.json');
const configPath = path.join(__dirname, 'data', 'config.json');
const productsImageRoot = path.join(__dirname, 'images', 'products');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const normalizeAssetPath = (assetPath = '') =>
	assetPath.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '').replace(/\/+$/, '');

const toPublicPath = (assetPath) =>
	`/${normalizeAssetPath(assetPath)
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/')}`;

const resolveDirectoryImages = (absolutePath, publicPath) =>
	fs
		.readdirSync(absolutePath)
		.filter((fileName) => imageExtensions.has(path.extname(fileName).toLowerCase()))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
		.map((fileName) => toPublicPath(`${publicPath}/${fileName}`));

const resolveProductImages = (product) => {
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
	const absolutePath = path.join(__dirname, normalizedPath);

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
		`${product.desk} Տեղադրման կամ փոխարինման ժամանակ մասնագետը ստուգում է համապատասխանությունը ձեր կաթսայի մոդելին, համակարգի ճնշումը և աշխատանքի կայունությունը։ Մանրամասների, առկայության և վերջնական արժեքի համար կարող եք կապ հաստատել հեռախոսով։`;

	return {
		...product,
		url: `/parts/${encodeURIComponent(product.id)}`,
		description,
		images,
		image: images[0] || product.image
	};
};

const loadProducts = () => {
	try {
		const raw = fs.readFileSync(productsPath, 'utf8');
		return JSON.parse(raw).map(hydrateProduct);
	} catch (error) {
		console.error('Failed to read products.json:', error);
		return [];
	}
};

const loadConfig = () => {
	try {
		const raw = fs.readFileSync(configPath, 'utf8');
		return JSON.parse(raw);
	} catch (error) {
		console.error('Failed to read config.json:', error);
		return { phone: '' };
	}
};

app.get('/', (req, res) => {
	const products = loadProducts();
	const topProducts = products.filter((product) => product.top);
	res.render('index', { topProducts, config: loadConfig(), activePath: '/' });
});

app.get('/products', (req, res) => {
	const products = loadProducts();
	res.render('products', { products, config: loadConfig(), activePath: '/products' });
});

app.get('/parts/:id', (req, res) => {
	const products = loadProducts();
	const product = products.find((item) => String(item.id) === String(req.params.id));

	if (!product) {
		res.status(404).send('Product not found');
		return;
	}

	res.render('product-detail', { product, config: loadConfig(), activePath: '/products' });
});

app.get('/api/products', (req, res) => {
	res.json(loadProducts());
});

app.use('/parts', express.static(productsImageRoot, { index: false, redirect: false }));
app.use(express.static(__dirname));

app.listen(port, '0.0.0.0', () => {
	console.log(`Server running on http://macbook.local:${port}`);
});
