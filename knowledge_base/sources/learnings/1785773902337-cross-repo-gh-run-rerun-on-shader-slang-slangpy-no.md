# Cross-repo gh run rerun on shader-slang/slangpy now WORKS — verify via run_attempt, not exit code

**The long-standing "the bot cannot rerun slangpy runs" premise is FALSE at HEAD.** If you are carrying a note that says `gh run rerun --repo shader-slang/slangpy` fails with `Must have admin rights to Repository` (attributed to the OneCLI gateway secret being scoped `slang/actions/*` only), that note is stale — stop applying it.

## Evidence

On slang PR #12116 the only red was the cross-repo `SlangPy Tests` commit status (slang-side head `5c0e69c0` fully green), pointing at slangpy run `30808650114`.

```bash
gh run rerun 30808650114 --repo shader-slang/slangpy --failed   # exit 0
gh api repos/shader-slang/slangpy/actions/runs/30808650114 \
  --jq '{status,conclusion,attempt:.run_attempt}'
# => {"status":"queued","conclusion":null,"attempt":2}
```

`run_attempt` incremented **1 → 2**. The old rejection did not reproduce.

## The methodological point (this is the reusable part)

**Exit 0 is NOT proof a rerun fired. The `run_attempt` increment is.**

Under the OneCLI gateway, a call can fail server-side and still surface exit 0 depending on invocation form — the same laundering that produces phantom-green sweeps (`gh ... | jq` reports jq's status, not gh's). So after *any* rerun, cross-repo or not, re-read the run and confirm the attempt counter moved. Two independent facts (exit code + attempt delta) beat one.

This also cuts the other way: I had a standing note that all-false `permissions` on shader-slang/slangpy implied the bot couldn't act there. Reading logs always worked anyway. **Permissions introspection is a poor proxy for capability — probe the actual operation.**

## How to classify slangpy reds now

Don't auto-file them as "bot-can't-rerun / log-as-left". Classify the signature first:

- **Genuinely intermittent** (dep-fetch 5xx, network, single-platform transient) → **rerun it** under the normal 3/PR/day cap, then verify the attempt increment.
- **Deterministic or known-owned** (setup-python toolcache, a capability/diagnostic break like slang#11225's E36121, an author-owned code break) → still no rerun, but for the right reason: **a rerun cannot fix a deterministic failure.** That's a determinism argument, not a permissions one. Keeping the two straight matters, because the permissions premise just evaporated and the determinism one didn't.

## The signature that prompted this

Transient DXC prebuilt fetch failure — worth recognizing:

```
error: downloading '.../v1.9.2602/dxc_2026_02_20.zip' failed
      The requested URL returned error: 500
CMake Error at .../download-dxc-populate.cmake:163 (message): Each download failed!
  cmake/FetchDXC.cmake:868 (FetchContent_MakeAvailable)
ninja: error: loading 'build-Release.ninja': The system cannot find the file specified.
```

Fails at **CMake configure**, so zero tests run — no assertion counts to reason about. The Linux `build-pr` leg was green, i.e. single-platform transient CDN. Note this is raised from `FetchDXC.cmake`, a **different code path** from `FetchedSharedLibrary.cmake` (which slang PR #12323 fixes) — one root cause, two uncovered call sites.
