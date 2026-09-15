import { ensureSvgSymbol } from './lib/svg-sprite';

/** Search index item shape (hexo-generator-searchdb JSON). */
interface SearchItem {
  title: string;
  url: string;
  content?: string;
  lang?: string;
  tags?: string[];
}

/** Injected via `window.ZhiMoSearch` (layout/_partial/scripts.ejs). */
interface SearchConfig {
  path: string;
  currentLang: string;
  defaultLang: string;
  languages: string[];
  languageRoots: Record<string, string>;
  placeholder: string;
  noResults: string;
  fallbackHint: string;
  resultsCount: string;
  showAll: string;
  showLess: string;
  loadError: string;
  closeLabel: string;
}

const RESULT_LIMIT = 10;
const DEFAULT_EXCERPT_LENGTH = 150;
const EXCERPT_CONTEXT_BEFORE = 50;
const EXCERPT_CONTEXT_AFTER = 100;
const ELLIPSIS = '...';
const DEFAULT_CONFIG: SearchConfig = {
  path: '/search.json',
  currentLang: '',
  defaultLang: '',
  languages: [],
  languageRoots: {},
  placeholder: 'Search...',
  noResults: 'No results found',
  fallbackHint: '',
  resultsCount: 'Found {count} articles',
  showAll: 'Show all results',
  showLess: 'Show fewer results',
  loadError: 'Failed to load search data',
  closeLabel: 'Close search',
};

function getSearchConfig(): SearchConfig {
  return { ...DEFAULT_CONFIG, ...(window as unknown as { ZhiMoSearch?: Partial<SearchConfig> }).ZhiMoSearch };
}

class SearchModal {
  private overlay!: HTMLElement;
  private input!: HTMLInputElement;
  private results!: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private currentMatches: Array<{ item: SearchItem; score: number }> = [];
  private currentKeywords: string[] = [];
  private expanded = false;
  private searchData: SearchItem[] | null = null;
  private loadPromise: Promise<SearchItem[] | null> | null = null;

  open(): void {
    if (!this.overlay?.isConnected) this.create();
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.input.focus();
  }

  close(): void {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.input.value = '';
    this.clearResults();
    this.previousFocus?.focus();
  }

  private create(): void {
    const config = getSearchConfig();
    this.overlay = document.createElement('div');
    this.overlay.className = 'search-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', config.placeholder);
    this.overlay.innerHTML = `
      <div class="search-modal">
        <div class="search-header">
          <input type="search" class="search-input" placeholder="${this.escapeAttr(config.placeholder)}" autocomplete="off">
          <button type="button" class="search-close" aria-label="${this.escapeAttr(config.closeLabel)}">
            <svg class="icon" aria-hidden="true"><use href="#icon-close"></use></svg>
          </button>
        </div>
        <div class="search-results"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.input = this.overlay.querySelector('.search-input')!;
    this.results = this.overlay.querySelector('.search-results')!;

    ensureCloseIcon();

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.overlay.querySelector('.search-close')!.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });

    this.overlay.addEventListener('keydown', (e) => this.trapFocus(e));

    this.input.addEventListener('input', () => {
      void this.search(this.input.value.trim());
    });

    this.results.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest('[data-search-toggle]')) return;

      this.expanded = !this.expanded;
      this.renderResults(this.currentMatches, this.currentKeywords);
    });
  }

  private clearResults(): void {
    this.results.innerHTML = '';
    this.resetState();
  }

  private resetState(): void {
    this.currentMatches = [];
    this.currentKeywords = [];
    this.expanded = false;
  }

  private async search(query: string): Promise<void> {
    if (!query) {
      this.clearResults();
      return;
    }

    const config = getSearchConfig();
    const data = await this.loadData();
    const items = data ? this.itemsForCurrentLanguage(data, config) : null;
    if (!items) return;

    const keywords = this.keywordsFor(query);
    const matches = items
      .map((item) => ({ item, score: this.scoreItem(item, keywords) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      this.resetState();
      this.renderMessage('search-no-results', config.noResults, config.fallbackHint);
      return;
    }

    this.currentMatches = matches;
    this.currentKeywords = keywords;
    this.expanded = false;
    this.renderResults(matches, keywords);
  }

  private loadData(): Promise<SearchItem[] | null> {
    if (this.searchData) return Promise.resolve(this.searchData);
    this.loadPromise ??= this.fetchSearchData();
    return this.loadPromise;
  }

  private async fetchSearchData(): Promise<SearchItem[] | null> {
    const config = getSearchConfig();
    try {
      const response = await fetch(config.path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.searchData = await response.json() as SearchItem[];
      return this.searchData;
    } catch (err) {
      console.error('Search data load failed:', err);
      this.loadPromise = null;
      this.renderMessage('search-error', config.loadError);
      return null;
    }
  }

  private itemsForCurrentLanguage(items: SearchItem[], config: SearchConfig): SearchItem[] {
    const context = this.languageContext(config);
    if (!context.currentLang) return items;

    return items.filter((item) => {
      const itemLang = normalizeLanguage(this.languageForItem(item, context));
      return itemLang === context.currentLang;
    });
  }

  private languageContext(config: SearchConfig): LanguageContext {
    const languages = config.languages || [];
    const defaultLang = config.defaultLang || languages[0] || '';
    const defaultLangKey = normalizeLanguage(defaultLang);
    const nonDefaultRoots = Object.entries(config.languageRoots || {})
      .filter(([lang]) => normalizeLanguage(lang) !== defaultLangKey)
      .map(([lang, root]) => ({ lang, path: normalizeUrlPath(root) }))
      .sort((a, b) => b.path.length - a.path.length);

    return {
      currentLang: normalizeLanguage(config.currentLang),
      defaultLang,
      languages,
      nonDefaultRoots,
    };
  }

  private languageForItem(
    item: SearchItem,
    context: LanguageContext,
  ): string {
    if (item.lang) return item.lang;

    const path = normalizeUrlPath(item.url);
    const rootMatch = context.nonDefaultRoots.find((root) => path.startsWith(root.path));

    if (rootMatch) return rootMatch.lang;
    return languageFromFirstPathSegment(path, context.languages) || context.defaultLang;
  }

  private keywordsFor(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter((keyword) => keyword.length > 0);
  }

  private scoreItem(item: SearchItem, keywords: string[]): number {
    const title = item.title.toLowerCase();
    const content = item.content ? item.content.toLowerCase() : '';
    const tags = item.tags ? item.tags.join(' ').toLowerCase() : '';

    let score = 0;
    keywords.forEach((keyword) => {
      if (title.includes(keyword)) score += 10;
      if (content.includes(keyword)) score += 1;
      if (tags.includes(keyword)) score += 5;
    });

    return score;
  }

  private renderMessage(className: string, message: string, detail?: string): void {
    const detailHtml = detail ? `<span>${this.escapeHtml(detail)}</span>` : '';
    this.results.innerHTML = `<p class="${className}">${this.escapeHtml(message)}${detailHtml}</p>`;
  }

  private renderResults(
    matches: Array<{ item: SearchItem; score: number }>,
    keywords: string[],
  ): void {
    const config = getSearchConfig();
    const hasHiddenResults = matches.length > RESULT_LIMIT;
    const visibleMatches = this.expanded ? matches : matches.slice(0, RESULT_LIMIT);
    const resultItems = visibleMatches.map(({ item }) => `
      <a href="${this.escapeAttr(item.url || '#')}" class="search-result-item">
        <h3 class="result-title">${this.highlight(item.title || '', keywords)}</h3>
        ${item.content ? `<p class="result-excerpt">${this.highlight(this.excerpt(item.content, keywords), keywords)}</p>` : ''}
      </a>
    `).join('');
    const footer = hasHiddenResults ? `
      <div class="search-results-footer">
        <span>${this.escapeHtml(this.formatCount(config.resultsCount, matches.length))}</span>
        <button
          type="button"
          class="search-more-button"
          data-search-toggle
          aria-expanded="${this.expanded ? 'true' : 'false'}">
          ${this.escapeHtml(this.expanded ? config.showLess : config.showAll)}
        </button>
      </div>
    ` : '';

    this.results.innerHTML = `${resultItems}${footer}`;
  }

  private highlight(text: string, keywords: string[]): string {
    const escaped = this.escapeHtml(text);
    if (!keywords.length) return escaped;

    const pattern = keywords.map((keyword) => escapeRegExp(keyword)).join('|');
    return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
  }

  private excerpt(content: string, keywords: string[]): string {
    const lowerContent = content.toLowerCase();
    let index = -1;
    keywords.some((keyword) => {
      index = lowerContent.indexOf(keyword);
      return index !== -1;
    });

    if (index === -1) {
      return content.substring(0, DEFAULT_EXCERPT_LENGTH) + ELLIPSIS;
    }

    const start = Math.max(0, index - EXCERPT_CONTEXT_BEFORE);
    const end = Math.min(content.length, index + EXCERPT_CONTEXT_AFTER);
    const prefix = start > 0 ? ELLIPSIS : '';
    const suffix = end < content.length ? ELLIPSIS : '';
    return `${prefix}${content.substring(start, end)}${suffix}`;
  }

  private trapFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !this.overlay.classList.contains('active')) return;

    const focusable = this.overlay.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])');
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private formatCount(template: string, count: number): string {
    return String(template || '').replace('{count}', String(count));
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  }
}

/** Language filter inputs derived from the search config on every query. */
interface LanguageContext {
  currentLang: string;
  defaultLang: string;
  languages: string[];
  nonDefaultRoots: Array<{ lang: string; path: string }>;
}

function normalizeLanguage(value: string | undefined): string {
  return String(value || '').toLowerCase();
}

function normalizeUrlPath(value: string): string {
  const path = pathForUrl(value);
  if (!path) return '/';

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function pathForUrl(value: string): string {
  const url = String(value || '');
  if (!url) return '';

  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function languageFromFirstPathSegment(path: string, languages: string[]): string {
  const segment = String(path || '').replace(/^\/+/, '').split('/')[0];
  return languages.find((lang) => normalizeLanguage(lang) === normalizeLanguage(segment)) || '';
}

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureCloseIcon(): void {
  ensureSvgSymbol(
    'icon-close',
    '0 0 24 24',
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6 6 18M6 6l12 12"/>',
  );
}

const searchModal = new SearchModal();

function init(): void {
  const triggers = document.querySelectorAll('.search-trigger, [data-search-trigger]');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => searchModal.open());
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchModal.open();
    }
  });
}

init();
