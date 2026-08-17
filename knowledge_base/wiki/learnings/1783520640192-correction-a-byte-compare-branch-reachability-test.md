---
title: "CORRECTION: a byte-compare / branch-reachability test only proves a mechanism when run in the environment where the changed branch can fire (slang #11952 re-open)"
type: learning
topic: slang-compiler
source: learnings/1783520640192-correction-a-byte-compare-branch-reachability-test.md
---

# CORRECTION: a byte-compare / branch-reachability test only proves a mechanism when run in the environment where the changed branch can fire (slang #11952 re-open)

**Correcting an earlier learning of mine** ("Perf regression bisected to a fix ≠ the fix's logic is the cost — byte-compare serialized artifacts to distinguish semantic vs LTO-layout"). The TECHNIQUE is sound but I MISAPPLIED it on slang #11952 and reached a wrong "layout artifact, no fix" verdict. The human reporter corrected us.

**What went wrong:** #11921's only runtime change is a branch in `Path::getRelativePath` that fires ONLY when `std::filesystem::relative` returns empty — i.e. when the two paths have **no relative path between them** (different root names: Windows cross-drive `C:` vs `D:`/`W:`, or mixed absolute/relative). I byte-compared the produced `.slang-module` on **Linux, single filesystem**, where inputs always share a root, so that branch is **physically unreachable**. Identical bytes there proved the branch inert *in an environment where it can never run* — not that it's inert on the runner. The actual perf runner checks out to `W:` with temp on `C:` (genuine cross-drive), where the branch DOES fire and changes the stored dependency path (empty → absolute), which then changes per-import load work.

**The rule:** before concluding "this changed branch has no effect" from a diff/byte/repro test, ask **"is the changed branch even REACHABLE in the environment I'm testing?"** Platform- or condition-gated branches (cross-drive, Windows-only, GPU-only, big-endian, locale, filesystem-type) must be tested in the matching environment, or statically traced for what input actually triggers them. A green result in the wrong environment is a false negative, not evidence.

**Corroborating signal I under-weighted:** the reporter's per-phase timers put the cost in `SemanticChecking`, not the deserialization timers. That was true and diagnostic — `isBinaryModuleUpToDate` (the serialized-module freshness check) runs *inside import handling during semantic checking* (slang-session.cpp: loadBinaryModuleImpl→loadModuleImpl called from import), so per-import path work shows up under SemanticChecking. When a reporter gives phase-resolved data that contradicts your mechanism, trust their measurement over your single-environment repro and find the environment/condition that reconciles them.

**Also:** when a human bisects/localizes a regression to a specific PR + phase with clean methodology, treat it as strong evidence and reconcile your model to it — don't let a prior bot "resolved" position stand against new human data (per the spine's "substantive human comment re-opens a closed chain").

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783520640192-correction-a-byte-compare-branch-reachability-test.md`_
