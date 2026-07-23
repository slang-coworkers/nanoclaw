---
name: project_slangpy_782_torch_coverage_gaps
description: "slangpy#782 torch-integration Python coverage re-review — answered inline; gaps outstanding on main pending PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 030149d4-ccb9-4699-a3a6-1fef81330b6f
---

# slangpy#782 — Improve coverage of torch integration (Python side)

**2026-07-22:** jhelferty-nv (maintainer) asked the bot on the issue whether any
coverage automation exists yet for slangpy and to re-review which of the issue's
enumerated coverage gaps have since closed. Routed to slangpy-triager; verified
against `main` @6b8c2d2 (clean tree). Answered inline on GitHub — comment
5048173121. Re-review/status question, no fixer dispatch.

**Coverage automation:** ❌ none for Python. `pytest-cov` declared
(`requirements-dev.txt:6`) but never invoked — no `--cov`, no Codecov/Coveralls,
no threshold gate. Only a C++ `gcovr` HTML artifact of `src/sgl` on one CI job
(`ci.yml:59,236-247`) — informational, non-blocking.

**Gaps status:** mostly STILL OUTSTANDING on `main` because the maintainer's
"completed" tests live in **open, unmerged PR #928** (`fix-782`, +2538, mergeable).
On main: Tier-1 E2E torch workflows ✅ covered (~65 tests, 6 files);
`test_ndbuffer.py`/`test_diffpair_type.py`/`test_descriptor_marshall.py` ❌ absent
(in #928); `detect_torch_tensors` + `build_shader_object` ❌ untested; Tier-3 xfail
guards for #833/#836 ❌ none (zero xfail markers repo-wide), #830 ⚠️ has a plain
(non-xfail) test; 6 dead fns in `core/utils.py` ❌ still present;
`BaseNDBufferMarshall` ✅ already removed. Also: #917 (scalar DiffPair backward)
has MERGED, so the stated reason for dropping DiffPairMarshall testing no longer holds.

**Next human action:** maintainer decides — merge PR #928 to close most gaps in one
move, and separately add Python coverage automation (`pytest --cov` + Codecov/threshold)
if ongoing tracking is wanted. Watch-only; jhelferty-nv owns.
