import { i18n, translate } from './lib/i18n';
import { ensureSvgSymbol } from './lib/svg-sprite';

const RESET_DELAY = 2000;
const HIDDEN_TEXTAREA_TOP = '-9999px';
const SCROLLBAR_HIDE_DELAY = 900;
const LANGUAGE_CLASS_PATTERN = /^lang(uage)?-/;
const COPY_BUTTON_HTML =
  '<svg class="icon icon-copy" aria-hidden="true"><use href="#icon-copy"></use></svg><svg class="icon icon-check" aria-hidden="true"><use href="#icon-check"></use></svg><span class="copy-code-text"></span>';

type CopyState = 'idle' | 'copied' | 'failed';

const STATE_TEXT: Record<CopyState, string> = {
  idle: translate(i18n.copyCode, 'Copy'),
  copied: translate(i18n.copied, 'Copied'),
  failed: translate(i18n.copyFailed, 'Copy failed'),
};

function getCodeBlocks(): Array<HTMLElement> {
  const figures = Array.from(document.querySelectorAll<HTMLElement>('figure.highlight'));
  const standalonePres = Array.from(document.querySelectorAll<HTMLElement>('pre'))
    .filter((block) => !block.closest('figure.highlight'));
  return [...figures, ...standalonePres];
}

function initCopyButtons(): void {
  const blocks = getCodeBlocks();
  if (!blocks.length) return;

  blocks.forEach((block) => {
    if (block.querySelector(':scope > .copy-code-btn')) return;
    if (!block.hasAttribute('tabindex')) block.tabIndex = 0;

    const language = normalizeLanguage(getLanguage(block));
    const gutter = block.querySelector('.gutter');
    if (gutter) gutter.setAttribute('aria-hidden', 'true');

    block.setAttribute('aria-label', language ? `${language} code block` : 'Code block');
    if (language && !block.querySelector(':scope > .code-lang')) {
      const label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = `[ ${language} ]`;
      block.appendChild(label);
    }

    const button = document.createElement('button');
    button.className = 'copy-code-btn';
    button.type = 'button';
    button.setAttribute('aria-live', 'polite');
    button.innerHTML = COPY_BUTTON_HTML;
    setButtonState(button, 'idle', language);

    let resetTimer = 0;
    button.addEventListener('click', async () => {
      const text = getCodeText(block);
      if (!text) return;

      window.clearTimeout(resetTimer);

      try {
        await copyText(text);
        setButtonState(button, 'copied', language);
      } catch (err) {
        console.error('Copy failed:', err);
        setButtonState(button, 'failed', language);
      }

      resetTimer = window.setTimeout(() => setButtonState(button, 'idle', language), RESET_DELAY);
    });

    block.appendChild(button);
  });
}

function initCodeScrollbars(): void {
  const scrollers = getCodeScrollers();
  if (!scrollers.length) return;

  const refreshScrollableStates = () => scrollers.forEach(updateScrollableState);
  scrollers.forEach(initCodeScroller);

  window.addEventListener('load', refreshScrollableStates, { once: true });

  const observer = new ResizeObserver(refreshScrollableStates);
  scrollers.forEach((scroller) => observer.observe(scroller));
}

function getCodeScrollers(): Array<HTMLElement> {
  const highlighted = Array.from(document.querySelectorAll<HTMLElement>('figure.highlight .code'));
  const standalone = Array.from(document.querySelectorAll<HTMLElement>('.post-content > pre code'));
  return [...highlighted, ...standalone];
}

function initCodeScroller(scroller: HTMLElement): void {
  if (scroller.dataset.scrollbarReady === 'true') return;
  scroller.dataset.scrollbarReady = 'true';

  let hideScrollbarTimer = 0;
  const hideScrollbarLater = () => {
    window.clearTimeout(hideScrollbarTimer);
    hideScrollbarTimer = window.setTimeout(() => {
      scroller.classList.remove('is-scrolling-x');
    }, SCROLLBAR_HIDE_DELAY);
  };
  const showScrollbar = () => {
    updateScrollableState(scroller);
    if (!scroller.classList.contains('has-scroll-x')) return;

    scroller.classList.add('is-scrolling-x');
    hideScrollbarLater();
  };

  updateScrollableState(scroller);
  scroller.addEventListener('scroll', showScrollbar, { passive: true });
  scroller.addEventListener('wheel', showScrollbar, { passive: true });
  scroller.addEventListener('pointerdown', showScrollbar);
  scroller.addEventListener('touchstart', showScrollbar, { passive: true });
  scroller.addEventListener('keydown', showScrollbar);
  scroller.addEventListener('focus', showScrollbar);
  scroller.addEventListener('mouseenter', showScrollbar);
  scroller.addEventListener('mouseleave', hideScrollbarLater);
}

function updateScrollableState(scroller: HTMLElement): void {
  const hasHorizontalScroll = scroller.scrollWidth > scroller.clientWidth + 1;
  scroller.classList.toggle('has-scroll-x', hasHorizontalScroll);

  if (!hasHorizontalScroll) {
    scroller.classList.remove('is-scrolling-x');
    if (scroller.dataset.scrollbarTabindex === 'true') {
      scroller.removeAttribute('tabindex');
      delete scroller.dataset.scrollbarTabindex;
    }
    return;
  }

  if (!scroller.hasAttribute('tabindex')) {
    scroller.tabIndex = 0;
    scroller.dataset.scrollbarTabindex = 'true';
  }
}

function getLanguage(block: HTMLElement): string {
  if (block.dataset.lang) return block.dataset.lang;
  const classNames = Array.from(block.classList);
  if (classNames.includes('highlight')) {
    return classNames.find((name) => name !== 'highlight') || '';
  }

  return classNames.find((name) => LANGUAGE_CLASS_PATTERN.test(name)) || '';
}

function normalizeLanguage(value: string): string {
  return String(value || '')
    .replace(LANGUAGE_CLASS_PATTERN, '')
    .replace(/^highlight$/, '')
    .trim()
    .toUpperCase();
}

function setButtonState(button: HTMLButtonElement, state: CopyState, language: string): void {
  const text = STATE_TEXT[state];
  const label = language ? `${text}: ${language}` : text;
  button.dataset.state = state;
  const textElement = button.querySelector('.copy-code-text');
  if (textElement) textElement.textContent = text;
  button.setAttribute('aria-label', label);
  button.title = label;
}

function getCodeText(block: HTMLElement): string {
  const lines = block.querySelectorAll('td.code .line');
  if (lines.length) {
    return Array.from(lines).map((line) => line.textContent).join('\n');
  }

  const code = block.querySelector('code');
  if (code) return code.textContent || '';

  const clone = block.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.code-lang, .copy-code-btn').forEach((element) => element.remove());
  return clone.textContent || '';
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = HIDDEN_TEXTAREA_TOP;
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }

  if (!copied) throw new Error('execCommand copy failed');
}

function addCopyIcons(): void {
  ensureSvgSymbol(
    'icon-copy',
    '0 0 24 24',
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></g>',
  );
  ensureSvgSymbol(
    'icon-check',
    '0 0 24 24',
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 6 9 17l-5-5"/>',
  );
}

function init(): void {
  addCopyIcons();
  initCopyButtons();
  initCodeScrollbars();
}

init();
