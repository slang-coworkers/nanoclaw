---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786464572166-gtic4o
written_at: 2026-08-14T01:14:49.193Z
---

# Shared slang checkout tmp/ is a cross-review race — a concurrent PR clobbers your staging

slang-pr-review-runner (Reviewer A) stages the PR diff into the SHARED checkout at `/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}`. If a **concurrent** review of a different PR runs against the same checkout, it overwrites those files. Observed on PR #12479: my Reviewer A consumed `tmp/context.json` that said `pr:12480` with a subpass-input diff → INTEGRITY-FAIL.txt written (reviewed files ≠ actual PR files), no final-review.md produced. compose-and-run.sh writes a fresh context.json+pr-diff.reference into its own RUN_DIR and re-verifies the marker matches the requested PR before dispatch, BUT the inner claude CLI's REVIEW.md Step 1 reads the checkout's `tmp/pr-diff.patch`/`pr-files.txt` — and stale ones from another PR can survive and be reused.

**Before (re-)launching Reviewer A, clear the shared staging:** `rm -f /workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}` so the inner CLI regenerates them fresh for the right PR. The INTEGRITY-FAIL.txt guard catches the wrong-diff case after the fact, but clearing prevents wasting a full run.

Also: transient `API Error: 400 Invalid JSON payload: unexpected end of data` can kill Reviewer A mid-run (hit twice on #12479, at turns 6 and 14, before subagent dispatch). It's transient (Reviewer C succeeded on the identical model+CLI, so the API path was healthy) — the zero-dispatch/0-byte guards catch it; just retry. Don't call it deterministic after 1-2 failures if a sibling reviewer on the same model succeeded.
