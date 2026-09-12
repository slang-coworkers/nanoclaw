---
title: "Rebind PR-review artifacts by diff_hash, not head — a clean rebase can leave the diff byte-identical"
type: learning
topic: review-process
source: learnings/1789183793058-rebind-pr-review-artifacts-by-diff-hash-not-head-a.md
---

# Rebind PR-review artifacts by diff_hash, not head — a clean rebase can leave the diff byte-identical

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787247708074-zg96zf
written_at: 2026-09-12T03:29:53.058Z
---

# Rebind PR-review artifacts by diff_hash, not head — a clean rebase can leave the diff byte-identical

When a fix-review request is re-dispatched after a rebase, do NOT decide "stale vs reusable" by head commit alone.

- The PR's own `gh pr diff` output (and its sha256) is what the reviewers actually consume. A rebase that applies cleanly over an *unrelated* change to the same file (here #12685 touched a different region of `slang-ir-glsl-legalize.cpp`) leaves the PR's hunks and context lines unchanged → the unified diff is **byte-identical** across the rebase. The head commit changes (1296bcf → c72356154a) but sha256(diff) stays `462b33d5…`.
- So: compute `gh pr diff <n> -R <repo> | sha256sum` and compare against each run's `pr-diff.reference` sha / the diff_hash embedded in the clarity run-dir name (`pr-pr<N>-<head>-<diffhash12>-…`). Rebind by **diff_hash**, not head. A head-based salvage check will wrongly discard a still-valid run.
- Reviewer C (clarity) and Devin key differently: clarity is diff-content-bound (byte-identical diff ⇒ reusable); Devin keys on head commit and auto-re-analyzes per head, so re-run Devin after a head change even if the diff is identical.
- Transcripts dirs (`slang-pr-review-runner/transcripts`, `slang-clarity-review-runner/transcripts`) are shared across ALL PRs and get reused/aged over a long-lived session. Never assume a prior run's dir survives; list current dirs and match by the diff_hash in the name.

Operational gotchas confirmed this session:
- `gh auth status` printing "token is invalid" is the App-token quirk — the real `gh pr view/diff` ops still work. Try the real op before declaring an outage.
- Reviewer A's `compose-and-run.sh` occasionally dies with `API Error: 400 Invalid JSON payload: unexpected end of data` + `REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches` — this is transient (not diff-size; the diff was 4.7KB). Retry once.
- Dispatch the runners via the harness `Bash(run_in_background=true)`, NOT manual `nohup … &` — a nohup child produced a 0-byte log and vanished, while run_in_background gives reliable completion notifications.
- `run-clarity.sh` takes flags directly (`--mode pr --pr N --repo …`); do NOT pass the skill-subcommand token `run-clarity` as a positional arg (→ `error: unknown flag run-clarity`).

Review-content note: a pure-`out` param direct-write optimization that does `localVariable->replaceUsesWith(outputGlobal)` re-roots **reads** as well as writes; it's sound only because a pure `out` carries no defined incoming value (exactly why `in out` must keep its copy-in). Both Reviewer A and clarity C001 flagged that this soundness invariant should live in a code comment, not just the PR body.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789183793058-rebind-pr-review-artifacts-by-diff-hash-not-head-a.md`_
