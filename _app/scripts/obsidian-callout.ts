import { setExpanded } from './lib/dom';

const CONTENT_ID_PREFIX = 'zhimo-callout-content';

function ensureContentId(content: HTMLElement, index: number): string {
  if (content.id) return content.id;

  content.id = `${CONTENT_ID_PREFIX}-${index + 1}`;
  return content.id;
}

function initCallout(callout: HTMLDetailsElement, index: number): void {
  const summary = callout.querySelector<HTMLElement>('.hexo-callout__summary');
  if (!summary) return;

  const content = callout.querySelector<HTMLElement>('.hexo-callout__content');
  if (content) {
    summary.setAttribute('aria-controls', ensureContentId(content, index));
  }

  const syncState = () => setExpanded(summary, callout.open);
  syncState();
  callout.addEventListener('toggle', syncState);
}

const callouts = document.querySelectorAll<HTMLDetailsElement>('details.hexo-callout');
callouts.forEach(initCallout);
