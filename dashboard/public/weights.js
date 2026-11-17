/**
 * The open/closed weights pill and filter, shared by app.js and mobile.js.
 *
 * The server resolves the provider and the weights class of every coworker
 * and session with spawn's own rules (dashboard/coworker-models.ts
 * weightsBadge) and sends them as `weights` ('open' | 'closed' | null) next to
 * the effective provider. This file only draws them: one pill and one
 * three-way filter, so every panel looks and behaves the same. The colours
 * live in weights.css.
 *
 * We load it as a classic script, like state-sync.js, because mobile.js is not
 * a module and a plain global is the only shape both pages can consume.
 */
(function (root) {
  const FILTERS = ['all', 'open', 'closed'];
  const STORAGE_PREFIX = 'nanoclaw-weights-filter:';
  const rerenderers = new Map();

  function escHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }

  /** Return the pill for one coworker or session; empty when its class is unknown. */
  function pill(weights, provider) {
    if (weights !== 'open' && weights !== 'closed') return '';
    const what = weights === 'open' ? 'Open-weights models only' : 'Calls a closed-weights model';
    const title = provider ? `${what} · provider ${provider}` : what;
    return `<span class="wt-pill wt-${weights}" title="${escHtml(title)}">${weights}</span>`;
  }

  /** Return the stored filter of one view ('all' | 'open' | 'closed'); 'all' when none or unreadable. */
  function loadFilter(view) {
    try {
      const value = root.localStorage.getItem(STORAGE_PREFIX + view);
      return FILTERS.includes(value) ? value : 'all';
    } catch {
      return 'all';
    }
  }

  function saveFilter(view, value) {
    try {
      root.localStorage.setItem(STORAGE_PREFIX + view, value);
    } catch {
      /* private window or blocked storage: the filter still applies until reload */
    }
  }

  /** True when an item of class `weights` shows under `filter`. An unknown class shows only under 'all'. */
  function matches(weights, filter) {
    return filter === 'all' || weights === filter;
  }

  /**
   * Return the filter buttons of one view, each with its count over `classes`
   * (the weights of every item in the unfiltered list).
   */
  function filterBar(view, filter, classes) {
    const count = (value) => classes.filter((w) => matches(w, value)).length;
    const buttons = FILTERS.map((value) => {
      const active = value === filter ? ' active' : '';
      const tone = value === 'all' ? '' : ` wt-${value}`;
      return `<button type="button" class="wt-filter-btn${tone}${active}" data-weights-filter="${escHtml(view)}" data-weights-value="${value}" aria-pressed="${value === filter}">${value} <span class="wt-filter-count">${count(value)}</span></button>`;
    }).join('');
    return `<span class="wt-filter" role="group" aria-label="Filter by model weights">${buttons}</span>`;
  }

  /** Register the function that redraws `view` after its filter changes. */
  function register(view, rerender) {
    rerenderers.set(view, rerender);
  }

  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-weights-filter]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const view = btn.dataset.weightsFilter;
      saveFilter(view, btn.dataset.weightsValue);
      const rerender = rerenderers.get(view);
      if (rerender) rerender();
    });
  }

  root.NanoclawWeights = { FILTERS, pill, loadFilter, saveFilter, matches, filterBar, register };
})(typeof window !== 'undefined' ? window : globalThis);
