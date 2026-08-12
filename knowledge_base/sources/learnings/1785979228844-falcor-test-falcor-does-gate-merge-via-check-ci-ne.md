# Falcor test-falcor DOES gate merge via check-ci needs (corrects earlier claim)

## Correction

A prior learning states `test-falcor` is **NOT a required status check**, so a Falcor red "doesn't gate merge." **Source at HEAD contradicts this** (verified 2026-08-06, slang HEAD `49584a0890d33251f3fb81dfce408f41b753edd8`):

- `.github/workflows/ci.yml:675` lists `test-falcor` inside `check-ci`'s `needs:` array.
- `check-ci`'s script requires **every** needed job to succeed — it builds `unsuccessful` from `toJSON(needs)` selecting `.value.result != "success"` and `exit 1`s if non-empty.

So even if `test-falcor` itself is not the branch-protection context, `check-ci` (which almost certainly is) **fails when Falcor fails**. Corroborating from the eviction tally: #12145 caused **10 of 18** merge-queue evictions in the 7 days to 08-05 — it demonstrably bounces PRs out of the queue.

⚠️ Note `gh api repos/shader-slang/slang/branches/master/protection` returns **403 "Resource not accessible by integration"** to the `nv-slang-bot` App token, so you cannot read required contexts directly. Don't infer "not required" from an inability to read the list — read `check-ci`'s `needs` instead.

**Why it matters:** the false version invites under-reacting to a Falcor red ("cosmetic, doesn't block"). It blocks. That's the whole reason a test-scoped retry is worth building.

## Falcor image-test log format (for gate-writing)

Bytes copied from real ~309 KB logs, not retyped:

- Result line: `  renderpasses/test_GBufferRTTexGrads_d3d12                    : FAILED (14.8 s)` — exactly 2 leading spaces, path-prefixed name (`renderpasses/`, `internal/renderpasses/`, `scene/`, …). The `" : "` separator column is **not fixed** (shifts to 74 for the longest name) ⇒ never anchor on a column.
- **There is NO numeric pass/fail tally.** The only trailer is `Image tests FAILED (772.1 s).` / `Image tests PASSED (687.9 s).`. Counts must be derived by counting `" : FAILED ("` lines.
- Header `Running 120 tests on 4 processes` gives a free completeness cross-check: `PASSED+FAILED+SKIPPED` must equal it (steady state 109/1/10). If it doesn't, the log is truncated — **abstain**, don't conclude.
- **Logs are CRLF** — every line ends `\r\n`, so `$`-anchored patterns silently fail. Strip CR or stay unanchored.
- `0xC0000005` appears **zero** times; only decimal `3221225477`. Hex greps are guaranteed false negatives.
- `" : FAILED ("` has zero collisions with the earlier `falcor-unit-test` step (gtest uses `[  FAILED  ]`).
- Suite **continues** past the crash (4-way `ThreadPoolExecutor`), so a single crash still yields a full result set.
- Step cost: 11m33s–12m52s against a 100-min job timeout ⇒ a whole-suite retry fits with headroom.
