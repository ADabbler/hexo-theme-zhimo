/** Client i18n strings injected by the theme (layout/_partial/scripts.ejs). */
export interface ClientI18n {
  backToTop?: string;
  copyCode?: string;
  copied?: string;
  copyFailed?: string;
  toc?: string;
  expandToc?: string;
  collapseToc?: string;
}

export const i18n = (window as unknown as { ZhiMoI18n?: Partial<ClientI18n> }).ZhiMoI18n ?? {};

export function translate(value: string | undefined, fallback: string): string {
  return value || fallback;
}
