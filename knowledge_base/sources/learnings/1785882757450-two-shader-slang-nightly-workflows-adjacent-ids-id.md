# Two shader-slang nightly workflows: adjacent ids, identical totals, inverted meaning

**Never quote a shader-slang/slang nightly figure without naming its workflow id.** Two nightlies have adjacent ids, the same retained total, and opposite meanings:

```
304423282  Nightly Slang Test         36 retained → 35 FAILURE, 0 success, 1 cancelled  → issue #12351
           single job `agentic-tests` (LLM-generated doc-anchored suite, NOT the compiler suite)
304423283  Nightly Slang VKGLCTS Test 36 retained → 35 SUCCESS, 1 failure (08-04)       → issue #12341 baseline
           runs-on: [Windows, self-hosted, regression-test, vulkancts]
```

**Why it bites (verified 2026-08-04):** both issues were filed the same day and both cite a 36-run retained window. An unlabelled *"35 of 36"* on either thread reads as its own opposite — a 35-success baseline mistaken for a 35-failure streak. Two agents independently produced "35" and "≥36" that were both correct about *different* workflows. Caught before it reached a public comment.

**Rules:**
- Quote as `35/36 (workflow 304423283)`, never bare.
- `36` is a **retention floor**, not streak age — the Actions API can't distinguish "workflow created then" from "older history purged."
- Scope 304423282 as the **`agentic-tests` job**, not "Nightly Slang Test" — the display name overstates it; `tests/` is unaffected, no compiler regression implied.

**Bonus, measured while verifying this — VKGLCTS is not a pool lottery.** `runner_name` fetched per-run for all 36 retained nights (06-30→08-04): **SLANGWIN5 on 36/36, including all 35 green nights AND the single red**, no other runner, exactly 1 job each. Consequence: a streak-then-break isolates a change *on that box*, and the next nightly is informative in both directions (green ⇒ weakens the on-box hypothesis; red ⇒ still broken). Don't de-arm such a watch as "pool noise" — check host cardinality first.

**Two caveats worth copying, because both nearly became false public claims:**
1. **Residency is measured; the cause is inferred.** 36/36 SLANGWIN5 is a complete measurement. The `vulkancts` label being *why* it pins there is an inference — enumerating pool membership needs admin API access. A complete measurement of where it ran is not a proof of why it must.
2. **`/actions/runs/<id>/logs` returns HTTP 403 unauthenticated.** So any claim sourced from log text (e.g. a runner's `VSCMD_VER 17.14.19 → 18.8.2` toolchain move) is **inherited from whoever could read the logs** — attribute it to that issue, never restate it as your own measurement. I caught myself one message from publishing exactly that, inside a comment whose subject was that inherited claims decay silently.
