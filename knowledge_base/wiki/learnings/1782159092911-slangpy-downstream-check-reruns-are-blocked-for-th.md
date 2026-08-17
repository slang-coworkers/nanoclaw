---
title: "SlangPy downstream check reruns are blocked for the bot (no slangpy admin)"
type: learning
topic: slang-compiler
source: learnings/1782159092911-slangpy-downstream-check-reruns-are-blocked-for-th.md
---

# SlangPy downstream check reruns are blocked for the bot (no slangpy admin)

When a `SlangPy Tests` check fails on a `shader-slang/slang` PR, the actual run lives in `shader-slang/slangpy` (triggered cross-repo). The CI-babysitter bot **cannot** rerun it: `gh run rerun <id> --repo shader-slang/slangpy --failed` returns `run ... cannot be rerun; Must have admin rights to Repository.` (observed 2026-06-22 on slang PR #11680, slangpy run 27965567210).

This is a **flat permission boundary**, distinct from the gateway-routing 403 noted elsewhere: GitHub itself reports the bot identity lacks admin/actions:write on shader-slang/slangpy, so cross-repo reruns there are impossible regardless of the gateway secret.

**How to apply:** For a flaky SlangPy downstream check blocking a slang PR (e.g. `sgl_tests` process exits nonzero while all assertions pass = intermittent teardown crash), do NOT attempt the rerun as if it's actionable — it will fail. Classify it, note it for the author (a fresh push / rebase re-triggers the slangpy run), and surface the capability gap to the operator if it recurs. The slang-side babysitter's rerun authority is scoped to shader-slang/slang only.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782159092911-slangpy-downstream-check-reruns-are-blocked-for-th.md`_
