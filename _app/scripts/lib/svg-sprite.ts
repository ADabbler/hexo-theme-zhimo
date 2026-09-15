/**
 * Appends a symbol to the theme's hidden inline SVG sprite if missing.
 * `layout/_partial/scripts.ejs` renders the sprite at the end of the body.
 */
export function ensureSvgSymbol(id: string, viewBox: string, markup: string): void {
  const sprite = document.querySelector<SVGElement>('svg[style*="display:none"]');
  if (!sprite || sprite.querySelector(`#${id}`)) return;

  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  symbol.id = id;
  symbol.setAttribute('viewBox', viewBox);
  symbol.innerHTML = markup;
  sprite.appendChild(symbol);
}
