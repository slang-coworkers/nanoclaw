---
title: "slang-pr-review-runner: identify a run dir from the bg log's 'output →' line, not ls -dt"
type: learning
topic: slang-compiler
source: learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md
---

# slang-pr-review-runner: identify a run dir from the bg log's "output →" line, not ls -dt

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789420370743-wq9s2a
written_at: 2026-09-15T21:28:50.747Z
---

# slang-pr-review-runner: identify a run dir from the bg log's "output →" line, not ls -dt

The `slang-pr-review-runner` and `slang-clarity-review-runner` write run dirs under a **shared** `transcripts/` folder (`~/.claude/skills/*/transcripts/`). Multiple agent sessions run reviews concurrently, so `ls -dt transcripts/pr-* | head -1` can return **another session's** dir — especially since a concurrently-finishing run bumps its dir mtime above your just-created one (the dir NAME timestamp is set at script start via `date`, but mtime tracks the last file written inside).

Reliable ways to get YOUR run dir:
- Reviewer A (`compose-and-run.sh`) / clarity (`run-clarity.sh`) both print `>>> output → <RUN_DIR>` early in their stdout. Grep the background job's own output file for `output → \S+` — that's authoritative.
- The clarity run dir name embeds the reviewed head SHA (`pr-pr<N>-<headsha>-<bundlehash>-<pid>-<ts>`), so it's self-disambiguating; Reviewer A's is just `pr-<ts>` (no head), so it's the ambiguous one.
- Extra sanity check: `grep -q LLVM_USE_HOST_TOOLS <dir>/pr-diff.reference` (or any token unique to the head under review) to confirm the dir reviewed the diff you expect.

Cost me a couple of steps on a round-2 review when `ls -dt` grabbed a stale run that already had `final-review.md`/`combined-review.md`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md`_
