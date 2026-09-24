const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const distDir = path.join(__dirname, 'dist');
const dataDir = path.join(__dirname, 'data');
const viewsDir = path.join(__dirname, 'views');
const imagesDir = path.join(__dirname, 'images');
const productsImageRoot = path.join(imagesDir, 'products');
const productsPath = path.join(dataDir, 'products.json');
const configPath = path.join(dataDir, 'config.json');

const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

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

const { getProducts } = require('./lib/supabase');

const loadProducts = async () => {
	return await getProducts();
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

function copyFolderSync(from, to) {
	if (!fs.existsSync(from)) return;
	fs.mkdirSync(to, { recursive: true });
	const entries = fs.readdirSync(from, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === '.DS_Store') continue;
		const srcPath = path.join(from, entry.name);
		const destPath = path.join(to, entry.name);
		if (entry.isDirectory()) {
			copyFolderSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function copyFileSync(from, to) {
	if (fs.existsSync(from)) {
		fs.mkdirSync(path.dirname(to), { recursive: true });
		fs.copyFileSync(from, to);
	}
}

async function build() {
	console.log('Starting Cloudflare Pages static build...');

	// Ensure clean dist directory
	if (fs.existsSync(distDir)) {
		fs.rmSync(distDir, { recursive: true, force: true });
	}
	fs.mkdirSync(distDir, { recursive: true });

	const config = loadConfig();
	const products = await loadProducts();
	const topProducts = products.filter((product) => product.top);

	// 1. Render index page
	console.log('Rendering index page...');
	const indexHtml = await ejs.renderFile(path.join(viewsDir, 'index.ejs'), {
		topProducts,
		config,
		activePath: '/'
	});
	fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf8');

	// 2. Render products page
	console.log('Rendering products page...');
	const productsHtml = await ejs.renderFile(path.join(viewsDir, 'products.ejs'), {
		products,
		config,
		activePath: '/products'
	});
	fs.mkdirSync(path.join(distDir, 'products'), { recursive: true });
	fs.writeFileSync(path.join(distDir, 'products', 'index.html'), productsHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'products.html'), productsHtml, 'utf8');

	// 3. Render individual product detail pages
	console.log(`Rendering ${products.length} product detail pages...`);
	for (const product of products) {
		const productHtml = await ejs.renderFile(path.join(viewsDir, 'product-detail.ejs'), {
			product,
			config,
			activePath: '/products'
		});
		const productDir = path.join(distDir, 'parts', String(product.id));
		fs.mkdirSync(productDir, { recursive: true });
		fs.writeFileSync(path.join(productDir, 'index.html'), productHtml, 'utf8');
	}

	// 3.5 Render Admin Web Pages
	console.log('Rendering Admin Web pages...');
	const adminWebIndexHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'web', 'index.ejs'), {});
	const adminWebLoginHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'web', 'login.ejs'), {});
	
	fs.mkdirSync(path.join(distDir, 'admin'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'web'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'web', 'login'), { recursive: true });
	fs.writeFileSync(path.join(distDir, 'admin', 'index.html'), adminWebIndexHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'web', 'index.html'), adminWebIndexHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'web', 'login', 'index.html'), adminWebLoginHtml, 'utf8');


	// 4. Copy static assets
	console.log('Copying static assets...');
	copyFileSync(path.join(__dirname, 'styles.css'), path.join(distDir, 'styles.css'));
	copyFileSync(path.join(__dirname, 'site.js'), path.join(distDir, 'site.js'));
	copyFileSync(path.join(__dirname, 'product-carousel.js'), path.join(distDir, 'product-carousel.js'));
	copyFileSync(path.join(__dirname, 'supabase-config.js'), path.join(distDir, 'supabase-config.js'));

	// Copy images
	copyFolderSync(imagesDir, path.join(distDir, 'images'));

	// Copy product images to /parts to match Express routing: /parts/:id/filename
	if (fs.existsSync(productsImageRoot)) {
		copyFolderSync(productsImageRoot, path.join(distDir, 'parts'));
	}

	// 5. Output API endpoints for client fetching
	fs.mkdirSync(path.join(distDir, 'api'), { recursive: true });
	fs.writeFileSync(path.join(distDir, 'api', 'products.json'), JSON.stringify(products, null, 2), 'utf8');
	fs.mkdirSync(path.join(distDir, 'api', 'products'), { recursive: true });
	fs.writeFileSync(path.join(distDir, 'api', 'products', 'index.json'), JSON.stringify(products, null, 2), 'utf8');

	// 6. Create Cloudflare _headers file for caching & security
	const headersContent = `/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/images/*
  Cache-Control: public, max-age=31536000, immutable

/parts/*/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/parts/*/*.png
  Cache-Control: public, max-age=31536000, immutable

/parts/*/*.webp
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=86400

/*.js
  Cache-Control: public, max-age=86400
`;
	fs.writeFileSync(path.join(distDir, '_headers'), headersContent, 'utf8');

	console.log('Build completed successfully in ./dist');
}

build().catch((err) => {
	console.error('Build failed:', err);
	process.exit(1);
});
