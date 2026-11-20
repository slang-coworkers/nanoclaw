---
type: chain
title: slang#14537 — existential box dispatching a two-level inherited requirement aborts at slang-ir.cpp:9100
description: Bot-filed side-find from the #13996 fixer chain; deduped, reproduced; needs its own triage, fixer start gates on operator per filing policy
---

# slang#14537 — E99997 at slang-ir.cpp:9100, existential-box dispatch of a two-level inherited requirement

**Provenance (11-17 09:17Z):** BOT-filed by slang-fixer (session sess-1794890438284-ebme81, the
#13996 chain session) as an UNRELATED side-find discovered while testing PR #14534. Filed only
after an OUTPUT_REVIEW round caught and fixed two over-broad claims in the draft body. Do NOT
fold into the #13996/#14534 chain — it is a separate pre-existing master bug.

**Dedup (fixer, verified):** no match in #14237 / #14239 / #14240 (all autodiff-required
existential bugs) or #12873 (AndType conjunction) — the repro is a plain no-autodiff,
no-conjunction interface chain with a single generic application. Verified on clean master
818012112, cuda execution; minimal repro + one-level-up control in the issue body.

**Routing when `issue_opened` arrives (R6):** dispatch slang-triager normally for a fresh chain
(👀 + triage) — no existing chain owns it. Per filing policy, starting a NEW fixer chain still
goes to the operator; triage itself needs no go-ahead. Same pattern as #14535
(bot-filed side-find → triaged → parked on operator release for fixer start).

**Dispatched (11-17 09:3xZ):** 👀 posted on the issue; triager dispatched on the canonical thread
`gh-issue-shader-slang/slang-14537` with `<github-post-authorized />`. Live read at dispatch:
state open, no labels, no assignees, 0 comments.

**Triaged (11-17 09:50Z, receipts verified: cmt 6944545395 + `reproduced` label):** bug / high / P2 /
frontend witness representation. Reproduced at HEAD 2a91af5b7 on all GPU targets (Release segfaults,
not just assert). Root cause (triager's finding, 3 independent paths): facet merger emits a compressed
`DeclaredSubtypeWitness(IDerived→IRoot)`; method-call lookup stores it unnormalized → lowering emits
`lookupWitness(IBase.$inheritance)` against the flat S:IDerived table → miss → unguarded
`replaceUsesWith(nullptr)` at slang-ir-typeflow-specialize.cpp:5945. Recommended fix (A): normalize
super-type facet witness on the lookup path (slang-lookup.cpp:508-515, reuse
slang-check-conversion.cpp:3344). **Parked on OPERATOR for fixer start** (filing policy) — decision
named on orchestrator-dashboard 11-17; triager's one-shot recheck-14537-operator-g-a466 fires
2026-11-19 09:30Z. Triage memo (repro commands, acceptance criteria, fix design) preserved at
[raw/triage-14537.md](raw/triage-14537.md) — reference it in the fixer dispatch when the operator
green-lights.
