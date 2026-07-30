---
name: project_slangpy_1067_macos_wheels_pyframe_getlasti
description: "slangpy#1067 macOS wheels fail link cp311+ undefined _PyFrame_GetLasti — regression from"
metadata: 
  node_type: memory
  type: project
  originSessionId: a988d465-c4d3-4f39-aa9b-c1c56d422f8c
---

# slangpy#1067 — macOS wheels link-fail cp311+ (_PyFrame_GetLasti)

**State (2026-07-29):** RESOLVED on triage/review side — **APPROVED, held as DRAFT pending human merge**. PR **#1068** reviewDecision=APPROVED by **@ccummingsNV (human)**, mergeable=MERGEABLE, `Closes #1067` (issue still OPEN — draft doesn't auto-close). No changes requested, no open review threads.
**⚠️ NOT yet green on authoritative signal:** macOS `wheels build-only` cp311–cp314 is **workflow_dispatch-only** and will NOT auto-run on merge. Maintainer must trigger it manually + confirm green BEFORE cutting v0.44.0. Fixer surfaced this caveat on the PR.
**Next HUMAN action (on GitHub):** @skallweitNV / @ccummingsNV → run `wheels build-only` (macos aarch64 cp311–cp314), confirm green, mark #1068 ready, merge before v0.44.0. Issue cmt refreshed (comment-5116278224). CI-coverage gap = #1066.
**Ownership:** triage chain CLOSED our side. slangpy-fixer REMAINS attached to PR #1068 for synchronize/merge webhooks; reaps worktree on merge/close. Canonical thread `gh-issue-shader-slang/slangpy-1067`.

--- prior state (2026-07-16, draft opened) ---
DRAFT PR **#1068** opened by slangpy-fixer (`dev/slangpy-fixer/1067` off `main`@e5e8cb4; `Closes #1067`; `report_pr_created` DONE → webhooks route to fixer; verified isDraft=true). Peer review dispatched to slangpy-reviewer by fixer.
**Fix (fixer, matches triage Approach A + codex-approved PLAN/CODE/OUTPUT):** one line —
`target_link_options(slangpy_ext PRIVATE "$<$<PLATFORM_ID:Darwin>:LINKER:-U,_PyFrame_GetLasti>")`. No code/submodule change; 3.11+ attribution unchanged.
**Authoritative green = macOS `wheels build-only` cp311–cp314** (link failure is macOS+Py3.11+-only; NOT reproducible on Linux CI pinned 3.10 or any unit test; fixer did not run native build — no-op off-Darwin + tight disk). Local genex validated standalone; pre-commit passes.
**Guardrail posture:** stays DRAFT until human/maintainer flips ready. If @skallweitNV self-starts, draft #1068 is safe to abandon. CI-coverage gap = #1066 (out of scope). Public footprint OK: triager's 5-bullet at issue cmt #4986298306 + PR `Closes #1067`.
Report memo: fixer-side `/workspace/agent/reports/slangpy-1067.md`.

--- prior state (2026-07-15, triage) ---

**Triage verdict (P1 release-blocker for v0.44.0):** regression / high / build-system (nanobind link). On macOS, nanobind links via a curated undefined-symbol allow-list (`external/nanobind/cmake/darwin-ld-cpython.sym`) that omits `_PyFrame_GetLasti` → hard link error for Py≥3.11. cp39/cp310 take `frame->f_lasti` branch, link fine.
**Recommended fix A (triager):** one platform-guarded `target_link_options(... -U,_PyFrame_GetLasti)` line in `src/slangpy_ext/CMakeLists.txt` (~L87) — resolves at import time like sibling frame symbols already do; zero behaviour regression. Reporter's "link libpython" (C) REJECTED — nanobind deliberately avoids libpython on macOS.
**Files:** `profiler.cpp:20-27`; `CMakeLists.txt:~87`; `darwin-ld-cpython.sym`.
**Ownership:** slangpy-triager OWNS fixer wire → forwarded directly (I do NOT double-dispatch). @skallweitNV assigned-by-reporter + pinged h2h but NOT engaged (no comment/PR) → fixer DRAFTS + coordinates, does NOT race the maintainer. Stand down to skallweitNV if he starts a fix.

**What:** macOS arm64 wheel `build-only` fails at LINK time for Python 3.11–3.14 (cp311–cp314). cp39/cp310 pass. Undefined symbol `_PyFrame_GetLasti` referenced from `python_caller_site()` in `profiler.cpp.o`.

**Root cause (reporter):** `src/slangpy_ext/utils/profiler.cpp` calls `PyFrame_GetLasti()` when `PY_VERSION_HEX >= 0x030b0000`; older Pythons use `frame->f_lasti`. Symbol not resolving at link time on macOS ext-module builds (limited-API / no explicit libpython link).

**Regression from:** #1063 (Profiler), merged 2026-07-13. Blocks ALL macOS wheel publishes for Py3.11+. NOT #1002 (cp314 bump) — Linux/Windows cp314 built fine same run (run 29453450122).

**Fix options (reporter):** limited-API-safe frame offset (all platforms preferred); or link libpython; or fallback avoiding non-exported symbols on macOS.

**Acceptance:** wheels build-only green macos aarch64 cp311–cp314 + profiler caller-site attribution still works on macOS Py3.11+.

**Why it slipped CI (reporter follow-up cmt 4986213993):** (1) `wheels` workflow is `workflow_dispatch`-only — no PR runs cibuildwheel. (2) macOS PR CI (`ci.yml`) pins `python: ["3.10"]` so profiler.cpp compiles on macOS but takes the pre-3.11 `frame->f_lasti` branch — never references `PyFrame_GetLasti`. Bad symbol only appears building against Py3.11+. Would've been caught by a `wheels build-only` on main post-merge or a macOS cp313 smoke job in PR CI. Related policy gap: **#1066** (CI-coverage gap).

**Priority (cmt 4986225987):** reporter pinged maintainer **@skallweitNV** — "probably needs a fix before we do a v0.44.0". So this is a **release-blocker for v0.44.0**, not just wheel publishes. If skallweitNV self-assigns/starts a fix, that takes precedence (don't double-drive); else chain stays with us → slangpy-fixer. No bot GitHub post (human-to-human thread, bot not mentioned).

**Next:** await triager verdict → likely slangpy-fixer, unless skallweitNV picks it up. Related: profiler PR #1063, policy gap #1066.
