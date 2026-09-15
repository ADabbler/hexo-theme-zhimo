import { SafeStorage } from '../lib/storage';

const THEME_KEY = 'zhimo-theme';
const THEME_SEQUENCE = ['auto', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_SEQUENCE)[number];
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const LIGHT_THEME_COLOR = '#fefdfb';
const DARK_THEME_COLOR = '#1a1915';

function isThemePreference(value: string): value is ThemePreference {
  return (THEME_SEQUENCE as readonly string[]).includes(value);
}

export const themeMode = {
  getPreferred(): ThemePreference {
    const stored = SafeStorage.get(THEME_KEY);
    return stored && isThemePreference(stored) ? stored : 'auto';
  },

  getEffective(preferred?: ThemePreference): 'light' | 'dark' {
    const pref = preferred ?? this.getPreferred();
    if (pref === 'auto') {
      return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
    }
    return pref;
  },

  set(theme: ThemePreference): void {
    SafeStorage.set(THEME_KEY, theme);
    this.apply();
  },

  apply(): void {
    const preferred = this.getPreferred();
    const effective = this.getEffective(preferred);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', preferred);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        effective === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
      );
    }

    this.updateToggle(preferred);
  },

  updateToggle(preferred: ThemePreference): void {
    const toggleBtn = document.querySelector<HTMLElement>('.theme-toggle');
    if (!toggleBtn) return;

    const labelMap: Record<ThemePreference, string> = {
      auto: toggleBtn.dataset.labelAuto || 'Auto',
      light: toggleBtn.dataset.labelLight || 'Light',
      dark: toggleBtn.dataset.labelDark || 'Dark',
    };
    const prefix = toggleBtn.dataset.labelPrefix || 'Toggle theme';
    const label = labelMap[preferred];
    toggleBtn.setAttribute('aria-label', `${prefix}: ${label}`);
    toggleBtn.setAttribute('title', label);
  },

  toggle(): void {
    const current = this.getPreferred();
    const currentIndex = THEME_SEQUENCE.indexOf(current);
    const next = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
    this.set(next);
  },

  init(): void {
    this.apply();

    const darkQuery = window.matchMedia(DARK_MEDIA_QUERY);
    darkQuery.addEventListener('change', () => {
      if (this.getPreferred() === 'auto') this.apply();
    });

    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
  },
};

export function isReducedMotion(): boolean {
  return document.documentElement.getAttribute('data-motion') === 'reduced';
}
