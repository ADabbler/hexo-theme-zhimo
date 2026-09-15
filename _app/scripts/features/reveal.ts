import { isReducedMotion } from './theme-mode';

const REVEAL_INITIAL_CHECK_DELAY = 80;

function isInViewport(item: Element): boolean {
  const rect = item.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function revealVisibleItems(items: Element[]): void {
  items.forEach((item) => {
    if (item.classList.contains('is-visible') || !isInViewport(item)) return;
    item.classList.add('is-visible');
  });
}

/** Progressive one-shot reveal of `.reveal-item` elements entering the viewport. */
export const reveal = {
  init(): void {
    const items = Array.from(document.querySelectorAll('.reveal-item'));
    if (!items.length) return;

    if (isReducedMotion()) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    });

    items.forEach((item) => observer.observe(item));

    const revealInitialViewport = () => revealVisibleItems(items);

    requestAnimationFrame(revealInitialViewport);
    window.setTimeout(revealInitialViewport, REVEAL_INITIAL_CHECK_DELAY);

    window.addEventListener('load', () => {
      window.setTimeout(revealInitialViewport, 0);
    }, { once: true });
  },
};
