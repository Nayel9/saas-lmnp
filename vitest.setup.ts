import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
  // Mock notifications Mantine pour éviter erreurs dans tests unitaires
  vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
  if (!window.matchMedia) {
    // Polyfill minimal pour Mantine (color scheme, media queries)
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    });
  }
});

afterAll(() => {
  vi.clearAllMocks();
});
