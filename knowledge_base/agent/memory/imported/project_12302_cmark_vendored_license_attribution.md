---
name: project-12302-cmark-vendored-license-attribution
description: "slang#12302 — vendored 3rd-party submodules statically linked w/o license attribution in installed package (cmark/lz4/glslang)"
metadata: 
  node_type: memory
  type: project
  originSessionId: c395af1e-291e-4fc7-9a0b-c204cc69ee1a
---

**shader-slang/slang#12302** — legal/compliance bug, P2/medium, build-system+packaging (REUSE+install). External reporter BillyONeal (Microsoft vcpkg maintainer), via vcpkg PR microsoft/vcpkg#53110; flagged by GPT 5.6 Sol.

**Core defect:** `external/cmark` (swift-cmark/cmark-gfm submodule, BSD-2-Clause © John MacFarlane) is statically linked into the shipped `slang` lib (`source/slang/CMakeLists.txt:280`), but its copyright/redistribution notice is NOT carried in the installed package. `LICENSES/` has no `BSD-2-Clause.txt`; install ships only LICENSE+README+LICENSES/ (`CMakeLists.txt:642-654`). Reporter is CORRECT. Verified @HEAD dc9558d57.

**Broader (triager checked others):** same gap for 2 more statically-linked submodules — **lz4** (BSD-2) and **glslang** (BSD-3). Class defect: `reuse lint` doesn't recurse submodules and REUSE.toml isn't installed.

**⚠️ Corrected fix (A1) — original memo was CI-wrong:** The original recommendation ("add `LICENSES/BSD-2-Clause.txt` + `BSD-3-Clause.txt`") would have turned the `reuse-compliance` CI job RED. Triager empirically reproduced (reuse 6.2.0): a bare *unused* `LICENSES/BSD-2-Clause.txt` makes `reuse lint` exit 1 ("unused licenses"); a tracked carrier file referencing it restores exit 0. Also confirmed CI checkout (`reuse-compliance.yml`, `actions/checkout@v7`, no `submodules:`) does NOT fetch submodules, so `reuse lint` never sees submodule sources.
- **A1 = ship the deps' OWN notice files** (`external/cmark/COPYING`, `external/lz4/lib/LICENSE`, `external/glslang/LICENSE.txt`) via the install `metadata` component + add cmark to README dep list — independent of the REUSE `LICENSES/` mechanism. Public verdict refreshed in place with this correction + CI evidence.
- Approach B (auto-aggregate/auto-gen submodule notices at install) = follow-up hardening.

**State (2026-07-31):** Triage + PLAN complete, **HELD at plan stage (no PR yet)** pending maintainer/legal sign-off. Verdict posted+refreshed on GitHub (comment 5138005667), labeled `reproduced`, Type→Bug. Briefing forwarded to **slang-fixer** (draft-PR-only, correctly did NOT auto-open). No duplicate issue.
- **Blocker / next human action:** maintainer/legal picks mechanism (raw files vs one THIRD-PARTY-NOTICES vs auto-gen) + scope (rec: all 3 deps) + confirms notice wording — 4 decision points in fixer's report. On "go" → draft PR only, never self-merge.
- **RESUME on:** fixer `[Fix Report]`+PR / maintainer direction / fresh substantive human comment. Triager refreshes issue verdict + forwards `[Triage Resolution]` upstream on resume.
