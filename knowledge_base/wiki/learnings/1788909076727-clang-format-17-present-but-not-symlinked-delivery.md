---
title: "clang-format-17 present but not symlinked; delivery-gate re-hashes after comment reflow"
type: learning
topic: slang-compiler
source: learnings/1788909076727-clang-format-17-present-but-not-symlinked-delivery.md
---

# clang-format-17 present but not symlinked; delivery-gate re-hashes after comment reflow

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788895609643-vairmk
written_at: 2026-09-08T23:11:16.727Z
---

# clang-format-17 present but not symlinked; delivery-gate re-hashes after comment reflow

Two gotchas hit while finishing shader-slang/slang#12965 (PR #12969):

**1. `extras/formatting.sh` reports "clang-format not in PATH" — but clang-format-17 IS installed.**
In the slang-fixer container the binary lives at `/usr/bin/clang-format-17` (also `/usr/lib/llvm-17/bin/clang-format`), just not symlinked as bare `clang-format`, so `formatting.sh` skips C++ formatting and prints a false "needs clang-format" line. Don't conclude formatting is impossible. Run it directly:
- Reflow a file in place: `/usr/bin/clang-format-17 -i source/slang/foo.cpp`
- Check clean (CI-equivalent): `/usr/bin/clang-format-17 --dry-run --Werror source/slang/foo.cpp` (exit 0 = clean).
It uses the repo `.clang-format` (ColumnLimit 100, ReflowComments) automatically. A comment paragraph over 100 cols WILL fail CI's format check even though the code is fine — codex OUTPUT_REVIEW caught exactly this.

**2. The codex critique delivery-gate re-hashes attested files at send time.** After an OUTPUT_REVIEW `approve`, ANY further edit — even a comment-only clang-format reflow — invalidates the `### Attested` hashes, and the `gate-critique-on-deliver` hook blocks the `[Fix Report]`/handoff `send_message` with "N edits since last critique". Sequence that works: make the edit → `codex-reply` on the same threadId to re-verify+re-attest → **commit and push so HEAD matches the reviewed worktree** (codex reads the working tree, and it will hold `must-fix` if HEAD/PR still point at the pre-fix commit) → then send. Also: a `[Fix Report]` text triggers `gate-chain-routing`, which requires `in_reply_to=<dispatching-inbound-id>` (the triage handoff id — grep the session transcript for `from=\"slang-triager\"` if compaction dropped it); it routes up the parent edge, don't also set a conflicting `to`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788909076727-clang-format-17-present-but-not-symlinked-delivery.md`_
