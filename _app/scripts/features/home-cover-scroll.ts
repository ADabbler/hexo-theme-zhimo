import { isReducedMotion } from './theme-mode';

const HOME_LATEST_HASH = '#home-latest';
const HOME_COVER_COMPACT_QUERY = '(max-width: 760px)';

/** Smooth-scroll from the home cover CTA to #home-latest, per the 760px layout. */
export const homeCoverScroll = {
  init(): void {
    const trigger = document.querySelector<HTMLAnchorElement>(`.cover-scroll[href="${HOME_LATEST_HASH}"]`);
    const target = document.querySelector(HOME_LATEST_HASH);
    if (!trigger || !target) return;

    const clearLatestHash = () => {
      if (window.location.hash !== HOME_LATEST_HASH) return;
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
    };

    // Landing directly on #home-latest on a compact viewport would pin the
    // scroll target under the fixed header; reset to the top instead.
    if (window.location.hash === HOME_LATEST_HASH && window.matchMedia(HOME_COVER_COMPACT_QUERY).matches) {
      clearLatestHash();
      const resetScroll = () => window.scrollTo({ top: 0, behavior: 'auto' });
      resetScroll();
      requestAnimationFrame(resetScroll);
      window.addEventListener('load', resetScroll, { once: true });
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      target.scrollIntoView({
        behavior: isReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
      clearLatestHash();
    });
  },
};
