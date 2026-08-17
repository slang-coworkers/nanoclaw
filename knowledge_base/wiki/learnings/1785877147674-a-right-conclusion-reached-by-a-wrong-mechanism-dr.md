---
title: "A right conclusion reached by a wrong mechanism draws no pushback — separate them with a two-sided control"
type: learning
topic: agent-ops
source: learnings/1785877147674-a-right-conclusion-reached-by-a-wrong-mechanism-dr.md
---

# A right conclusion reached by a wrong mechanism draws no pushback — separate them with a two-sided control

When a conclusion and the reason given for it happen to agree, **nothing in normal review will ever separate them.** Tests pass, reviewers nod, the claim ships. Only an instrument aimed at the mechanism itself discriminates.

Three instances on one PR chain (shader-slang/slang#12348, CFG block-merge hang):

1. **I withdrew a bad assert predicate for the wrong reason.** I proposed `SLANG_ASSERT(successor->getFirstDecorationOrChild() == nullptr)`, then withdrew it because "decorations are legitimately present." Correct conclusion, wrong mechanism — the actual tripwire is **leftover params**: the param-only walk calls `replaceUsesWith` and never removes params; they're freed only when `removeAndDeallocate` recurses into children (`slang-ir.cpp:9380-9392`). The fixer's **two-sided control** found it: assert present → `slang-bootstrap -compile-core-module` throws `InternalError`; assert removed → 65/65 clean on the same tree; then instrumented to see 6 leftover children, all `param`, all `hasUses=0`. My withdrawal was right by luck. `!successor->getFirstOrdinaryInst()` (`slang-ir.h:1260`) is the correct predicate — it skips exactly the decorations-and-params prefix.

2. **An inverted mechanism travelled with the authority of a correction.** A tier relayed "in master the same-parent guard fires so nothing hoists; the fix *introduces* the exposure." Inverted. The guard compares the **operand's** parent to the **item's**, and `_replaceInstUsesWith` repoints the use (`slang-ir.cpp:9064`) *before* `_addGlobalNumberingEntry` (`:9114`) reaches `tryHoistInst` — so in master the item is in `successor` while its operand is already in `block`: parents differ, hoist proceeds. The one-line disproof: **if nothing hoisted in master there would be no bug — the hang *is* those hoists.**

3. **`.base.sha` is not the merge-base.** It's the base-branch tip at fetch time. Same error class: a well-formed read of the wrong field.

**How to apply.**

- **Same probe, two builds, one variable.** To settle a master-vs-fix mechanism question, instrument the *mechanism site* (not the symptom) and build it twice, changing only the file under review. On #12348: a `fprintf` at the hoist site (`slang-ir-deduplicate.cpp:106-109`) gave master **4 hoists / exit 124** vs fix **1 hoist / exit 0** — the fix *suppresses* 3, opposite the relayed claim.
- **Demand a positive control on the identity of what you counted, not just the count.** "4 vs 1" could be anything. Decoding the op numbers positionally from `build/source/slang/fiddle/slang-ir-insts-enum.h.fiddle` (857 enumerators) showed the three suppressed ops were `LookupWitnessMethod`/`ExtractExistentialType`/`ExtractExistentialWitnessTable` — *exactly* the trio named as the hoistable users. That correspondence is what makes the count evidence.
- **Before accepting a relayed finding, check the relay for contamination.** I verified Reviewer A's `prompt.txt` contained **zero** matches for the contaminating dispatch language and never received the PR body at all — so its polarity was independently derived. Cheap check; converts "agrees with me" into "independent confirmation."
- **"Two reviewers couldn't construct a failure" is weak evidence of safety, near-worthless when the failure signature is remote.** For a stale-GVN-pointer bug read by a *later* pass, a same-session search wasn't aimed where it would show up. Say "we did not look for this where it would appear," not "we looked and found nothing."
- **Triage a nonzero drift/guard signal instead of explaining it.** A drift grep returned 1; the hit was the *prohibition text inside a subagent prompt*, not a call. Waving it through as "probably the prompt" would have been the same error class. One grep.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785877147674-a-right-conclusion-reached-by-a-wrong-mechanism-dr.md`_
