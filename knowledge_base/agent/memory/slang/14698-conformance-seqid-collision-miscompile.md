---
type: chain
title: "#14698 conformance sequential-ID collision miscompile — triaged, fixer live (11-23)"
description: Silent miscompile from explicit-vs-auto type-conformance sequential ID collision; triage chain complete, fixer porting PR #10797 approach as a fresh draft PR
---

# #14698 — conformance seq-ID collision (createDynamicObject wrong type)

Filed 2026-11-23 by tdavidovicNV (external NVIDIA user; fresh carve-out of umbrella #6924
because #6924 got no triage pickup). Chain: triager → fixer, canonical thread
`gh-issue-shader-slang/slang-14698`.

## Status (11-23, EVENING — triage side CLOSED, chain parked on maintainer review)

- **Fixed as draft PR #14699** (head 03c901283 after 2 review rounds, 8 commits, draft,
  mergeable, `pr: breaking change`; #10797 semantics + review hardening: loud out-of-range
  override rejection on API and CLI). Fixes #14698 + #6924 — both close on merge. No ISession
  change (include/slang.h comment-only in #10797, verified from diff; bot reviews there were
  wrong). pr-mappings row → fixer session sess-1795443507792-ns2jm9.
- **Triage Resolution posted** (triager final delta comment 7111368756): verdict "fix in draft
  PR #14699, held pending maintainer review". Four unresolved findings shipped-as-listed and
  documented (serialization round-trip test = maintainer follow-up, naming ask declined with
  Reviewer C concurrence, Devin advisories unreproduced, obfuscated-linkage key split = known
  limitation). Two REQUEST_CHANGES rounds fully applied; no third per two-round budget.
- **Tests:** repro 0/11 → 11/11 incl. GPU vk/cuda; unit 733/733; full suite 16285/16316,
  residuals A/B-identical on pure master.
- **Issue thread:** triage disposition 7103804997; author exchange (jhelferty-nv joke at
  saipraveenb25, corrected by triager delta 7106955045 and by tdavidovicNV himself in
  7108942921 — re-hit the bug that day, 2h chase, fully silent now, severity validated).
- **Parked:** one-shot re-chase `rechase-slang-14698-r1` scheduled 2026-11-30T19:30Z (cap 3,
  task-hygiene gate owns the series). PR events route to the fixer via pr-mappings; ready-flip
  goes on the weekly operator list, no per-PR ask. Explanation comment answering kaizhangNV's
  three #10797 questions: PR comment 7106762042; CI run 45211657521.
- Repro artifacts in `/workspace/agent/14698-work/` (caseA/B/Dup.hlsl, caseB.spvasm, driver).
  Triage memo: inbox of msg 22, `triage-14698.md`.

## Mechanism (verified on ToT f0b143178)

Explicit conformance IDs only become an `IRSequentialIDDecoration` and never enter the
Linkage ID maps (`slang-lower-to-ir.cpp:16122`); `ensureWitnessTableSequentialIDs`
(slang-ir-lower-dynamic-dispatch-insts.cpp:1046/:1084) skips decorated tables while its
per-interface counter starts at 0 → auto IDs collide with explicit ones;
`lowerGetTagFromSequentialID` `mapping[inputId]=outputId` (:928) = silent last-wins miscompile.
`ISession::getTypeConformanceWitnessSequentialID` (slang-session.cpp:940) allocates from the
same counter, so the API reports IDs contradicting the compiled shader. Duplicate explicit IDs
accepted silently. All author cases (A/B1/B2, dup-explicit, query-API disagreement) reproduced
via host-callable driver + emitted-HLSL switch inspection.

## Fix route

Revive PR #10797 (saipraveenb25, draft since 2026-04-21, `pr: breaking change`, dirty vs master,
dormant author) as a **fresh rebased draft PR on the bot fork** — never push to saipraveenb25's
fork — with `Fixes #14698` + `Fixes #6924`, crediting #10797 as the approach origin.

**Open contradiction flagged to the fixer (msg 33):** triager says include/slang.h in #10797 is
comment-only (ABI concern refuted); the PR's bot reviews allege a mid-vtable virtual insert
(`getOrAllocTypeConformanceWitnessSequentialID`). Fixer must verify from the diff (head 27d4fb4)
and place any public virtual per public-header policy (append/versioned interface), not mirror.

## Relations

- **#6924** — same-author umbrella tracker; fix PR must carry both Fixes links. Its TESTCASE 2
  (associated-type IGeometry composition) is NOT restated in #14698.
- **#11266** — sibling, not duplicate (unconditional duplicate (T,I) entry breaking is/as tags;
  maintainer-reproduced by skiminki-nv 2026-06-03, repro in draft PR #11428); #10797 likely
  fixes it only partially.
- **#14177** (closed 11-02) — adjacent consumer bug.

## Discrepancies noted

- ~~"Issue Type Bug" label~~ **CORRECTED 11-23 (msg 34):** Issue Type Bug IS set — it lives in the
  GitHub issueTypes field, which REST `labels` does not surface; the triager's GraphQL
  `node(id)` read (issueType id IT_kwDOAb2kZs4AXYkt = Bug) is authoritative. My REST check was
  the wrong instrument. Lesson: verify issue types via GraphQL, not the labels array.
- Triage comment was PATCHed in place post-amendment (original 14:18:41Z crossed my check);
  live version = corrected disposition. ABI contradiction resolved from the #10797 diff:
  include/slang.h is comment-only, no virtual added, vtable untouched (bot reviews there
  were wrong/stale).
- Fixer handoff (msg 20/28) crossed with my msg 27 direction mid-turn — superseding amendment
  sent by the triager (A = nudge-only, implement B) and advisory re-sent directly by me (msg 33,
  now moot in its conditional branch).
