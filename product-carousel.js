(function () {
	const escapeHtml = (value) =>
		String(value).replace(/[&<>"']/g, (character) => {
			const entities = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			};

			return entities[character] || character;
		});

	const getProductImages = (product) =>
		Array.isArray(product.images) && product.images.length ? product.images : product.image ? [product.image] : [];

	const buildCarouselMarkup = (product) => {
		const images = getProductImages(product);

		if (!images.length) {
			return `
				<div class="product-carousel product-carousel--empty">
					<span class="product-carousel__empty">Նկար դեռ ավելացված չէ</span>
				</div>
			`;
		}

		const slides = images
			.map(
				(image, index) => `
					<img
						class="product-carousel__slide${index === 0 ? ' is-active' : ''}"
						data-carousel-slide
						src="${escapeHtml(image)}"
						alt="${escapeHtml(product.name)} ${index + 1}"
						loading="lazy"
						decoding="async"
					/>
				`
			)
			.join('');

		const dots =
			images.length > 1
				? `
					<div class="product-carousel__dots">
						${images
							.map(
								(_, index) => `
									<button
										class="product-carousel__dot${index === 0 ? ' is-active' : ''}"
										data-carousel-dot
										type="button"
										aria-label="${escapeHtml(product.name)} ${index + 1}"
									></button>
								`
							)
							.join('')}
					</div>
				`
				: '';

		return `
			<div class="product-carousel" data-product-carousel aria-label="${escapeHtml(product.name)}">
				<div class="product-carousel__viewport">
					${slides}
				</div>
				${dots}
			</div>
		`;
	};

	const renderProductCard = (product, animationClass = 'delay-1') => `
		<article class="service-card reveal ${animationClass} p-5">
			${buildCarouselMarkup(product)}
			<h3 class="mt-4 text-lg font-semibold text-blue-900">${escapeHtml(product.name)}</h3>
			<p class="mt-2 text-sm leading-relaxed text-slate-700">${escapeHtml(product.desk || '')}</p>
			${product.price ? `<p class="mt-4 text-base font-semibold text-slate-900">${escapeHtml(product.price.includes('դրամ') ? product.price : product.price + ' դրամ')}</p>` : ''}
		</article>
	`;

	const startCarousel = (carousel) => {
		const slides = Array.from(carousel.querySelectorAll('[data-carousel-slide]'));
		const dots = Array.from(carousel.querySelectorAll('[data-carousel-dot]'));

		if (carousel.dataset.carouselReady === 'true' || slides.length <= 1) {
			return;
		}

		let activeIndex = 0;
		let rotationId = null;

		const setActiveSlide = (nextIndex) => {
			activeIndex = nextIndex;

			slides.forEach((slide, slideIndex) => {
				slide.classList.toggle('is-active', slideIndex === activeIndex);
			});

			dots.forEach((dot, dotIndex) => {
				dot.classList.toggle('is-active', dotIndex === activeIndex);
			});
		};

		const stopRotation = () => {
			if (rotationId) {
				window.clearInterval(rotationId);
				rotationId = null;
			}
		};

		const startRotation = () => {
			stopRotation();
			rotationId = window.setInterval(() => {
				setActiveSlide((activeIndex + 1) % slides.length);
			}, 3200);
		};

		dots.forEach((dot, dotIndex) => {
			dot.addEventListener('click', () => {
				setActiveSlide(dotIndex);
				startRotation();
			});
		});

		carousel.addEventListener('mouseenter', stopRotation);
		carousel.addEventListener('mouseleave', startRotation);
		carousel.addEventListener('focusin', stopRotation);
		carousel.addEventListener('focusout', (event) => {
			if (!carousel.contains(event.relatedTarget)) {
				startRotation();
			}
		});

		carousel.dataset.carouselReady = 'true';
		startRotation();
	};

	const initProductCarousels = (scope = document) => {
		scope.querySelectorAll('[data-product-carousel]').forEach(startCarousel);
	};

	const renderProducts = (container, products) => {
		if (!container) {
			return;
		}

		container.innerHTML = products
			.map((product, index) => renderProductCard(product, `delay-${(index % 3) + 1}`))
			.join('');

		initProductCarousels(container);
	};

	window.initProductCarousels = initProductCarousels;
	window.renderProducts = renderProducts;
	window.renderProductCard = renderProductCard;
})();
