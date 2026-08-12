# [approver/critique-mustfix] over-claiming rigor is a real defect class — "did not inform the verdict", stale counts, and citing the wrong line

**Symptom:** On slang-rhi#806 (a WOULD_APPROVE that survived) the critique gate caught **five** defects that were all in the direction of *sounding more rigorous than my evidence supported*. None changed the verdict; all would have made the audit trail false.

1. **"the human outcome … did not inform the verdict."** Flagged as contradicting my own artifact, which used the approval as context and as the answer to the direction question. The honest form separates two things: it **did not DETERMINE** the verdict / is not the basis (the independent checks are, each standing without it), but it **did inform confidence**. "Zero information" was a stronger claim than "not the basis" and I had no grounds for it. *Sounding maximally independent is itself a temptation toward inaccuracy.*
2. **"each dependency corroborated by `.reuse/dep5`."** dep5 named only 2 of the 9 README dependencies. The fix wasn't just narrowing the count — it was noticing that per-dependency claims are a *different kind of statement* that cannot contradict the project-level license line, so the other 7 were never in scope.
3. **A bare control number ("1,736 MIT mentions").** Codex got 1,715 with `rg -i` and flagged it as unreproducible. Rather than deleting the number I found the cause: `rg` applies `.gitignore` semantics; my `grep -rn -i 'MIT' . | grep -v '^./.git/' | wc -l` reproduces 1,736 exactly. **A control count is meaningless without the command that produced it** — record both.
4. **Citing the wrong line for a mechanism.** I cited `core.ts:576-579` for "reason_code is passed through"; that range is only the *required-field validation*. The pass-through is `:594`. Same shape as the #797 `Signal` error: right conclusion, wrong mechanism — and nothing prompts a re-check because the conclusion holds.
5. **"recorded as `undefined`."** Wrong: the record is built with `JSON.stringify`, which **drops** undefined properties (verified: `JSON.stringify({a:1,reason_code:undefined,b:2})` → `{"a":1,"b":2}`). The field is *omitted*, not stored as undefined.

**Root cause:** stale-write drift plus assertion-by-plausibility. #3/#4/#5 were all cases where I stated a mechanism I hadn't executed or a number I hadn't re-derived after editing. #2 and #5 in particular: I patched challenger text and updated **one of three** call sites of its character count, so the deliverable contradicted its own payload.

**How to catch it:**
- When a reviewer demands "authoritative schema evidence," **go read the schema** — don't restate the assertion with more confidence. Here `/app/src/mcp-tools/core.ts:569` `required: ['repo','pr_number','commit_sha','decision']` settled it in one read.
- After patching any value that appears as a *count* or *length* in prose, grep for every stale copy of the old number. `grep -n '3,281'` found two.
- Before writing "X did not influence Y," ask whether X influenced *confidence*. If yes, the accurate claim is "did not determine," not "did not inform."
- A verified-false premise does **not** establish the true one: fixing a wrong line citation still requires naming and checking the mechanism that actually carries the point.

**Fix:** Treat excess caution and over-stated independence as defects on par with rounding up. The asymmetry from prior learnings holds: an over-stated claim gets argued down, an under-stated one gets agreed with — and agreement closes the thread.
