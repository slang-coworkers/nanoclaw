---
title: "SlangPy PR review: pin to explicit SHAs (shared checkout races) + codex-critique OUTPUT_REVIEW recording gotcha"
type: learning
topic: slang-compiler
source: learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md
---

# SlangPy PR review: pin to explicit SHAs (shared checkout races) + codex-critique OUTPUT_REVIEW recording gotcha

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789376478269-xksgrc
written_at: 2026-09-15T15:27:33.134Z
---

# SlangPy PR review: pin to explicit SHAs (shared checkout races) + codex-critique OUTPUT_REVIEW recording gotcha

From reviewing shader-slang/slangpy#1157 (Window iconify/present-suppression) in the slangpy-reviewer container:

**1. The mounted `/workspace/agent/slangpy` checkout is SHARED and races.** During a single review the working-tree HEAD was switched out from under me by a concurrent agent (pr1157 → pr1158 → da8844f3). Never trust the working tree for a review. Anchor everything to explicit commit SHAs: fetch `pull/<n>/head`, compute the diff as `git diff <merge-base> <head>` and save it to `/tmp` for the `diff_hash`, and read files with `git show <sha>:path` — not the working copy. A subagent that "cd"s and reads files can silently read the wrong commit.

**2. codex-critique OUTPUT_REVIEW rounds via `codex-reply` do NOT count toward the delivery gate.** `mcp__codex__codex-reply` has no `developer-instructions` field, so the `track-critique.sh` hook can't verify the canonical reviewer sentinel block and refuses to record the round ("developer-instructions do not match the canonical block"). Each recorded critique round must be a FRESH `mcp__codex__codex` call carrying the verbatim `/codex-critique` developer-instructions. Also: codex on OUTPUT_REVIEW will find a new nit every round (treadmill) — the skill's "3 rounds unresolved → stop, escalate" rule is real; make the clearly-correct fixes, then stop.

**3. Independent build verification of any SGL/Window PR is infeasible in the reviewer container without admin-approved install_packages.** Missing `Python.h` (python3-dev) blocks CMake configure (`CMakeLists.txt:133`), and GLFW links unconditionally into libsgl so X11 dev headers (libxinerama-dev, libxcursor-dev, libxi-dev) are needed to compile even headless. This is an environment/image limitation, not a budget one — a larger cost ceiling does not help. Report the fixer's build claim as "unconfirmed-by-me," and fall back to a version-pinned code review; that is an accepted outcome.

**4. Reviewable correctness pattern for "skip present while minimized" guards.** Adding an early-return in the frame loop (before `acquire_next_image`/`present`) removes the loop's back-pressure. If the app run loop uses non-blocking `glfwPollEvents()` with no sleep, this busy-polls at 100% CPU while minimized. Note `AppWindow.enable_vsync` defaults to FALSE, so don't claim "was vsync-paced" — the real prior pacing is (backend-dependent) swapchain-image acquisition. The clean fix (which #1157 adopted) is to make `run_frame()` return whether anything rendered and `sleep_for(10ms)` when nothing did (covers the pre-existing unconfigured case too), using a non-short-circuit `|=` accumulation so every window still pumps events.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789486053134-slangpy-pr-review-pin-to-explicit-shas-shared-chec.md`_
