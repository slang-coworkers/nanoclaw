---
title: "SGL update_mouse_cursor lacks canonical ImGui cursor guards (NoMouseCursorChange / CURSOR_DISABLED)"
type: learning
topic: misc
source: learnings/1789819821175-sgl-update-mouse-cursor-lacks-canonical-imgui-curs.md
---

# SGL update_mouse_cursor lacks canonical ImGui cursor guards (NoMouseCursorChange / CURSOR_DISABLED)

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789819336032-i9pe5r
written_at: 2026-09-19T12:10:21.175Z
---

# SGL update_mouse_cursor lacks canonical ImGui cursor guards (NoMouseCursorChange / CURSOR_DISABLED)

While reviewing shader-slang/slangpy#1172 (AppWindow passing `m_window.get()` to `ui::Context::begin_frame` so ImGui cursor requests reach the OS):

- `sgl::ui::Context::update_mouse_cursor(window)` (src/sgl/ui/ui.cpp ~757) is SGL's own hand-rolled cursor sync — SGL does NOT vendor imgui_impl_glfw. Its else-branch forces `window->set_cursor_mode(CursorMode::normal)` every frame whenever ImGui's cursor != None (i.e. almost always, since default is Arrow). It checks **neither** `ImGuiConfigFlags_NoMouseCursorChange` **nor** whether the cursor is `CursorMode::disabled` (GLFW_CURSOR_DISABLED) — both of which the canonical ImGui GLFW backend early-returns on.
- Consequence: any app that captures the cursor via `CursorMode::disabled` (FPS/relative-mouse camera) would have the capture released every frame. `Window::set_cursor_mode` (window.cpp) no-ops only when the mode is unchanged, so it does NOT protect this case (normal≠disabled).
- Reachability check that mattered for the verdict: `AppWindow::m_window` is **private** (src/sgl/app/app.h:104) with no public accessor, and grep shows **nothing in src/examples/samples/slangpy sets CursorMode::disabled** — the only callers of set_cursor_mode are inside update_mouse_cursor itself. So PR #1172 *exposes* a pre-existing latent gap, not a regression → APPROVE_WITH_NITS with the guard as a tracked follow-up (not a blocker). codex leaned Request Changes on the same point; reachability is the tie-breaker.
- Reviewer-container reality (reconfirms prior learning): full SGL build infeasible (missing python3-dev + X11 headers; GLFW links unconditionally even headless). Report build as "compile-plausible / unconfirmed-by-me" and lean on `-fsyntax-only` + an existing identical shipping call site as evidence. The identical 3-arg begin_frame call already ships at examples/pathtracer/pathtracer.cpp:891 (pathtracer uses click-drag camera, not capture, so it's unaffected).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789819821175-sgl-update-mouse-cursor-lacks-canonical-imgui-curs.md`_
