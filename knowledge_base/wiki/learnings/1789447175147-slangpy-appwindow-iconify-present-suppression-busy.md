---
title: "SlangPy AppWindow iconify present-suppression: busy-loop trap + GLFW test/refcount gotchas (#1154 / PR #1157)"
type: learning
topic: slang-compiler
source: learnings/1789447175147-slangpy-appwindow-iconify-present-suppression-busy.md
---

# SlangPy AppWindow iconify present-suppression: busy-loop trap + GLFW test/refcount gotchas (#1154 / PR #1157)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373359640-k9dsar
written_at: 2026-09-15T04:39:35.147Z
---

# SlangPy AppWindow iconify present-suppression: busy-loop trap + GLFW test/refcount gotchas (#1154 / PR #1157)

Implemented #1154 (cached `Window::is_minimized()` + `on_iconify(bool)` via `glfwSetWindowIconifyCallback`, mirroring the `on_refresh`/#1133 pattern, + a native present-suppression guard in `AppWindow::_run_frame`). PR #1157, peer-approved, full CI matrix green. Reusable findings:

- **Present-suppression via early-return introduces a busy-loop.** Adding `if (is_minimized() || !config()) return;` to `AppWindow::_run_frame` removes the natural pacing that `acquire_next_image()`/`present()` provided, so `App::run()` + non-blocking `glfwPollEvents()` spin at 100% CPU while minimized. Fix at the app-loop level: make `_run_frame()` and `App::run_frame()` return `bool` (rendered?) using non-short-circuit `rendered |= window->_run_frame()` (so every window still pumps events), and `App::run()` `std::this_thread::sleep_for(10ms)` when nothing rendered. A short sleep beats `glfwWaitEventsTimeout` here because app.cpp otherwise has no GLFW dependency (layering). This also fixes the pre-existing unconfigured-surface spin.

- **`init_glfw()` (src/sgl/core/window.cpp) has a latent refcount bug:** `glfw_ref_count.fetch_add(1)` runs BEFORE `glfwInit()` throws on failure, so a failed init leaves the counter at 1 with GLFW uninitialized → later window creation skips init and misbehaves. Out of scope for a windowing fix but worth a separate issue.

- **Window/GLFW APIs can't be unit-tested headlessly** (GLFW is X11-forced on Linux, no Null platform; `glfwInit` fails with a catchable `RuntimeError` when `DISPLAY` is empty). Pattern that satisfies "new Python API needs a test" without flakiness: (1) a binding-surface test that only does `hasattr(spy.Window, "is_minimized")` (always runs, no construction); (2) a `@pytest.mark.skipif(not os.environ.get("DISPLAY"))` test that constructs a Window — the DISPLAY guard skips BEFORE construction on headless CI, so it never drives the `init_glfw` failure/refcount-corruption path. #1133 (on_refresh) shipped with NO test and was accepted, but codex/reviewers still expect at least the surface test.

- **Adding a window callback = 6 edits** (mirror `on_refresh`): window.h (typedef + accessor pair + private `handle_*` decl + `m_on_*` member), window.cpp (`EventHandlers::handle_*` static trampoline + `glfwSet*Callback` in ctor + `Window::handle_*` dispatcher), slangpy_ext/core/window.cpp (`def_prop_rw` + a matching `visitor("on_*")` line in `GcHelper<Window>::traverse` for GC-cycle correctness), and hand-add py_doc.h entries (the `slangpy_pydoc` mkdoc target is manual, not in the default build; `py_doc.h` is also pre-commit-excluded).

- **Tooling:** `pre-commit` isn't on PATH but exists at `/workspace/agent/venv-1130/bin/pre-commit`; clang-format 20.1.7 / black 24.4.2 install cleanly into a venv. `git push --force-with-lease` fails with "stale info" when the remote-tracking ref wasn't materialized (fetch via explicit refspec only updates FETCH_HEAD) — verify the real remote tip with `git ls-remote origin <branch>`, confirm no third-party pushes, then push with an explicit `--force-with-lease=<branch>:<verified-sha>`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789447175147-slangpy-appwindow-iconify-present-suppression-busy.md`_
