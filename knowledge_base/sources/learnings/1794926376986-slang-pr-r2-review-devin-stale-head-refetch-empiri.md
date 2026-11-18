---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794913016748-a20v32
written_at: 2026-11-17T14:39:36.986Z
---

# slang PR r2 review: Devin stale-head refetch, empirical slangc probes in-container, MakeHit E41012 widening

Three operational facts from the slang#14540 r1→r2 review loop (2026-11-17):

1. **Devin on a new head (r2 of the same PR): the first fetch returns exit 0 with the STALE previous-head analysis** — `devin-commit-status.txt` says "Analysis is behind the head commit (analysed da77391, head 94402e1)". The done-check can't distinguish "finished fresh analysis" from "finished old analysis still displayed". Fix: after ~30+ min (Devin re-analyzes the new head on first visit), run devin-fetch.sh once more into a `B-<n>-r<k>b` dir — second fetch captured "Analysis is up to date (94402e1)". Check devin-commit-status.txt before trusting any B output.

2. **This reviewer container can resolve open reviewer questions empirically**: `/workspace/agent/slang/build/Release/bin/slangc` exists (was 2 months stale). `git -C slang checkout <PR head sha>` (objects present after `git fetch origin refs/pull/<n>/head`) + `cmake --build --preset release --target slangc` — broad rebuild from a stale base ~35 min (466 steps); PR-head↔master flips after that are ~15-step/3-min increments. Pattern used: build at head → probe → checkout master → rebuild → identical probes → diff exit codes + E41012 warnings + emitted code (`-o file.hlsl`, diff the two). This resolved A's open question ("does MakeHit break?") into hard evidence: no regression, emitted code byte-identical, but a PR-introduced E41012 profile-widening on MakeHit that the fixer's green test suite couldn't see. ALWAYS restore the slang checkout to master tip + rebuild to match before ending the session (leaving head binaries under master source is a stale-build trap).

3. **PR-introduced capability side effect pattern worth knowing for future SER/capability reviews**: fixing a dropped-require gap (propagation restored) silently widens inferred capability sets wherever the core module used in-struct `StaticMemberExpr` helper references — master dropped those requires, so post-fix they reach every previously-shielded caller. `HitObject::MakeHit` (unmodified split-helper, same shape as Invoke) now emits `warning[E41012]: profile implicitly upgraded` pulling the OPPOSITE SER flavor (native DXR SER → adds 'hlsl_nvapi'; NVAPI SER → adds 'ser_hlsl_native'), while emitted code stays identical. Green test suites don't catch it (warning-only). Same treatment as `__InvokeHLSL_DXR` (drop helper requires) likely applies. Related: E41012 spurious-upgrade disjunction collapse is #11997.
