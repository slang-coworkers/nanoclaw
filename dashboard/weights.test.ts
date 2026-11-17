/**
 * The open/closed weights pill and filter (dashboard/public/weights.js), which
 * every coworker and session panel of both pages draws through. weights.js is
 * a classic browser script, so it runs here against a fake window.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, 'public', 'weights.js'), 'utf-8');

interface Weights {
  pill(weights: unknown, provider?: string | null): string;
  loadFilter(view: string): string;
  saveFilter(view: string, value: string): void;
  matches(weights: unknown, filter: string): boolean;
  filterBar(view: string, filter: string, classes: unknown[]): string;
  register(view: string, rerender: () => void): void;
}

type Listener = (e: unknown) => void;

function load(storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void }) {
  const store = new Map<string, string>();
  const listeners: Listener[] = [];
  const win: Record<string, unknown> = {
    localStorage: storage ?? {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
    document: { addEventListener: (type: string, fn: Listener) => type === 'click' && listeners.push(fn) },
  };
  new Function('window', SRC)(win);
  return { w: win.NanoclawWeights as Weights, store, listeners };
}

describe('weights.js', () => {
  it('draws one pill per known class and nothing for an unknown one', () => {
    const { w } = load();
    expect(w.pill('open', 'opencode')).toBe(
      '<span class="wt-pill wt-open" title="Open-weights models only · provider opencode">open</span>',
    );
    expect(w.pill('closed', null)).toBe(
      '<span class="wt-pill wt-closed" title="Calls a closed-weights model">closed</span>',
    );
    expect(w.pill(null, 'claude')).toBe('');
    expect(w.pill('any', 'claude')).toBe('');
  });

  it('escapes the provider name in the title', () => {
    const { w } = load();
    expect(w.pill('open', '"><b>')).toContain('provider &quot;&gt;&lt;b&gt;');
  });

  it('keeps each view its own filter and falls back to all', () => {
    const { w } = load();
    expect(w.loadFilter('sidebar')).toBe('all');
    w.saveFilter('sidebar', 'closed');
    expect(w.loadFilter('sidebar')).toBe('closed');
    expect(w.loadFilter('sessions')).toBe('all');
    w.saveFilter('sessions', 'bogus');
    expect(w.loadFilter('sessions')).toBe('all');
  });

  it('reads all when storage throws (a private window)', () => {
    const { w } = load({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(w.loadFilter('sidebar')).toBe('all');
    expect(() => w.saveFilter('sidebar', 'open')).not.toThrow();
  });

  it('shows an unknown class only under all', () => {
    const { w } = load();
    expect(w.matches(null, 'all')).toBe(true);
    expect(w.matches(null, 'open')).toBe(false);
    expect(w.matches('open', 'open')).toBe(true);
    expect(w.matches('closed', 'open')).toBe(false);
  });

  it('counts each filter over the unfiltered list and marks the active one', () => {
    const { w } = load();
    const bar = w.filterBar('groups', 'closed', ['open', 'closed', 'closed', null]);
    expect(bar).toContain('data-weights-value="all" aria-pressed="false">all <span class="wt-filter-count">4</span>');
    expect(bar).toContain('data-weights-value="open" aria-pressed="false">open <span class="wt-filter-count">1</span>');
    expect(bar).toContain(
      'class="wt-filter-btn wt-closed active" data-weights-filter="groups" data-weights-value="closed" aria-pressed="true">closed <span class="wt-filter-count">2</span>',
    );
  });

  it('stores a clicked filter and redraws only that view', () => {
    const { w, store, listeners } = load();
    let sidebar = 0;
    let sessions = 0;
    w.register('sidebar', () => sidebar++);
    w.register('sessions', () => sessions++);
    const btn = { dataset: { weightsFilter: 'sidebar', weightsValue: 'open' } };
    const event = {
      target: { closest: (sel: string) => (sel === '[data-weights-filter]' ? btn : null) },
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    expect(listeners).toHaveLength(1);
    listeners[0](event);
    expect(store.get('nanoclaw-weights-filter:sidebar')).toBe('open');
    expect([sidebar, sessions]).toEqual([1, 0]);
  });
});
