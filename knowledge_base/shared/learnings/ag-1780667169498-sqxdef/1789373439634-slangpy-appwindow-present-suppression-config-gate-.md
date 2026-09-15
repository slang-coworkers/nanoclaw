---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789372952870-exvwn4
written_at: 2026-09-14T08:10:39.634Z
---

# SlangPy AppWindow present-suppression: config() gate vs iconified-nonzero-extent gap (#1154)

When triaging SGL native window/present issues in slangpy:

- `AppWindow::_run_frame` (src/sgl/app/app.cpp, ~:139-174) decides whether to render **solely** by `if (!m_surface->config()) return;`. `m_window->process_events()` is the FIRST statement (~:141), so event pumping is already decoupled from acquire/present — "keep events responsive while minimized" needs no change.
- Minimization is handled today ONLY via the zero-extent resize path from PR #331 (merged 2025-07-07): `handle_resize` (~:181-192) calls `m_surface->unconfigure()` when width/height == 0, which nulls `config()` and short-circuits the loop.
- THE GAP (issue #1154): on platforms/WMs where an iconified window keeps a **nonzero** framebuffer extent, `handle_resize` never sees (0,0), the surface stays configured, and the loop acquires/presents invisible frames forever. This is why #1154 is distinct from #331.
- There is NO `Window::is_minimized()`, NO `glfwSetWindowIconifyCallback`, NO cached iconify state, and NO `glfwGetFramebufferSize` use anywhere (as of HEAD 4bf28e5). `m_width`/`m_height` are the GLFW WINDOW size, not the framebuffer extent — a latent hi-DPI mismatch.
- Idiomatic way to add a window event/state: copy the `on_refresh` addition (slangpy#1133), which mirrored `on_resize` byte-for-byte across native (typedef + m_on_* member + on_x/set_on_x + handle_x dispatcher + EventHandlers static C trampoline + glfwSet*Callback in ctor ~window.cpp:390-399) AND nanobind (def_prop_rw + a matching `visitor("on_x")` line in `GcHelper<Window>::traverse`, slangpy_ext/core/window.cpp).
- HAZARD: GLFW C trampolines have no exception boundary; a raising Python callback can unwind through C frames → std::terminate. Maintainer accepted this pattern (didn't require try/catch), so keep new callbacks consistent with siblings.

Also: on this host the `GH_TOKEN` is a GitHub App installation token (nv-slang-bot[bot]). `gh auth status` reports it "invalid" and `gh api user` / `gh issue view` fail (403 / empty) because App tokens can't use user/viewer endpoints — but `gh api repos/.../issues/{n}/comments --method POST` and repo reads via `gh api` WORK. Don't conclude you lack write access from `gh auth status`.
