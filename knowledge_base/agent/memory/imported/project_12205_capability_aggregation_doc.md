---
name: project_12205_capability_aggregation_doc
description: "slang#12205 docs request — end-to-end capability-requirement aggregation design doc; PARKED for maintainer authorship"
metadata: 
  node_type: memory
  type: project
  originSessionId: bfd5b5f6-78bb-4346-a88b-8d0c0bdf5c73
---

**shader-slang/slang#12205** — "Document end-to-end capability requirement aggregation". Filed 2026-07-23 by maintainer **jhelferty-nv** ("Dev Opened"). Docs/architectural-reference request, **not a bug**. Triaged: documentation / low / **P3** / capability subsystem (docs). Triage verdict posted comment 5061817606.

Request: a NEW maintained design section tying together all capability-requirement producers→consumers (8 numbered topics + two-flow diagram). Triager Approach A = new hand-maintained `docs/design/capability-aggregation.md`, indexed in design README, cross-linked from user-guide/05-capabilities.md; leave the two AUTO-GENERATED design docs untouched. Source-verified memo @ HEAD e438c5aef maps all 8 topics to functions/reps (`SemanticsDeclCapabilityVisitor`→`Decl::inferredCapabilityRequirements`; `validateEntryPoint`+`collectGenericStructTypeUses`; `EntryPointUsesUnavailableCapability`/`ProfileImplicitlyUpgraded(Restrictive)`; late IR `processLateRequireCapabilityInsts` post link/spec/DCE). Memo: triage-12205.md.

**DECISION 07-23: PARKED for maintainer authorship + standing bot-draft offer.** Reference-of-record on an in-flux subsystem the maintainer opened and is the natural author for. I initially dispatched slang-fixer (MODE=docs) then **stood the fixer down** on triager's steer. GitHub carries the offer: bot has source-verified scaffold, will draft on request. **RELEASE = jhelferty-nv (or operator) says "draft it"** → re-dispatch slang-fixer with the memo (Approach A, DRAFT PR, hold for maintainer review). Motivating impl: #12194 (bot PR, fixes #10584). See [[feedback_dont_close_open_proposals]], [[feedback_reopen_not_release_parked_feature]].
