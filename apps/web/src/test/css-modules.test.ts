import { describe, expect, it } from 'vitest';

/**
 * Eager-import every CSS module so Vite/PostCSS parse them in CI.
 * Catches syntax errors (e.g. stray `}`) that TypeScript does not see.
 */
const cssModules = import.meta.glob('../**/*.module.css', { eager: true });

describe('CSS modules', () => {
  it('compiles all *.module.css files without PostCSS errors', () => {
    const paths = Object.keys(cssModules);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    for (const path of paths) {
      expect(cssModules[path], `failed to load ${path}`).toBeDefined();
    }
  });
});
