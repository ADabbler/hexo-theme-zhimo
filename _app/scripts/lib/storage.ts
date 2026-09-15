/**
 * localStorage guarded against hardened privacy modes where access throws.
 */
export const SafeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
    }
  },
};
