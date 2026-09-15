import { i18n, translate } from '../lib/i18n';
import { getHeaderHeight, setExpanded, syncCurrentLink } from '../lib/dom';

const TOC_COMPACT_WIDTH = 1280;
const TOC_COMPACT_QUERY = `(max-width: ${TOC_COMPACT_WIDTH}px)`;
const FLOATING_TOC_HEADER_GAP = 24;
const TOC_LEVEL_CLASS_PATTERN = /^toc-level-\d+$/;
const TOC_SCROLL_SYNC_DELAY = 120;
const TOC_BOTTOM_THRESHOLD = 6;
const TOC_ACTIVATION_VIEWPORT_RATIO = 0.22;
const TOC_OBSERVER_ROOT_MARGIN = '-18% 0px -58% 0px';
const TOC_OBSERVER_THRESHOLDS = [0, 0.1, 1];

interface TocHeadingItem {
  id: string;
  link: HTMLAnchorElement;
  heading: Element;
}

interface MobileTocHandle {
  panel: HTMLElement;
  applyVisibility(): void;
}

interface ActiveHeadingOptions {
  expandAllBranches?: boolean;
}

interface ActiveItem {
  id: string;
  link: HTMLAnchorElement;
}

export const tocManager = {
  init(): void {
    const toc = document.querySelector<HTMLElement>('.post-toc[data-toc]');
    if (!toc) return;

    const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const headingItems = this.getHeadingItems(links);

    if (!headingItems.length) return;

    const compactTocQuery = window.matchMedia(TOC_COMPACT_QUERY);
    const isInlineToc = () => compactTocQuery.matches || window.innerWidth <= TOC_COMPACT_WIDTH;
    const getActiveOptions = (): ActiveHeadingOptions => ({
      expandAllBranches: isInlineToc(),
    });

    this.initBranches(toc, isInlineToc());
    this.bindLinks(toc, links, getActiveOptions);
    const mobileToc = this.initMobileToc(toc, compactTocQuery, isInlineToc);

    let ticking = false;
    const updateActive = () => {
      ticking = false;
      const activeItem = this.findActiveHeading(headingItems);
      this.setActive(toc, links, activeItem, getActiveOptions());
      this.updateMobileToc(mobileToc, activeItem);
    };
    const scheduleUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateActive);
    };

    updateActive();
    compactTocQuery.addEventListener('change', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);

    const observer = new IntersectionObserver(scheduleUpdate, {
      rootMargin: TOC_OBSERVER_ROOT_MARGIN,
      threshold: TOC_OBSERVER_THRESHOLDS,
    });
    headingItems.forEach((item) => observer.observe(item.heading));
  },

  initMobileToc(
    toc: HTMLElement,
    compactTocQuery: MediaQueryList,
    isCompactViewport: () => boolean,
  ): MobileTocHandle {
    const panelId = 'mobile-post-toc';
    const label = translate(i18n.toc, 'Contents');
    const root = document.createElement('div');
    root.className = 'mobile-toc';

    const toggle = document.createElement('button');
    toggle.className = 'mobile-toc-toggle';
    toggle.type = 'button';
    setExpanded(toggle, false);
    toggle.setAttribute('aria-controls', panelId);
    const toggleMark = document.createElement('span');
    toggleMark.className = 'mobile-toc-mark';
    toggleMark.setAttribute('aria-hidden', 'true');
    const toggleText = document.createElement('span');
    toggleText.textContent = label;
    toggle.append(toggleMark, toggleText);

    const panel = document.createElement('nav');
    panel.className = 'mobile-toc-panel';
    panel.id = panelId;
    panel.setAttribute('aria-label', label);

    const title = document.createElement('span');
    title.className = 'mobile-toc-title';
    title.textContent = label;
    panel.appendChild(title);

    const tocList = toc.querySelector('.toc-list');
    const sourceList = tocList ? this.getDirectChild(tocList, 'ol, ul') : null;
    if (sourceList) {
      panel.appendChild(this.createMobileTocList(sourceList));
    }

    root.appendChild(panel);
    root.appendChild(toggle);
    document.body.appendChild(root);

    const close = () => {
      root.classList.remove('is-open');
      setExpanded(toggle, false);
    };
    const togglePanel = () => {
      const isOpen = !root.classList.contains('is-open');
      root.classList.toggle('is-open', isOpen);
      setExpanded(toggle, isOpen);
    };

    toggle.addEventListener('click', togglePanel);
    panel.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href^="#"]')) {
        close();
      }
    });
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Node) || !root.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    const state = {
      isCompactViewport: isCompactViewport(),
      tocPassed: false,
    };
    let tocObserver: IntersectionObserver | null = null;

    const getHeaderOffset = () => Math.ceil(getHeaderHeight() + FLOATING_TOC_HEADER_GAP);
    const applyVisibility = () => {
      const shouldShow = state.isCompactViewport && state.tocPassed;
      root.classList.toggle('is-visible', shouldShow);
      if (!shouldShow) close();
    };
    const syncMediaState = () => {
      state.isCompactViewport = isCompactViewport();
      applyVisibility();
    };
    const createTocObserver = () => {
      if (tocObserver) tocObserver.disconnect();

      const headerOffset = getHeaderOffset();
      tocObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        state.tocPassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= headerOffset;
        applyVisibility();
      }, {
        rootMargin: `-${headerOffset}px 0px 0px 0px`,
        threshold: 0,
      });
      tocObserver.observe(toc);
    };

    compactTocQuery.addEventListener('change', syncMediaState);
    window.addEventListener('resize', () => {
      syncMediaState();
      createTocObserver();
    });
    createTocObserver();

    return { panel, applyVisibility };
  },

  createMobileTocList(
    sourceList: Element,
    depth = 0,
    branchCounter = { value: 0 },
  ): HTMLElement {
    const list = document.createElement(sourceList.tagName.toLowerCase());
    list.className = depth === 0 ? 'mobile-toc-list' : 'mobile-toc-branch';

    Array.from(sourceList.children).forEach((sourceItem) => {
      if (!(sourceItem instanceof Element) || !sourceItem.matches('li')) return;

      const sourceLink = this.getDirectChild(sourceItem, 'a');
      if (!(sourceLink instanceof HTMLAnchorElement)) return;

      const childList = this.getDirectChild(sourceItem, 'ol, ul');
      const item = document.createElement('li');
      item.className = 'mobile-toc-item';

      const levelClass = this.getTocLevelClass(sourceLink);
      if (levelClass) item.classList.add(levelClass);

      const link = document.createElement('a');
      link.href = sourceLink.getAttribute('href') || '#';
      link.className = 'mobile-toc-link';
      link.textContent = sourceLink.textContent.trim();
      link.dataset.targetId = this.getLinkTargetId(sourceLink);

      if (childList) {
        branchCounter.value += 1;
        const childId = `mobile-toc-branch-${branchCounter.value}`;
        const toggle = document.createElement('button');
        toggle.className = 'mobile-toc-branch-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-controls', childId);
        toggle.innerHTML = '<span aria-hidden="true"></span>';

        const mobileChildList = this.createMobileTocList(childList, depth + 1, branchCounter);
        mobileChildList.id = childId;
        item.classList.add('has-children');
        item.append(toggle, link, mobileChildList);

        this.setMobileBranchOpen(item, false);
        toggle.addEventListener('click', () => {
          const shouldOpen = !item.classList.contains('is-open');
          item.classList.toggle('is-manual-open', shouldOpen);
          this.setMobileBranchOpen(item, shouldOpen);
        });
      } else {
        item.appendChild(link);
      }

      list.appendChild(item);
    });

    return list;
  },

  getHeadingItems(links: HTMLAnchorElement[]): TocHeadingItem[] {
    const items: TocHeadingItem[] = [];

    links.forEach((link) => {
      const id = this.getLinkTargetId(link);
      if (!id) return;

      const heading = document.getElementById(id);
      if (heading) items.push({ link, id, heading });
    });

    return items;
  },

  getTocLevelClass(link: Element): string {
    const parent = link.closest('li');
    if (!parent) return '';

    return Array.from(parent.classList).find((name) => TOC_LEVEL_CLASS_PATTERN.test(name)) || '';
  },

  getLinkTargetId(link: Element): string {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#') || href.length < 2) return '';

    try {
      return decodeURIComponent(href.slice(1));
    } catch {
      return href.slice(1);
    }
  },

  getDirectChild<T extends Element = Element>(item: Element, selector: string): T | undefined {
    return Array.from(item.children).find((child): child is T => child.matches(selector));
  },

  initBranches(toc: Element, defaultOpen: boolean): void {
    const branches = Array.from(toc.querySelectorAll('li')).filter((item) =>
      this.getDirectChild(item, 'ol, ul'),
    );

    branches.forEach((item, index) => {
      const childList = this.getDirectChild<HTMLElement>(item, 'ol, ul');
      const link = this.getDirectChild(item, 'a');
      if (!childList) return;

      const childId = childList.id || `toc-branch-${index + 1}`;
      childList.id = childId;
      item.classList.add('has-children');

      const toggle = document.createElement('button');
      toggle.className = 'toc-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-controls', childId);
      toggle.innerHTML = '<span aria-hidden="true"></span>';
      item.insertBefore(toggle, link || childList);

      this.setBranchOpen(item, defaultOpen);

      toggle.addEventListener('click', () => {
        const shouldOpen = !item.classList.contains('is-open');
        item.classList.toggle('is-manual-open', shouldOpen);
        this.setBranchOpen(item, shouldOpen);
      });
    });
  },

  bindLinks(
    toc: Element,
    links: HTMLAnchorElement[],
    getOptions: () => ActiveHeadingOptions,
  ): void {
    toc.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || !toc.contains(link)) return;

      window.setTimeout(() => {
        const targetId = this.getLinkTargetId(link);
        const targetLink = this.findLinkByTarget(toc, targetId);
        if (targetLink) {
          this.setActive(toc, links, {
            id: targetId,
            link: targetLink,
          }, getOptions());
        }
      }, TOC_SCROLL_SYNC_DELAY);
    });
  },

  setBranchOpen(item: Element, isOpen: boolean): void {
    this.setBranchState(item, isOpen, '.toc-toggle');
  },

  expandLabel(): string {
    return translate(i18n.expandToc, 'Expand section');
  },

  collapseLabel(): string {
    return translate(i18n.collapseToc, 'Collapse section');
  },

  findActiveHeading(items: TocHeadingItem[]): TocHeadingItem | undefined {
    if (!items.length) return undefined;

    const scrollBottom = window.scrollY + window.innerHeight;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );

    if (documentHeight - scrollBottom < TOC_BOTTOM_THRESHOLD) {
      return items[items.length - 1];
    }

    const activationY =
      window.scrollY + getHeaderHeight() + window.innerHeight * TOC_ACTIVATION_VIEWPORT_RATIO;
    let activeItem = items[0];

    items.forEach((item) => {
      const headingTop = item.heading.getBoundingClientRect().top + window.scrollY;
      if (headingTop <= activationY) {
        activeItem = item;
      }
    });

    return activeItem;
  },

  setActive(
    toc: Element,
    links: HTMLAnchorElement[],
    activeItem: ActiveItem | undefined,
    options: ActiveHeadingOptions = {},
  ): void {
    if (!activeItem) return;

    links.forEach((link) => {
      const isActive = this.getLinkTargetId(link) === activeItem.id;
      syncCurrentLink(link, isActive);
    });

    const activeLink = activeItem.link;
    const activeBranches = this.getActiveBranches(toc, activeLink);

    Array.from(toc.querySelectorAll('li')).forEach((item) => {
      item.classList.toggle('is-current-branch', activeBranches.has(item));
    });

    Array.from(toc.querySelectorAll('li.has-children')).forEach((item) => {
      const shouldOpen =
        options.expandAllBranches ||
        activeBranches.has(item) ||
        item.classList.contains('is-manual-open');
      this.setBranchOpen(item, shouldOpen);
    });
  },

  updateMobileToc(mobileToc: MobileTocHandle, activeItem: ActiveItem | undefined): void {
    mobileToc.applyVisibility();

    const targetId = activeItem ? activeItem.id : '';
    const links = Array.from(mobileToc.panel.querySelectorAll<HTMLAnchorElement>('.mobile-toc-link'));
    links.forEach((link) => {
      const isActive = link.dataset.targetId === targetId;
      syncCurrentLink(link, isActive);
    });

    const activeLink = links.find((link) => link.dataset.targetId === targetId);
    const activeBranches = this.getActiveBranches(mobileToc.panel, activeLink);

    Array.from(mobileToc.panel.querySelectorAll('.mobile-toc-item')).forEach((item) => {
      item.classList.toggle('is-current-branch', activeBranches.has(item));
    });

    Array.from(mobileToc.panel.querySelectorAll('.mobile-toc-item.has-children')).forEach((item) => {
      const shouldOpen =
        activeBranches.has(item) || item.classList.contains('is-manual-open');
      this.setMobileBranchOpen(item, shouldOpen);
    });
  },

  setMobileBranchOpen(item: Element, isOpen: boolean): void {
    this.setBranchState(item, isOpen, '.mobile-toc-branch-toggle');
  },

  setBranchState(item: Element, isOpen: boolean, toggleSelector: string): void {
    const childList = this.getDirectChild<HTMLElement>(item, 'ol, ul');
    const toggle = this.getDirectChild<HTMLElement>(item, toggleSelector);
    if (!childList || !toggle) return;

    item.classList.toggle('is-open', isOpen);
    childList.hidden = !isOpen;
    setExpanded(toggle, isOpen);
    toggle.setAttribute('aria-label', isOpen ? this.collapseLabel() : this.expandLabel());
  },

  findLinkByTarget(toc: Element, targetId: string): HTMLAnchorElement | undefined {
    return Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).find(
      (link) => this.getLinkTargetId(link) === targetId,
    );
  },

  getActiveBranches(root: Element, activeLink?: HTMLAnchorElement): Set<Element> {
    const branches = new Set<Element>();
    if (!activeLink) return branches;

    let item = activeLink.closest('li');
    while (item && root.contains(item)) {
      branches.add(item);
      item = item.parentElement ? item.parentElement.closest('li') : null;
    }

    return branches;
  },
};
