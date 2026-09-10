---
name: project_12285_precise_fma_noinline_stale_version
description: "slang#12285 precise-FMA compensated-sum wrong unless noinline — stale-version report; RESOLVED/CLOSED 2026-08-31. Fix reached SlangPy users by an unrelated route, not our draft."
metadata:
  node_type: memory
  type: project
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

# slang#12285 — precise-FMA compensated-sum (stale-version report) — CLOSED

✅ **RESOLVED / CLOSED 2026-08-31.** `kaizhangNV` (MEMBER) closed both **slang#12285**
and **slangpy#1092** (reason COMPLETED). SlangPy `main` picked up the fix via **his** PR
#1128 (`47f06a191e`, merged 08-28 → `2026.16.1`), **not** our draft #1093. Verified
`2026.16.1` contains all four fixes (`33f9ed0c`/`22d27646`/`caa2ff45`/`85d79c676`) by
**merge_base**, not version ordering. Our draft **#1093 (pin `2026.13.1`) was a downgrade**
vs main and was **closed unmerged** (`mergedAt: null`). Chain fully closed — nothing open.
No bot comment posted: a bot confirming a maintainer's own close is noise.

## The bug
Neumaier compensated-summation shader under global `-fp-mode precise` returned a wrong
result on Vulkan (GB300) when the correction helper was **inlined**; `[noinline]` fixed it
(the call boundary acted as a driver optimization barrier). Emitted SPIR-V had the
`OpFAdd → Fma → OpFAdd` shape with **0 `NoContraction`** decorations. Root cause was a
manifestation of closed **#11933**, fixed by **PR #11935 / `33f9ed0c`** (first shipped
**v2026.13**); the reporter was on 2026.12 (cut before the fix). The residual was purely a
SlangPy Slang-version bump, not a Slang compiler fix.
- **Not** a fold into [[project_12198_precise_qualifier_spirv_nocontraction]]: #12285 is
  **global `-fp-mode precise`** (owned by #11933/#11935); #12198 is the per-**variable**
  `precise` **qualifier** in default fp-mode — different code paths.

## Durable anchors and lessons (the reason this file is kept)
- 📍 **The SlangPy pin lives at the SYMBOL `SGL_SLANG_VERSION` in `external/CMakeLists.txt`,
  never a line number** — main shifted 30 commits and a `:85`→`:95` grep hit an unrelated
  `target_compile_options`. Anchor durable references to the symbol.
- ⭐ **A HELD DRAFT IS NOT THE LANDED CHANGE.** #1093 sat 25 days awaiting one maintainer's
  version call; the fix reached users when a *different* maintainer did a general Slang bump.
  ⇒ a draft gated on an external party has a second resume trigger beyond "they reply": "the
  underlying need got met by another route," which no webhook on YOUR PR announces.
  See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
- **Fix-containment is a merge_base question with FOUR REST compare statuses**
  (`ahead`=fix absent, `behind`=present, `identical`, `diverged`), not version ordering —
  a patch-level tag (`v2026.12.0.1`, cut from an older branch) can download+build green while
  lacking the fix. Enumerate tags from `gh release list`, never from expected numbers.
  → [[technique_fix_containment_use_merge_base_four_rest_statuses]].
- **"No perf evidence for ≥2026.13" was a claim about where we looked**, not the world:
  upstream publishes per-release compile-perf JSON at
  [`shader-slang/slang-compile-perf`](https://github.com/shader-slang/slang-compile-perf).
  Enumerate the surfaces that could carry evidence before declaring a gap. The genuine
  residual (never measured by any lane) is **SlangPy runtime** perf, distinct from Slang
  compile time.
- **Verify at the ARTIFACT, not recollection.** The chain's worst error was "confirming" a
  record-fact (who instructed which pin) from memory while the primary artifact sat unread in
  the inbox. Sort claims into repo-facts (queryable) vs record-facts (who said what, when);
  check record-facts with timestamps + the primary artifact. See
  [[feedback_publish_a_claim_as_wide_as_your_evidence]] and
  [[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] (read
  `commits/<sha>/status` as well as `check-runs`).

_(Historical: full pre-resolution play-by-play — the 13.1-vs-14.1 pin debate, the concurrent
sibling-writer revert incident, the 7-error ledger, and the CI-tally corrections — was pruned
2026-09-09 on synthesis; the durable lessons above and their linked concepts carry it.)_
