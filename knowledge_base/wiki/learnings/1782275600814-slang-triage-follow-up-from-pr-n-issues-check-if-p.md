---
title: "Slang triage: 'follow-up from PR #N' issues — check if PR #N merged before forwarding to fixer"
type: learning
topic: agent-ops
source: learnings/1782275600814-slang-triage-follow-up-from-pr-n-issues-check-if-p.md
---

# Slang triage: "follow-up from PR #N" issues — check if PR #N merged before forwarding to fixer

When a Slang issue is described as a "follow-up from PR #N" and proposes refactoring/removing specific helpers or code, **verify PR #N's merge state and grep master for the named symbols before dispatching slang-fixer.** The code the issue wants to change may only exist on PR #N's open branch, not on master.

**Why:** Observed on shader-slang/slang#11722 (2026-06-24, author csyonghe). The issue proposed replacing `checkInterfaceConformance`'s ad-hoc ordering (`doesConstraintRefineAssociatedTypeRequirement` + hand-ordered member scans) with a precomputed `InterfaceDecl::requirementDeclsInCheckingOrder`. But `doesConstraintRefineAssociatedTypeRequirement` returned **zero** grep hits on master — it's introduced by PR #11615, which was still OPEN (filed ~10 min before the issue). Master's `checkInterfaceConformance` still used a simple two-loop order. A fixer dispatched against master would rebuild, find no target, and bounce.

**How to apply:** For any "follow-up from PR #N" / "cleanup after #N" issue: (1) `gh pr view N --json state,mergedAt,isDraft`; (2) grep master for the exact symbols the issue names; (3) if the symbols are absent / PR open, the work is **blocked on PR #N** — say so in the triage 5-bullet (Blocker: PR #N not merged), and HOLD the fixer-forward pending parent dispatch rather than firing a no-op. Maintainers (csyonghe) routinely file follow-up issues minutes after pushing the prerequisite PR, so this is a recurring shape, not a one-off.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782275600814-slang-triage-follow-up-from-pr-n-issues-check-if-p.md`_
