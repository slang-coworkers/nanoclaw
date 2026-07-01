---
title: "Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides"
type: learning
topic: ci-tooling
source: learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md
---

# Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides

# Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides

**Context.** Triaging shader-slang/shader-slang.github.io#122 (May 2026). Sphinx site with `furo` theme had brand-consistent code-block colors in light mode but Furo's default Pygments palette in dark mode. Reporter (and triage) initially suspected a CSS specificity bug; root cause was structural.

**Why unscoped `.highlight .*` CSS rules lose in dark mode.** Furo emits its bundled `pygments_dark_style` as rules wrapped in `body:not([data-theme="light"]) .highlight .k { … }`. That selector has higher specificity than a plain `.highlight .k` in your `theme_overrides.css`, so the custom rule wins in light (where Furo's `body[data-theme="light"] .highlight .k` is presumably loaded earlier and lower in cascade order) but loses in dark every time. Adding `!important` to a plain `.highlight .k` works only by accident — the right answer isn't to fight specificity, it's to use Furo's intended hook.

**The intended hook.** Furo supports a `pygments_dark_style` config key alongside Sphinx's standard `pygments_style`. Both accept either a built-in Pygments style name (e.g. `"default"`, `"monokai"`) OR a fully-qualified Python class path to a `pygments.style.Style` subclass.

**Recommended pattern for brand-consistent custom colors.**

In `docs/conf.py`:
```python
pygments_style = "_ext.slang_pygments.SlangLightStyle"
pygments_dark_style = "_ext.slang_pygments.SlangDarkStyle"
```

(Assumes `_ext/` is on `sys.path`, which it usually is via `sys.path.insert(0, os.path.abspath('.'))` near the top of `conf.py`.)

In `docs/_ext/slang_pygments.py`:
```python
from pygments.style import Style
from pygments.token import Keyword, Name, Comment, String, Number, Operator, Punctuation

class SlangLightStyle(Style):
    background_color = "#F8F8F8"
    styles = {
        Keyword:     "#1243d4",
        Name.Class:  "#11abb9",
        Comment:     "#148b04",
        String:      "#d14",
        Number:      "#7211c2",
        # ...
    }

class SlangDarkStyle(Style):
    background_color = "#1e1e1e"
    styles = {
        Keyword:     "<dark variant>",
        # ... matched palette for dark
    }
```

Then **delete** the `.highlight .*` color-override block from `theme_overrides.css` — Pygments will emit equivalent rules with the right `body[data-theme]` scoping for free.

**Caveat — non-Pygments code on the same site.** If the site has a separate page (e.g. an auto-generated reference) that uses its own non-Pygments span classes (`pre .code_keyword`, `pre .code_var`, etc.), `pygments_dark_style` cannot help it. Scope those rules with `body[data-theme="dark"]` + an `@media (prefers-color-scheme: dark) body:not([data-theme="light"]) …` block for Furo's `auto` mode — same pattern Furo uses internally. No JS needed if there's already a `data-theme` propagator (the slang docs site has `iframe_theme_sync.js`/`iframe_theme_receiver.js` from PR #119 that propagates `data-theme` into iframes via `postMessage`).

**Verifying on RTD.** `pygments_style` accepting a dotted Python path (instead of a built-in style name) requires that the module is importable in the RTD builder. `_ext/` on `sys.path` is the usual route; if it fails, fall back to a built-in style name and replicate the colors via that.

**File pointers (for shader-slang/shader-slang.github.io specifically).**
- `docs/conf.py` — `html_theme = "furo"` + `html_theme_options` block. No `pygments_*` keys are set; Furo defaults apply.
- `docs/_static/theme_overrides.css` — `.highlight .*` block ~lines 287–373 (delete after adopting custom styles); `pre .code_*` block ~lines 388–449 (scope with `data-theme`).
- Prior PRs: #119 (added `iframe_theme_sync.js` + `iframe_theme_receiver.js` infrastructure), #123 (interim color-stripping stopgap by @aidanfnv).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md`_
