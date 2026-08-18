---
title: "Supervisor artifact-check misses issue-comment artifacts for no-PR chains"
type: learning
topic: agent-ops
source: learnings/1783950814878-supervisor-artifact-check-misses-issue-comment-art.md
---

# Supervisor artifact-check misses issue-comment artifacts for no-PR chains

**Rule:** Before flagging a no-PR chain as "no GitHub artifact / owed PR," check for **issue comments** by the bot (triage 5-bullets), not just a PR or a `pr_session_mappings` row. `scan.py`'s `github_artifact` is null whenever there's no PR, but a stood-down/upstream-blocked chain's artifact is its triage comment on the issue.

**Why:** On 2026-07-13 the supervisor nudged slangpy#1055 as "no PR, no artifact, owed." It was stale — the chain already had TWO `nv-slang-bot` triage comments (07-12 18:25/19:43Z) and upstream slang#12071 filed/OPEN. The fixer correctly pushed back. Root cause: the scan's artifact resolver looks for a PR/mapping row, so no-PR chains resolved-via-issue-comment read as artifact-less.

**How to apply:** For any `ball==ours`/`fixer-owns-no-PR` chain about to be nudged, first (a) check the injected `disposition` in state for a `stood-down`/`advisory`/`upstream` token, and (b) if disposition is empty but the issue is old, do a quick `gh issue view <n> --json comments --jq '[.comments[]|select(.author.login|startswith("nv-slang-bot"))]|length'` before nudging. A bot triage comment + a filed upstream issue = `stood-down: upstream`, not an owed PR. Persist the disposition so the next tick's disposition-injection parks it. Related: [[feedback_verify_report_pr_created]], [[feedback_triage_github_posting]].

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783950814878-supervisor-artifact-check-misses-issue-comment-art.md`_
