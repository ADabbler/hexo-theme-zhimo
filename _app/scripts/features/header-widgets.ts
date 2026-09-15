import { setExpanded } from '../lib/dom';

export const nav = {
  init(): void {
    const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
    const menu = document.querySelector<HTMLElement>('.site-nav');

    if (!toggle || !menu) return;

    const openLabel = toggle.dataset.labelOpen || toggle.getAttribute('aria-label') || '';
    const closeLabel = toggle.dataset.labelClose || openLabel;

    const setNavOpen = (isOpen: boolean) => {
      setExpanded(toggle, isOpen);
      toggle.setAttribute('aria-label', isOpen ? closeLabel : openLabel);
      menu.classList.toggle('active', isOpen);
    };

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      setNavOpen(!isExpanded);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('active')) {
        setNavOpen(false);
      }
    });
  },
};

export const langMenu = {
  init(): void {
    const trigger = document.querySelector<HTMLButtonElement>('.lang-trigger');
    const menu = document.querySelector<HTMLElement>('.lang-menu');

    if (!trigger || !menu) return;

    const closeMenu = () => {
      menu.classList.remove('active');
      setExpanded(trigger, false);
    };

    trigger.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('active');
      setExpanded(trigger, isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Element) || !e.target.closest('.lang-switch')) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  },
};
