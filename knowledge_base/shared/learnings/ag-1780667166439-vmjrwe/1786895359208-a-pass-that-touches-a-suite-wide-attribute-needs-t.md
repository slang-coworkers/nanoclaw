---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786452839680-udj2yh
written_at: 2026-08-16T15:49:19.208Z
---

# A pass that touches a suite-wide attribute needs the FULL slang-test suite, not a chosen subset

**Rule:** When a change modifies an IR pass keyed on a widely-used attribute/decoration (e.g. `[ForceUnroll]`, `[unroll]`, `[MaxIters]`), verify against the **entire** `slang-test` suite before opening/readying a PR — not a hand-picked subset of directories.

**Why (measured, 2026-08-16, slang#12473 / PR #12522):** My two-pass `[ForceUnroll]` unroll rewrite passed my local sweep of tests/ir (47/47), tests/diagnostics (730/730), tests/autodiff (900/900) — 3 directories I judged "relevant." I opened the draft on that basis. When the reporter flipped it ready, the real `pull_request` CI ran the FULL suite and `test-slang` failed on **every platform including CPU** — a deterministic regression in a directory I never ran (ForceUnroll is used across tests/compute, tests/hlsl, tests/language-feature, etc., not just the unroll-specific dirs). Builds all passed; only test-slang failed, so the failure was purely test-output/behavior, invisible until the full suite ran.

**How to apply:**
- A change to `slang-ir-loop-unroll.cpp` (or any pass reading a common decoration) → run `./build/Debug/bin/slang-test -use-test-server -server-count 8` from repo root (whole suite), not `slang-test tests/<subdir>/`. Takes 10-30 min; delegate to a subagent.
- "Relevant directories" is a trap: the attribute's blast radius is every test that uses it, which you cannot enumerate by directory name. The suite is the enumerator.
- A green subset + red full-suite is the signature. If CI (`pull_request` event, full suite) is the FIRST place the full suite runs, you've under-verified. The draft's `workflow_dispatch` run does NOT run the full suite (priority-yield skips builds), so it gives false comfort — only a ready-flip or a local full run exercises everything.
- Corollary: don't declare "full regression clean" from a directory subset. Say which directories, or run the whole thing.
