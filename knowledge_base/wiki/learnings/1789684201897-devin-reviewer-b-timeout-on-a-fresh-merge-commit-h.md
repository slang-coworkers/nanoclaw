---
title: "Devin (Reviewer B) timeout on a fresh merge-commit head leaves stale devin-flags.md — don't cat it as fresh"
type: learning
topic: review-process
source: learnings/1789684201897-devin-reviewer-b-timeout-on-a-fresh-merge-commit-h.md
---

# Devin (Reviewer B) timeout on a fresh merge-commit head leaves stale devin-flags.md — don't cat it as fresh

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789680062326-r2h68j
written_at: 2026-09-17T22:30:01.897Z
---

# Devin (Reviewer B) timeout on a fresh merge-commit head leaves stale devin-flags.md — don't cat it as fresh

When `/slang-pr-review` runs Reviewer B (`devin-fetch.sh`) against a PR whose head is a **just-pushed merge commit**, Devin is often still re-analyzing that head, so the done-check polls the full 30m and exits with `devin-error.txt` = "timeout: Devin did not reach a stable done state within 30m" and `devin-commit-status.txt` = "unknown".

Trap: the `--out` dir may still contain a `devin-flags.md` / `devin-page.txt` / `devin-screenshot.png` from a **prior** analysis (spot it by an old file mtime — e.g. an Aug birth date on a Sep run). It reads as valid, PR-specific content, but it does NOT correspond to the reviewed head. The nohup wrapper's `echo "exited: $?"` can also mask the real non-zero exit as 0 in the task notification — trust `devin-error.txt` + `devin-commit-status.txt`, not the notification's exit code.

Correct handling (matches the workflow's timeout=exit-3 → Reviewer-B-skipped rule): in the combined report, mark Reviewer B `_skipped: Devin timed out … commit-status unknown_` and set `reviewers_complete=false`. Do NOT `cat` the stale devin-flags.md — presenting a prior commit's analysis as a fresh review of the current head is misleading. It's transient; a re-run once Devin settles usually captures it.

Bonus confirmation: on shader-slang/slang#12563 the shared-wiki recall hit predicted Reviewer A's exact top finding (recursion→SIGSEGV via eager `processFunction` re-entry; "only-set-when-Generic drops diagnostics") — the `slang-compiler-ir-type-legalization.md` concept page on the specialize-address-space pass is accurate and worth reading before reviewing anything touching that pass's diagnostic ownership.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789684201897-devin-reviewer-b-timeout-on-a-fresh-merge-commit-h.md`_
