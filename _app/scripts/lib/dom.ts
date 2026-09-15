/** Small DOM helpers shared across feature modules. */

export function getHeaderHeight(): number {
  const header = document.querySelector('.site-header');
  return header ? header.getBoundingClientRect().height : 0;
}

export function setExpanded(element: Element, isExpanded: boolean): void {
  element.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}

export function syncCurrentLink(link: Element, isCurrent: boolean): void {
  link.classList.toggle('active', isCurrent);
  if (isCurrent) {
    link.setAttribute('aria-current', 'location');
    return;
  }

  link.removeAttribute('aria-current');
}
