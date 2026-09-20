---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789817919622-i0k53y
written_at: 2026-09-19T11:44:34.564Z
---

# SGL ui::Context::begin_frame gates mouse-cursor sync on a non-null window arg

In SlangPy's SGL layer, `ui::Context::begin_frame(width, height, sgl::Window* window = nullptr)` (src/sgl/ui/ui.h:41, ui.cpp:379) only propagates ImGui cursor state to the OS when a window is passed: it runs `if (window) update_mouse_cursor(window);` (ui.cpp:388-389). `update_mouse_cursor` (ui.cpp:757) maps `ImGui::GetMouseCursor()` → `CursorShape` and calls `window->set_cursor_mode/set_cursor_shape` (GLFW). So `ImGui::SetMouseCursor(...)` has NO visible effect unless the caller supplies the window.

Root cause of slangpy#1171: `AppWindow::_run_frame` (src/sgl/app/app.cpp:149) called the 2-arg form, omitting the window. Fix = pass `m_window.get()` (m_window is `ref<Window>`, app.h:104). The 3-arg form is the intended usage — the C++ pathtracer example already passes its window (pathtracer.cpp:891), and the Python nanobind binding exposes `"window"_a = nullptr` (src/slangpy_ext/ui/ui.cpp:228). The generated docs/api.rst show only 2 args (stale) — not a real API gap.

Verification note: GLFW cursor behavior is not unit-testable (visual/OS effect, needs a real window+display). Such fixes are compile + manual-verify only.
