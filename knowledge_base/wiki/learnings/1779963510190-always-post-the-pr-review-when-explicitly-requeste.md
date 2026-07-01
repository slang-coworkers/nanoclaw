---
title: "Always post the PR review when explicitly requested via webhook (overrides /slang-pr-review read-only default)"
type: learning
topic: slang-compiler
source: learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md
---

# Always post the PR review when explicitly requested via webhook (overrides /slang-pr-review read-only default)

## Context

The `/slang-pr-review` workflow has a strong read-only invariant: "Reviewer never writes to GitHub. All output via `send_file` + `send_message`." `summarize.py` even counts GitHub-write tool attempts as drift signal. This is a safety net to keep an experimental reviewer from spamming PRs.

## The override

When a PR review is **explicitly requested via webhook** — e.g. an author or maintainer typed `@nv-slang-bot review` on the PR and the request reached the slang-reviewer through the github-webhook routing path — the read-only default does not apply. The webhook intent IS to post a review on the PR; running silently and only sending the file to parent fails the requester.

**Policy (set by dashboard-admin, 2026-05-28):** always post the review when explicitly requested. Don't gate on the read-only invariant — that invariant is the unattended/scheduled-default behavior, not the response to an explicit ask.

## Mechanics

slang-reviewer itself does not have GitHub-write tools (the workflow's tool allowlist excludes them, and `summarize.py` flags any attempt). So "post" means: route the final-review.md to a coworker that holds `pull_requests: write` on the target repo. In the slang coworker pool, that is typically **`slang-triage`** (or whichever sibling has write rights under the `nv-slang-bot[bot]` token) — verify per pool topology, since composition changes over time.

Forward the file via `send_file` so the poster can read it from their inbox; the reviewer's own inbox path is not visible to siblings.

**Post verbatim.** The review is already structured for GitHub rendering (`<details>` summary, inline comment headers with `file:line` anchors). Reviewer A's editorial pass already pruned redundant flags before publishing. Rewording risks weakening convergence-backed findings.

## When read-only still applies

- A/B-testing local prompt changes (`REVIEW.md`, `.claude/agents/*.md`) — never push from the coworker's checkout.
- Patch mode (`--mode patch`) — there's no PR to post to.
- Branch mode without an open PR — same reason.
- Scheduled / cron / unattended runs that weren't requested — the original safety case.

## Trace

PR #11209 (shader-slang/slang) — `@nv-slang-bot review` from szihs. Reviewer initially defaulted to read-only and only sent the file to parent. Dashboard admin clarified policy mid-flight.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md`_
