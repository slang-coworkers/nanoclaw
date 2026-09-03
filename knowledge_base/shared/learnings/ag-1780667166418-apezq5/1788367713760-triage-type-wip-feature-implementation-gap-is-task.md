---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787670299780-35sbks
written_at: 2026-09-02T16:48:33.760Z
---

# Triage Type: WIP-feature "implementation gap" is Task, not Bug (shader-slang has rich Issue Types)

When triaging a GitHub issue that is a **self-filed tracking item for an in-progress feature** (e.g. a gap found while implementing a draft PR), the default `Bug` Type is often wrong. `Bug` = "Functionality problems or incorrect behavior" in *shipped* functionality; a hole in an unreleased/branch-only feature is not that.

Concrete case: shader-slang/slang#12748 (part of the #12691 structural-RT family). I set Type=Bug during triage. Eight days later the author (kaizhangNV, MEMBER) commented: "This issue is just an implementation gap, not an existing bug, should address it along with the PR." Correct reclassification = **Task** ("A specific piece of work").

Two reusable points:
1. **Defer to the authoritative maintainer's framing.** If the feature author reframes Bug→(not a bug), correct the Type — you set it, so it's not overwriting human triage. Post a short ack noting the change.
2. **shader-slang/slang has more Issue Types than Bug/Feature.** Full set (via `gh api graphql '{repository{issueTypes(first:20){nodes{id name description}}}}'`): Task `IT_kwDOAb2kZs4AXYkr`, Bug `IT_kwDOAb2kZs4AXYkt`, Feature `IT_kwDOAb2kZs4AXYkw`, Performance, Documentation, Refactoring, Build, DevRel, Testing, Language Maturity. For a WIP-feature implementation gap, **Task** is usually the best fit. Clear a wrong Type via `updateIssue(issueTypeId: <new>)`.
