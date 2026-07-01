---
title: "#11545 ByteAddressBuffer-alignment cluster — ownership FLIPPED (jkwak delegated to bot; fork #250 closed)"
type: learning
topic: agent-ops
source: learnings/1781315736697-11545-byteaddressbuffer-alignment-cluster-ownershi.md
---

# #11545 ByteAddressBuffer-alignment cluster — ownership FLIPPED (jkwak delegated to bot; fork #250 closed)

**Correction to standing guidance.** Several prior learnings (e.g. `1781315409904-…4-slices-sli`, `1781133163629-…pow2-alignment-validation-must-fix-imp`) say "do NOT open a competing public PR over @jkwak-work's in-flight fork work (jkwak-work/slang#250)" for the #11545 ByteAddressBuffer LoadAligned/StoreAligned alignment redesign. **That concern is now DISCHARGED for the #11545 cluster (#11590/#11591/#11592).**

**Why (verified 2026-06-13, origin/master db002dbdf):**
- @jkwak-work explicitly delegated implementation to the bot on #11545: 06-11 "please open a PR to address the problems"; 06-12 "Can you make sub-issues for this and make PRs for each?"; 06-13 "Let's split into four issues." This is *invited* work, the inverse of the competing-PR hazard.
- His fork PR `jkwak-work/slang#250` ("Allow scalar alignment for byte-address buffer vector/matrix loads", head `issue-9958`) is now **CLOSED, unmerged** — no longer in-flight.

**How to apply:** For #11590/#11591/#11592 (and #11545 itself), proceed to draft PRs without the fork-coordination hold — but everything still stays **draft-held + operator-gated** (no `gh pr ready`, no issue/PR comments without operator auth). Re-confirm the maintainer hasn't self-fixed a given slice (`gh pr list --search "<issue#>"`) before building, per the silent-maintainer-self-fix learning.

**Sequencing caveat (not ownership):** Slice 3 (#11592) is only *partially* startable — its diagnostic half (41301 pow2 check + 41300 scalar-component relaxation) depends on Slice 1 (#11590)'s validation entry point, which has NO PR and is absent on master (41302/41303 undefined). The natural-alignment infra half (getNaturalAlignment IR op + `__naturalAlignmentOf<T>` intrinsic + peephole fold + 12 single-arg `*Aligned` forwarder switches) is fully independent and collision-free with Slice 1.

**Minor:** `slang-ir-insts-stable-names.lua` max number on master is **862** (memo said 861) → a new op takes **863**; always re-verify next-free at implement time (append-only, drifts).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781315736697-11545-byteaddressbuffer-alignment-cluster-ownershi.md`_
