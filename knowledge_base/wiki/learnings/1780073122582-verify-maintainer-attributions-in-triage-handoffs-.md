---
title: "Verify maintainer attributions in triage handoffs against gh PR data"
type: learning
topic: agent-ops
source: learnings/1780073122582-verify-maintainer-attributions-in-triage-handoffs-.md
---

# Verify maintainer attributions in triage handoffs against gh PR data

# Verify maintainer attributions in triage handoffs

## Rule

Before propagating a maintainer name from a triage handoff into a PR description, review request, or coordination plan, **verify with `gh pr view <num> --json author,mergedBy,reviews`**. On-issue `nv-slang-bot` triage comments have been observed asserting confident attributions (e.g. "PR #X by maintainer Y") that are wrong, and parent triages then propagate the error verbatim into downstream handoffs.

## Why

On slang issue #11339 (2026-05-29), an `nv-slang-bot` "Internal Triage Report" comment named **bmillsNV** as "author of recent CI/container hardening (PR #11274, PR #11302)". Both attributions were wrong:
- PR #11274 was actually authored by jkiviluoto-nv (merged 2026-05-25)
- PR #11302 was actually authored by jkwak-work / Jay Kwak (merged 2026-05-27 by jkiviluoto-nv)
- bmillsNV does not appear as author or merger of either, nor of #10016 (the original cleanup-step PR by kaizhangNV)

The parent fixer's triage handoff then propagated "bmillsNV" verbatim as the maintainer to coordinate with. The actual coordination target is **jkiviluoto-nv** — issue assignee, PR #11302 approver/merger, and most recent author touching the workflow file.

## How to apply

When a triage handoff names a maintainer for coordination:
1. `gh pr view <num> -R <owner>/<repo> --json author,mergedBy,reviewDecision,reviews` for each PR cited.
2. `gh issue view <num> --json assignees,author,comments` for the issue itself — the assignee is usually the right coordination target, regardless of what bot-triage prose claims.
3. If the handoff's named maintainer doesn't appear in any of those records, **flag the discrepancy in your plan/report** rather than silently substituting. Future plan readers benefit from seeing the propagation chain corrected explicitly.

This is cheap — one or two `gh` calls — and saves a bigger blast radius (tagging the wrong person on a PR, miscoordinating a security-sensitive change, surfacing maintainer-name errors only at PR-review time).

## Scope

Applies to any chain consuming triage handoffs that contain attribution claims. Not limited to slang. The `nv-slang-bot` triage comments specifically have shown the failure mode, but any LLM-authored triage that attributes PR authorship without a `gh` verification step is a candidate for the same kind of error.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780073122582-verify-maintainer-attributions-in-triage-handoffs-.md`_
