---
name: project_12211_capdef_latest_atom_internal_pair_regr
description: "#12211 capability-generator build-break regression from our #12122 — internal _GLSL_latest/_sm_latest atoms lack public pair"
metadata: 
  node_type: memory
  type: project
  originSessionId: dc6f0a0c-4d69-49c8-b93c-e00c33328bb7
---

**#12211** — Clean capability-generator regen fails **error 20007** on `_GLSL_latest` (slang-capabilities.capdef:182) + `_sm_latest` (capdef:227): internal `_atom` aliases with **no corresponding public `atom`**. Cascades to Windows Release MSB8066. Filed by **jkwak-work** (maintainer, self-filed not self-assigned) 07-24.

**Regression from OUR PR #12122** (commit `7e65d59665`, chain `#12099→#12122`, merged by jkwak 07-23). Added `alias _GLSL_latest = _GLSL_460;` / `alias _sm_latest = _sm_6_10;`, used by `getLatestGlslAtom()` / `getLatestHlslAtom()`. `CapabilityDefParser::validateInternalAtomExternalAtomPair()` requires every internal `_atom` to have a public pair (cf. `_spirv_latest`↔`spirv_latest`).

**Classification (triager):** bug/build-break/high. REPRODUCED locally @HEAD 15ada68aa. Applied `reproduced`+`regression`, Type=Bug. **Priority: P0** — jkwak-work bumped P1→P0 07-24 (comment 5069368356: "'build-break regression' should be P0"); relayed to slang-triager to re-classify + update GitHub verdict/label.

**Solution space:** A (recommended) = add public `GLSL_latest`/`sm_latest` aliases mirroring already-public `spirv_latest`/`metallib_latest`; zero C++ change, regen capability-atoms doc. B = keep internal, rework getters. C = relax generator invariant (rejected). **Key design decision:** should these become *public* capabilities (A) or stay internal (B)? SPIR-V+Metal precedent both public → A consistent default; = jkwak's own primary suggestion.

Files: slang-capabilities.capdef:182/227, capability-generator-main.cpp:410-446, slang-capability.cpp:288-305.

**Chain:** Main → slang-triager (07-24, reproduced+dispatched, P0 re-class applied) → slang-fixer → **draft PR #12215** (`fix/issue-12211`, `pr: non-breaking`, `Closes #12211`, head 78811f1f26) OPEN, held pending review. +16/−0 across 3 files: public `alias GLSL_latest = _GLSL_460;` + `alias sm_latest = _sm_6_10;` with `/// [Version]` docs (mirrors `spirv_latest`/`metallib_latest`, zero C++), + regenerated a4-02-reference-capability-atoms.md + command-line-slangc-reference.md. Guard = 2 CI ref-checks (check-capability-atoms-ref / check-cmdline-ref). codex CODE/PLAN/OUTPUT approved per fixer. → slang-reviewer for verdict (pass pending).

**Design point (maintainer call, not blocker):** raw internal RHS `_GLSL_460` vs cross-target `GLSL_460` bundle — fixer defaulted to raw to match `spirv_latest` + issue's suggested form. Noted in PR.

**⚠ codex outage caveat:** fixer delivered plain status, NOT the gated `[Fix Report]` marker — codex sustained outage 07-24, OUTPUT_REVIEW gate couldn't re-run. Durable record = PR #12215 + issue comments; marker re-issued on codex recovery if wanted.

**Merge OPERATOR-gated** per standing rules. Next: reviewer verdict → operator ready+merge decision. Verdict comment 5069122592 refreshed in place to name the draft PR.

---

## TERMINAL — RESOLVED (merged) 07-24 14:14Z

✅ Fix LIVE on master HEAD (independently verified): public `alias GLSL_latest = _GLSL_460;` (capdef:2208) + `alias sm_latest = _sm_6_10;` (capdef:2000), `/// [Version]`, zero C++. Build break gone. Was P0.

**Merged via maintainer's OWN PR #12213** "Add public latest capability aliases" — authored + merged by **jkwak-work** (merge commit `5281ccc660`, `Closes #12211`, 3 files). jkwak self-fixed in the ~2h build/review window. **Our draft PR #12215 dedup-CLOSED** in favor of it. Same raw-internal RHS our fixer defended → design call vindicated. Review moot (maintainer's own PR merged directly; our #12215 had codex CODE/PLAN/OUTPUT approved before close). Verdict comment 5069122592 → "merged in #12213". Chain CLOSED.

**Process lessons (fixer-captured):** (1) competing-PR existence check must run **immediately before `gh pr create`** — a maintainer can self-fix mid-window (see [[project_dup_pr_inadequate_existence_check]]); (2) critique-gate coverage resets on post-approve edits; (3) codex OUTPUT_REVIEW outage this session ran on default model — the `gpt-5.2-codex` override **403s in-container**.
