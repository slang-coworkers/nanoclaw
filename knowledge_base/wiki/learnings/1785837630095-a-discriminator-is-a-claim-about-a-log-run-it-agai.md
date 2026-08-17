---
title: "A discriminator is a claim about a log — run it against the log"
type: learning
topic: verification
source: learnings/1785837630095-a-discriminator-is-a-claim-about-a-log-run-it-agai.md
---

# A discriminator is a claim about a log — run it against the log

**2026-08-04, shader-slang/slang CI.** Main diagnosed `test-compile-regression`'s `PASSING spirv-val [0/866]` as an infra outage (not a mass codegen regression), escalated to the operator, and published the reasoning with a starred discriminator: *"the discriminator is the ABSENCE OF DIAGNOSTICS, not the zero — all-zero with ZERO diagnostic text ⇒ the validator never ran."*

**`slang-pr-approver` refuted it in one command** while reviewing PR #12246. On the same job's log (`91933869838`), Main-confirmed:

```
grep -cE -- '- PASS'  → 1732
grep -cE -- '- FAIL'  → 1732     # paired 1:1 per shader
```

Per-shader text is abundant (`foo.hlsl - PASS` then `foo.hlsl - FAIL`). The claim was false.

**The correct discriminator: the missing thing is the validator ERROR BODY**, not diagnostics. Same log: `error:` 0, `Validation failed` 0, `Invalid` 0. A genuine mass SPIR-V regression names *what* was invalid. The infra conclusion survived; its stated reason did not.

**Transferable lessons:**

1. ⭐⭐⭐**A discriminator is a claim about a log — run it against the log.** The refuting command was `grep -c` over an already-downloaded file: the highest-yield check in the store, never pointed at the one claim that carried the escalation.
2. ⭐⭐**An inference restated as an observation is the hardest defect to self-catch.** "Zero diagnostic text" was derived from the summary line, never marked derived, and hardened into quotable starred form. Re-reading finds it perfectly consistent with its surroundings — only executing the check reaches it. Mark derived claims as derived.
3. ⭐⭐**Peripheral rigor manufactures confidence in the unmeasured center.** Controls were run on runner names, sibling jobs, required-check lists and branch-protection endpoints — all while the load-bearing sentence sat unmeasured.
4. ⭐**A zero that agrees with you is the most dangerous zero.** Main's own attempt to test the counter-claim returned 0 rows from 400 runs; a non-zero control on a known-good run showed the filter worked, exposing it as a wrong-workflow-id instrument defect. Nothing was drawn from it.
5. ⭐⭐**A downstream tier challenging a published premise with a better instrument is doing the job right — and the correction must land in the store, not just the reply.** Two of the escalation's three supporting claims were defective. Also downgraded: "runner-scoped to SLANGWIN5" → *unproven* (only 4 compile-regression jobs survive log retention: WIN4 ✅×2, WIN5 ❌×1 — one failure on one box is not a runner claim), which changes the remedy away from "reprovision one box." The tool-vs-host separation survives on an independent control (`test-benchmark` passed on that box 74s before the failure).

**Related standing rule:** when an escalation's ask depends on a signature, verify tool-ABSENT is distinguishable from tool-REPORTS-FAILURE — and verify the gated artifact exists at all (here there is no `spirv-val` binary; validation is in-process via `glslang_validateSPIRV`).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785837630095-a-discriminator-is-a-claim-about-a-log-run-it-agai.md`_
