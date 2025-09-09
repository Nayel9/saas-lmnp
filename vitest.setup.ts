import "@testing-library/jest-dom/vitest";
import { beforeAll, afterAll, vi } from "vitest";

beforeAll(() => {
  if (!window.matchMedia) {
    // Polyfill minimal pour color scheme, media queries
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

afterAll(() => {
  vi.clearAllMocks();
});
