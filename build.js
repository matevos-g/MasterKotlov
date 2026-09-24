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

	productsTitle: "Ապրանքներ",
	productsSubtitle: "Ընտրված պահեստամասեր և սարքավորումներ, որոնք հաճախ օգտագործվում են սպասարկման ընթացքում։",

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

	partsTitle: "Պահեստամասեր",
	partsSubtitle: "Օրիգինալ և որակյալ պահեստամասեր աշխարհի առաջատար արտադրողներից",

	footerDesc: "Գազային և էլեկտրական կաթսաների պրոֆեսիոնալ վերանորոգում և սպասարկում Երևանում և հարակից շրջաններում։",
	footerContactsTitle: "Կոնտակտներ",
	footerServicesTitle: "Ծառայություններ",
	footerServicesDesc: "Ախտորոշում, վերանորոգում, սպասարկում և գործարկման կարգավորում։",
	copyrightText: "© MasterKotlov: Բոլոր իրավունքները պաշտպանված են:",

	modalTitle: "Թողնել Սպասարկման Հայտ",
	modalSubtitle: "Լրացրեք տվյալները, և մեր մասնագետը կկապնվի Ձեզ հետ կարճ ժամանակում։",
	modalSubmitBtnText: "Ուղարկել Հայտը"
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

	// 3.5 Render Admin Web, Mobile & Router Pages
	console.log('Rendering Admin Web & Mobile pages...');
	const adminRouterHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'router.ejs'), {});
	const adminWebIndexHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'web', 'index.ejs'), {});
	const adminWebLoginHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'web', 'login.ejs'), {});
	const adminProductEditHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'web', 'product-edit.ejs'), {});

	const adminMobileIndexHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'mobile', 'index.ejs'), {});
	const adminMobileLoginHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'mobile', 'login.ejs'), {});
	const adminMobileProductEditHtml = await ejs.renderFile(path.join(viewsDir, 'admin', 'mobile', 'product-edit.ejs'), {});
	
	fs.mkdirSync(path.join(distDir, 'admin'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'web'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'web', 'login'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'web', 'products', 'new'), { recursive: true });
	
	fs.mkdirSync(path.join(distDir, 'admin', 'mobile'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'mobile', 'login'), { recursive: true });
	fs.mkdirSync(path.join(distDir, 'admin', 'mobile', 'products', 'new'), { recursive: true });

	fs.writeFileSync(path.join(distDir, 'admin', 'index.html'), adminRouterHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'web', 'index.html'), adminWebIndexHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'web', 'login', 'index.html'), adminWebLoginHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'web', 'products', 'new', 'index.html'), adminProductEditHtml, 'utf8');

	fs.writeFileSync(path.join(distDir, 'admin', 'mobile', 'index.html'), adminMobileIndexHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'mobile', 'login', 'index.html'), adminMobileLoginHtml, 'utf8');
	fs.writeFileSync(path.join(distDir, 'admin', 'mobile', 'products', 'new', 'index.html'), adminMobileProductEditHtml, 'utf8');

	// Render product edit page for each product ID (Web & Mobile)
	for (const product of products) {
		const prodEditDir = path.join(distDir, 'admin', 'web', 'products', String(product.id));
		fs.mkdirSync(prodEditDir, { recursive: true });
		fs.writeFileSync(path.join(prodEditDir, 'index.html'), adminProductEditHtml, 'utf8');

		const mobileProdEditDir = path.join(distDir, 'admin', 'mobile', 'products', String(product.id));
		fs.mkdirSync(mobileProdEditDir, { recursive: true });
		fs.writeFileSync(path.join(mobileProdEditDir, 'index.html'), adminMobileProductEditHtml, 'utf8');
	}



	// 4. Copy static assets
	console.log('Copying static assets...');
	copyFileSync(path.join(__dirname, 'styles.css'), path.join(distDir, 'styles.css'));
	copyFileSync(path.join(__dirname, 'site.js'), path.join(distDir, 'site.js'));
	copyFileSync(path.join(__dirname, 'product-carousel.js'), path.join(distDir, 'product-carousel.js'));
	copyFileSync(path.join(__dirname, 'supabase-config.js'), path.join(distDir, 'supabase-config.js'));
	copyFileSync(path.join(__dirname, 'manifest.json'), path.join(distDir, 'manifest.json'));
	copyFileSync(path.join(__dirname, 'sw.js'), path.join(distDir, 'sw.js'));

	// Copy images
	copyFolderSync(imagesDir, path.join(distDir, 'images'));

	// Copy product images to /parts to match Express routing: /parts/:id/filename
	if (fs.existsSync(productsImageRoot)) {
		copyFolderSync(productsImageRoot, path.join(distDir, 'parts'));
	}

	// 5. Output API endpoints for client fetching
	fs.mkdirSync(path.join(distDir, 'api'), { recursive: true });
	fs.writeFileSync(path.join(distDir, 'api', 'products.json'), JSON.stringify(products, null, 2), 'utf8');
	fs.writeFileSync(path.join(distDir, 'api', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
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
