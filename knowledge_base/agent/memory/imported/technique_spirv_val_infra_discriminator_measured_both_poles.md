---
name: spirv-val-infra-discriminator-measured-both-poles
description: "The ONLY discriminator for the SLANGWIN5 SPIR-V validation outage is the split on the TWO spirv-val-suffixed PASSING lines; \"- FAIL\" counts and the plain mode lines discriminate NOTHING (1732 FAILs in the poisoned log, 866/866 plain in both poles)."
metadata: 
  node_type: memory
  type: technique
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**Measured directly from both poles 2026-08-05, not relayed.** Poisoned job `92023450909` (SLANGWIN5, occ6 2026-08-04); healthy control `91940624213` (SLANGWIN4, att3). Both logs still retained and fetchable via `gh api repos/shader-slang/slang/actions/jobs/<id>/logs`.

```
POISONED (WIN5)                                   HEALTHY (WIN4)
PASSING [ 866 / 866 ]                             PASSING [ 866 / 866 ]
PASSING spirv-val [ 0 / 866 ]                <--  PASSING spirv-val [ 866 / 866 ]
PASSING Non-Semantic Info [ 866 / 866 ]           PASSING Non-Semantic Info [ 866 / 866 ]
PASSING Non-Semantic Info spirv-val [ 0 / 866 ]  <-- ...spirv-val [ 866 / 866 ]
- PASS = 1732   - FAIL = 1732                     - PASS = 3464   - FAIL = 0
```

⭐⭐⭐ **THE DISCRIMINATOR IS THE SPLIT ON THE TWO `spirv-val`-SUFFIXED LINES ONLY.** `spirv-val [ 0 / 866 ]` and `Non-Semantic Info spirv-val [ 0 / 866 ]` while the plain and `Non-Semantic Info` lines sit at `866 / 866` ⇒ **infra outage, not shader bugs.**

⛔ **Two things I had wrong in my own store and relayed to two coworkers, who armed a watcher on them:**
1. ⛔ **"All four modes at 866/866" is a NON-DISCRIMINATOR.** There are four `PASSING` lines but only **two** are validator modes. The plain and `Non-Semantic Info` lines are `866/866` in **BOTH** poles — a check keyed on "four modes green" reads healthy off two lines that are healthy either way.
2. ⛔ **`- FAIL` = 1732 in the POISONED log, NOT 0.** I held the healthy `- PASS`=3464 / `- FAIL`=0 pair and let it imply a broken run has no FAILs. It has 1732, paired **1:1** with 1732 PASS. **A `- FAIL` count discriminates NOTHING** — worse, a watcher treating "FAILs present" as evidence of a real regression reads the infra outage as exactly the code failure it exists to rule out.

✅ **Byte-spacing verified `cat -A`:** `PASSING spirv-val [ 0 / 866 ]^M` — **inner spaces + CRLF**. Grep the **bare token `spirv-val`**; the compact `spirv-val [0/866]` matches **ZERO** on a genuine occurrence.

⭐⭐ **`spirv-val` is emitted NOWHERE in first-party code** — every in-tree hit is `external/glslang`, `external/spirv-tools`, a nightly sascha workflow, or a comment. The tally comes from the external harness. ⇒ **An in-tree grep returning nothing is NOT evidence about the log**, and the log is the only authoritative source for the format. `slang-fixer` correctly refused to verify my spacing claim in-tree and flagged that it was holding it on report — the right move, and the reason I went and measured it.

⚠️ **Blast radius does NOT substitute for the split.** Anything touching `slang-emit.cpp` is on the SPIR-V validation path, so a `test-compile-regression` failure on such a branch cannot be dismissed by scope. Run the positive test.

⚠️ **Other green jobs on the same runner are NOT a discriminator.** On run `31047790392`, `test-falcor / Test (Falcor Perf)` and `test-benchmark` both passed on SLANGWIN5 — neither exercises the validator path, so their greens say nothing about the defect.

**Procedure:** `gh api repos/shader-slang/slang/actions/runs/<run>/jobs?per_page=100 --jq '.jobs[]|select(.conclusion=="failure")|{name,runner_name}'` → if `runner_name == "SLANGWIN5"`, fetch that job's log, `grep 'spirv-val'` (bare), read the two suffixed lines. Gate structurally on the runner name rather than remembering to check.

See [[project_slangwin5_spirv_val_runner_defect]] for the outage chain and [[project_12342_downstream_absent_capability_slangresult]] for why #12342 exists (a dead validator reporting as 866 shader bugs *is* the absent-capability-vs-genuine-failure conflation that PR fixes).
