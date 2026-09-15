import { isReducedMotion } from './theme-mode';
import { i18n, translate } from '../lib/i18n';

const BACK_TO_TOP_THRESHOLD = 300;

export const backToTop = {
  init(): void {
    const label = translate(i18n.backToTop, 'Back to top');
    const button = document.createElement('button');
    button.className = 'back-to-top';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-arrow-up"></use></svg>';
    document.body.appendChild(button);

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          button.classList.toggle('visible', window.scrollY > BACK_TO_TOP_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: isReducedMotion() ? 'auto' : 'smooth' });
    });
  },
};
