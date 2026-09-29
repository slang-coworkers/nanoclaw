---
name: project_12089_hitobject_ser_abi_nvapi_capability
description: "slang PR #12089 (szihs, maintainer-authored re-do of the SER-ABI approach, `Fixes #11903`). Six shadow approver rows, rev1-rev6; rev6 = BLOCK/RED_BUG @ fbbe0c40 (four NVAPI-only LSS HitObject accessors not re-gated → mixed ABI on sm_6_9+hlsl_nvapi) + persistent Falcor E41011 on sm_6_6+hlsl_nvapi (PR-caused, not flake) + stale SER doc. 08-06 jkwak asked singular `nvapiHitObject`; fixer offered a diff (no push rights). Still OPEN @ 5131ba33 as of 09-28. Nothing posted by the approver (shadow)."
metadata: 
  node_type: memory
  type: project
  originSessionId: edfa7fc6-9dea-4059-a70a-5dcc9b3f8f63
---

**PR #12089**, "HitObject: single source-of-truth SER ABI via explicit `nvapi_hit_objects` capability", is authored by **szihs (maintainer)**. Its body says `Fixes #11903`, but #11903 and our bot PR #11907 already closed on 07-10 ([[project_11903_hitobject_sm69_nvapi_pending]]). So this is a maintainer's cleaner re-do and **not our chain**. `pr_ready` goes to the approver only, with no fixer or reviewer dispatch ([[feedback_webhook_dispatch_by_event]]). The one exception is a real `@nv-slang-bot` mention, which goes to slang-fixer in `pr-review-fix` mode.

**State (gh-verified 2026-09-28):** OPEN, head `5131ba33`, unchanged since 07-22. Re-decidable on the next `synchronize`. The approver side records the human verdict when merge or close lands.

## Mechanism

The PR adds a new capability atom, `nvapi_hit_objects : hlsl_nvapi`, later renamed `nvapiHitObjects`. The HLSL type emitter and every HitObject `__target_switch` consult one ABI decision through concrete-atom `implies()` on the resolved caps. Native 2-arg `Invoke` gets a `static_assert` (E41400) under NVAPI. This is the same capability-atom pattern our chain converged on. **Deliberate breaking change:** `hlsl_nvapi` alone no longer selects the NVAPI HitObject ABI. skallweitNV signed off on 08-03 ("will break existing Slang code relying on the NVAPI path by default, but that's expected").

## Approver ledger (shadow mode, ledger-only)

| rev | head | verdict | driver |
|---|---|---|---|
| 1 | `15ae9279` | ABSTAIN / CHALLENGER_CONCERN | Real ci.yml never ran. The branch was CONFLICTING and ~228 behind. Fallback-tier review only. |
| 2 | `ce42d01f` | ABSTAIN / ci_green_on_sha | `check-cmdline-ref` red: new atoms added without regenerating `command-line-slangc-reference.md`. Also 🔴 `SLANG_UNEXPECTED` abort on bare `hlsl_nvapi` + pre-SM6.9 (`slang-emit-hlsl.cpp:1997`). |
| 3 | `54a064e9` | ABSTAIN / no_protected_paths | Added `source/slang/CMakeLists.txt` (fiddle race target). Also 🔴 `ReorderThread(uint,uint)` silently emits `dx::MaybeReorderThread` on sm_6_5+hlsl_nvapi. |
| 4 | `ecd1e5e4` | ABSTAIN / no_protected_paths | Rebase only, PR code byte-identical. The production review enumerated more mixed-ABI sites (`MakeMiss(RayFlags)`, `FromRayQuery`). |
| 5 | `d6c2114d` | ABSTAIN / CHALLENGER_CONCERN | CMake dropped, so **all 6 clauses pass** for the first time. The earlier ABI sites were fixed by `[require]` splits. New driver: Falcor **E41011** `__target_switch has no compatible target` on `sm_6_6+hlsl_nvapi`. |
| 6 | `fbbe0c40` | **BLOCK / RED_BUG** | A pure rename to `nvapiHitObjects`. The production review escalated to 🔴: four LSS accessors (`GetSpherePositionAndRadius`, `GetLssPositionsAndRadii`, `IsSphereHit`, `IsLssHit`, `hlsl.meta.slang` ~24239-24333) were never re-gated. On `sm_6_9+hlsl_nvapi` the type emits native `dx::HitObject` while those methods emit NVAPI accessors, which is the exact #11903 defect class. |

**Open author actions at rev6:** re-gate the four LSS accessors, resolve the `sm_6_6+hlsl_nvapi` Falcor break (migrate consumers or add back-compat), and update `docs/shader-execution-reordering.md`. The production `github-actions[bot]` review already carries the 🔴 publicly. No bot post and no operator card, per [[feedback_approver_never_posts_route_reviewer]].

**Process catch (rev5):** on rev2-rev4 the approver had classed `test-falcor` as an external flake. The DECISION_REVIEW critique read the log and found E41011 on exactly the surface this PR re-gates, so it is PR-caused. That misclassification changed no earlier verdict, because each of those revs had a stronger driver. ⇒ **Before calling a CI leg flake, check whether it failed on the surface the PR touches.**

## Naming sub-thread (07-22 → 08-06)

jkwak-work asked for the singular `nvapiHitObject` (r3634501553). On 08-06 he made it an instruction: "Please remove `-s`" (r3725400139, on `slang-capabilities.capdef:241`). Casing is settled: jkwak ruled that user-facing extension names are camelCase, like `spvSomeExtensions`. The earlier ask to drop `cuda_glsl_nvapiHitObjects` was already done at `5131ba33`. The fixer agreed that the singular is more consistent with nearby atoms. Codex narrowed an "exhaustively singular" overclaim, because `image_samples` and `texture_querylevels` are plural external-name mirrors.

- **Rename surface at `5131ba33`:** 94 lines across 26 files. `hlsl.meta.slang` has 49 of them. The rest: `slang-emit-hlsl.cpp` 5, `slang-capabilities.capdef` 3, `slang-diagnostics.lua` 1, 20 test files 32, plus the two docs.
- **End-to-end proof:** `slang-diagnostics.lua:5579` embeds the atom in the E55215 prose, and `hit-object-no-ser-capability-error.slang:12` CHECKs it. That test compiles with plain `-capability hlsl_nvapi` and greps the message, so a one-sided rename fails it. `hit-object-invoke-nvapi-error.slang` carries the atom in three roles (prose, comment, live `-capability`). The `tests/vkray/raygen-trace-ray-param-*.slang` files are easy to miss.
- **Disposition:** the fixer applies the rename locally, builds, runs the diagnostic and SER tests, regenerates the cmdline ref, and formats. After clearing the critique gate, it **posts the verified diff** and offers a PR into `ser-abi-single-source`. The reply covers the rename only. The BLOCK, mixed-ABI, and Falcor findings stay off GitHub. The fixer hit a gate defect along the way: [[project_critique_gate_stale_state_crosses_sessions]].

## Durable instrument lessons

- **The GitHub contents API returns `content: ""` / `encoding: "none"` for files over 1MB.** `hlsl.meta.slang` is 1.24MB, so a per-file count printed **0** on the file holding half the hits. Use `-H "Accept: application/vnd.github.raw"` or a checkout, and range-check any zero. Same family as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
- **In-repo is not the same as pushable by us.** I offered the fixer a "push to their branch" option, inferred from topology. Measured: `permissions.push: false`, `maintainer_can_modify: false`. The fixer flagged the problem before acting. A capability claim needs a probe, as in [[feedback_published_negative_env_claims_need_rederivation]] (inverted polarity here).
- **`a4-02-reference-capability-atoms.md` is a build-graph output.** `source/slang/CMakeLists.txt:108-118` passes `--doc` with the in-tree path, so any build that needs the capability defs rewrites it. Only `command-line-slangc-reference.md` needs a manual regen: `slangc -help-style markdown -h > … 2>&1`. The `2>&1` is load-bearing for the byte-exact `check-cmdline-ref` gate (`ci.yml:549`).
- **Shallow clone ⇒ `rev-list --count` returns plausible-looking garbage.** The local count said ahead 6644 while the API said ahead 13 / behind 116. Use the compare API ([[feedback_shallow_clone_makes_your_head_the_graft_root]]). On a cold branch, suspect base drift before your own output when `check-cmdline-ref` disagrees.
