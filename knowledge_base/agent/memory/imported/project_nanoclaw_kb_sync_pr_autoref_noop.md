---
name: project_nanoclaw_kb_sync_pr_autoref_noop
description: Nightly kb-sync/kb-wiki-fold PRs in slang-coworkers/nanoclaw self-merge in seconds and have no applicable approver — no-op the pr_ready_for_review webhook. Match on title+author+base, never head branch.
metadata:
  node_type: memory
  type: project
  originSessionId: 658467b7-46b7-4128-8fe6-ddbb7ee43e48
---

# Nightly kb-sync PR is a no-op

The `slang-coworkers/nanoclaw` repo emits a nightly automated PR — title
`knowledge_base sync <date>` (or the `/learnings-wiki` variant, title suffix
`: wiki-synth fold`), author `nv-slang-bot`, base `nv-coworkers` — an automated,
PII-scrubbed snapshot of coworker memory + learnings. It **auto-merges within
~2–23 s of opening** (observed 2s at #1073, 23s at #1148).

## The rule: do not route it

A `github.pr_ready_for_review` webhook for this PR arrives with the generic task
"route to the `*-pr-approver`". **No-op it.** Three reasons:

- It is already `state: closed` / `merged` by the time the webhook lands (bot self-merge).
- The nanoclaw repo has **no `*-pr-approver` coworker** — only `slang-pr-approver` /
  `slangpy-pr-approver` exist, scoped to their own repos ([[project_nanoclaw_pr874_webhook_route_approver]]).
- It is a data-only snapshot, not code.

**Match on title + author + base, NOT on head branch.** The head branch varies by
which nightly job produced it (`kb-sync-<yyyymmdd>`, `kb-wiki-fold-<yyyymmdd>`); a
head-branch-keyed rule silently fails to recognize the class on a new variant.
**Verify `merged` state first** — if a future kb-sync PR ever lands *unmerged*,
re-evaluate. Related: [[feedback_webhook_dispatch_by_event]].

## Gotchas when auditing one (if ever asked to)

The store **publishes its own PII-scan prose**, so a scan re-finds what the last
scan reported (`jane.doe@example.com`, `/Users/`, `/home/ubuntu`, `0.0.0.0:10254`
all resolve to this file's own published copy). ⇒ **Classify PII per-file, not
per-string**: a hit inside a memory leaf about scanning is self-reference; a real
leak hiding among self-quotations reads as "already explained". Family:
[[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]].

**"Data-only" is enforced by nothing** — the tree has carried executable scripts
and mode-`100755` files (memory-store tooling published *into* the KB). Extension
census answers provenance; the right exposure question is **"can anything RUN it?"**
— i.e. does any `.github/workflows/*` reference `knowledge_base` (measured 0, so the
tree is inert to CI). Full derivation + the STEP-4b staged-mode / STEP-6b
body-discipline gates: [[feedback_a_data_only_tree_is_enforced_by_nothing]],
[[feedback_a_directory_mtime_is_not_a_creation_time]].

**A PR body is mutable; the webhook payload is a snapshot.** #1156's body was edited
108s after the webhook fired, so a subagent reading the live body and I reading the
payload quoted different versions of one field and it looked like a contradiction.
⇒ **Re-fetch the body before adjudicating any disagreement about it.**

Diff-completeness assertions that caught real gaps (each now lives in its own
concept): assert `listed == changedFiles` (census) AND `added-content-lines ==
additions` (body) — they truncate independently; assert `sum(per-file .additions)
== reported additions` (catches a short file listing); `status: added` with `+0/−0`
is arithmetically impossible = missing per-file stats, so fetch those files whole;
the code-detector needs a **shebang-keyed pass unioned with the extension-keyed one**
(neither alone is sufficient). See
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].

## Confirmed instances (each verified `merged` before no-op)

| PR | date | open→merge | files | +/− |
|----|------|-----------|-------|-----|
| #1063 | 2026-08-04 (`kb-wiki-fold`) | 3s | — | — |
| #1070 | 2026-08-05 | 13s | 538 | +34786/−938 |
| #1073 | 2026-08-05 (`kb-wiki-fold`) | 2s (fastest) | 909 | +46093/−2458 |
| #1142 | 2026-08-07 | 13s | 629 | +40659/−1655 |
| #1146 | 2026-08-08 | 18s | 364 | +20011/−1817 (first with executable scripts) |
| #1148 | 2026-08-09 | 23s (slowest) | 278 | +14921/−1205 (first additions-sum mismatch = missing stats) |
| #1156 | 2026-08-10 | 13s | 160 | +17658/−994 |

All instances: 100% under `knowledge_base/`, non-bot real emails **0**, all secret
matchers **0**. The scrub holds per instance — re-check per instance rather than
trusting the body text.
