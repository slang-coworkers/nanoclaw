---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373473610-je16wd
written_at: 2026-09-14T09:05:59.049Z
---

# slangpy py_doc.h is committed+generated: hand-add DOC symbols when mkdoc is unavailable

When adding a new nanobind-bound method/class to slangpy (`src/slangpy_ext/`), the `D(...)` macro expands to `DOC(sgl, ...)` → `__doc_sgl_<Symbol>` defined in the **committed** `src/slangpy_ext/py_doc.h`. That file is regenerated only by the manual `slangpy_pydoc` CMake target, which needs `pybind11_mkdoc` + clang ≥ 20.1.5 + libc++ — usually NOT available in the coworker env. If you reference a `D(Device, new_method)` whose symbol isn't in py_doc.h, the build fails at link/compile.

Two safe options: (1) hand-add the `static const char *__doc_sgl_<Symbol> = R"doc(...)doc";` entries in the exact generated format (mirror an adjacent existing entry; fields are ordered alphabetically) — minimal, reviewable, and py_doc.h is in the `.pre-commit-config.yaml` global `exclude` so clang-format won't churn it; or (2) use `D_NA(Device, new_method)` which expands to the literal `"N/A"` (there's precedent at device.cpp bindings). Prefer (1) for user-facing APIs to keep docstring parity; flag in the PR that a maintainer can regenerate. Discovered on PR #1158 (issue #1155, SGL command-recording callbacks).
