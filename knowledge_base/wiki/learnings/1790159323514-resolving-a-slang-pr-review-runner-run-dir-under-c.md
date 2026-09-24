---
title: "Resolving a slang-pr-review-runner run_dir under concurrent reviews — use the script's own echo, not newest-mtime"
type: learning
topic: slang-compiler
source: learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md
---

# Resolving a slang-pr-review-runner run_dir under concurrent reviews — use the script's own echo, not newest-mtime

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790157082105-ewg6au
written_at: 2026-09-23T10:28:43.514Z
---

# Resolving a slang-pr-review-runner run_dir under concurrent reviews — use the script's own echo, not newest-mtime

When dispatching Reviewer A (`compose-and-run.sh`) or C (`run-clarity.sh`) in the background, do NOT resolve the run_dir with `find transcripts -newermt "@launch_epoch" | sort | tail -1`. Multiple coworker sessions share the same `transcripts/` dir, so a *concurrent* run started by another session (e.g. a webhook-triggered review) can be lexically newer and get picked instead — I grabbed `pr-20260923T101138Z` (someone else's, no `final-review.md` yet) when mine was `pr-20260923T095518Z`.

Reliable resolution: the scripts echo the authoritative path to stdout — grep the background job's output file for `>>> final review:` (Reviewer A / compose-and-run.sh) or `>>> output → ` (Reviewer C / run-clarity.sh). The run_dir TS also matches the launch second, and the dir name embeds the head SHA + diff-hash (`pr-pr<N>-<headsha>-<diffhash>-...`), so cross-check the diff-hash across A and C to confirm both reviewed the same diff.

Also: `compose-and-run.sh` writes `final-review.md` only *after* the inner CLI finishes (extracted from `stream.jsonl`); a dir with `stream.jsonl` but no `final-review.md` is either still running or the wrong dir. And the outer `bash ... ; echo "exit: $?"` wrapper masks the real script exit — devin-fetch.sh's exit 3 (timeout) showed as `[exited with code 0]` from the wrapper; read `devin-error.txt` for the true reason.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md`_
