(function () {
	const initNav = () => {
		const navToggle = document.querySelector('.nav-toggle');
		const navShell = document.querySelector('.nav-shell');
		const navMenu = document.querySelector('#primary-menu');
		const navContact = document.querySelector('.nav-contact');

		navToggle?.addEventListener('click', () => {
			const isOpen = navShell.classList.toggle('is-open');
			navToggle.setAttribute('aria-expanded', String(isOpen));
			navMenu?.classList.toggle('hidden', !isOpen);
			navMenu?.classList.toggle('flex', isOpen);
			navContact?.classList.toggle('hidden', !isOpen);
			navContact?.classList.toggle('flex', isOpen);
		});
	};

	const initCallModal = () => {
		const modal = document.querySelector('[data-call-modal]');
		const panel = modal?.querySelector('.call-modal__panel');
		const openButtons = document.querySelectorAll('[data-call-modal-open]');
		const closeButtons = modal?.querySelectorAll('[data-call-modal-close]') || [];
		let lastFocusedElement = null;

		if (!modal || !panel || !openButtons.length) {
			return;
		}

		const closeModal = () => {
			modal.classList.remove('is-open');
			modal.setAttribute('aria-hidden', 'true');
			document.body.classList.remove('has-open-modal');
			lastFocusedElement?.focus();
		};

		const openModal = () => {
			lastFocusedElement = document.activeElement;
			modal.classList.add('is-open');
			modal.setAttribute('aria-hidden', 'false');
			document.body.classList.add('has-open-modal');
			panel.focus();
		};

		openButtons.forEach((button) => button.addEventListener('click', openModal));
		closeButtons.forEach((button) => button.addEventListener('click', closeModal));

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && modal.classList.contains('is-open')) {
				closeModal();
			}
		});
	};

	const initDoubleClickGuard = () => {
		document.addEventListener('click', (event) => {
			const btn = event.target.closest('button, .btn, [type="submit"], a.btn');
			if (!btn) return;
			if (btn.dataset.isClicking === 'true') {
				event.preventDefault();
				event.stopPropagation();
				return false;
			}
			btn.dataset.isClicking = 'true';
			setTimeout(() => {
				delete btn.dataset.isClicking;
			}, 700);
		}, true);
	};

	document.addEventListener('DOMContentLoaded', () => {
		initNav();
		initCallModal();
		initDoubleClickGuard();
		window.initProductCarousels?.();
	});
})();
