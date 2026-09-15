---
name: project_slangpy_1089_shader_cache_path_vulkan_segv
description: "slangpy#1089 — shader_cache_path SIGSEGV on first pipeline creation (Vulkan). NOT an rhi regression (0.37.0 activated a latent path via #561); root cause unlocated, issue OPEN + maintainer-owned (kaizhangNV). 2 slang-rhi PRs shipped w/o Fixes."
metadata: 
  node_type: memory
  type: project
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# slangpy#1089 — `shader_cache_path` SIGSEGV on first pipeline creation (Vulkan)

- **Issue:** https://github.com/shader-slang/slangpy/issues/1089 — opened 2026-08-03 by `iveevi`. Canonical thread `gh-issue-shader-slang/slangpy-1089`.
- **Symptom:** `spy.Device(type=vulkan, shader_cache_path=...)` ⇒ first `create_compute_pipeline`/`create_render_pipeline` SIGSEGVs, no Python exception. Removing the arg fixes it; `module_cache_path` alone is unaffected. PyPI bisect: 0.36.0 ok, 0.37.0–0.43.1 all segfault. Env: RTX PRO 5000 Blackwell, driver 610.43.02. AI-assisted report ("generated with Opus 5").

## Boundary finding — NOT a slang-rhi regression

**0.37.0 did not break rhi; it became the first release to TURN ON a latent rhi path.** Verified via REST: the `external/slang-rhi` pin moved across 0.36→0.37 (15 commits) but `src/vulkan/vk-pipeline.cpp`'s blob SHA is **identical** at both pins; no cache file changed. What changed is slangpy — `persistent_cache.h` is 404@v0.36.0 / 200@v0.37.0, and 0.37.0 first wires `.persistentPipelineCache = m_persistent_cache.get()` (added by slangpy **#561**). Classified bug / high / **P1** / cross-repo → slang-rhi; GitHub post HELD while root cause was a hypothesis, then posted (comments `5169214782`, delta `5198010118`).

## Two hypotheses — branch 1 refuted by test, branch 2 surviving

- **Branch 1 (null `vkGetPipelineKeyKHR` proc):** the `:380` gate reads the `pipelineBinaries` **feature bit**, not the proc, so without `VK_KHR_pipeline_binary` the proc can be null yet init proceeds. **Refuted by fault signature:** a built repro (real `VkDevice`, extension absent) SIGSEGVs at the **first** call site (`:170`) with `RIP=0x0` and *no named frame*, whereas the reporter's crash has a **named** frame at `:178` (the *second* `vkGetPipelineKeyKHR`, `pNext=createInfo`) — different fault shape. A null proc predicts death at `:170`; reaching `:178` proves the proc was non-null. ⇒ the `:380` gate is a **real latent defect** (defence-in-depth, worth fixing) but is **not this crash**.
- **Branch 2 (driver-side handling of the `pNext`-chained create-info on the 2nd key query at `:178-179`):** surviving hypothesis, unconfirmed. Discriminator = `device.has_feature(spy.Feature.pipeline_cache)` (one line of Python, no debugger): `True` iff the extension was accepted on Vulkan. **The reporter never ran it — 2 days silent, then the chain went maintainer-owned.**

## Shipped work + current ownership

Two slang-rhi PRs, **neither carrying `Fixes`/`Closes`** (root cause unlocated ⇒ #1089 stays OPEN):

| PR | state | what |
|---|---|---|
| slang-rhi#808 | **MERGED, on `main`** | validate pipeline cache blob lengths/offsets before use (deserialization hardening; clamp at `vk-pipeline.cpp:355-358` before the memcpy) |
| slang-rhi#809 | open, DRAFT | Approach A — only report the Vulkan pipeline cache when its entry points are present |

**Maintainer-owned:** `kaizhangNV` self-assigned 08-05 (routed by `jkwak-work`), deferred to next sprint, first lead = slangpy **#561** (which our finding shows merely *activated* a latent path — a bisect could burn a sprint proving a correct PR correct; the pointer was posted, `5269664944`). **CLOSED at our tiers 08-05**; #809's body carries the full diagnosis. Out-of-scope residual noted on #809: serializer size arithmetic (unchecked table multiply) still unaddressed.

## Lessons (link to existing concept files)

- **Two independent CI surfaces:** `check-runs` (21) omits `license/cla`, which is a legacy **commit status** (`/status`, 1) — count both. A fact filed under the wrong retrieval key is not stored, but never infer a gap from your own surprise — ask whether the note was reachable under the key you'd use. Cf. [[feedback_two_nv_slang_bot_identities_cla_gate]], [[feedback_filter_latest_returns_two_suites_per_sha]].
- **"Merged" ≠ "present on main"** — a squash/revert/follow-up can separate them; verify by branch/tree, not SHA. Cf. [[feedback_verify_pushed_state_by_branch_not_sha]].
- **Tag-prefix trap:** `v0.36.0` 404s the file (real absence); bare `0.36.0` also 404s — because the tag doesn't exist. Confirm the ref resolves before reading a 404 as absence. Version-dependent line cites: **name the ref.**
- **A relayed claim about an artifact is a filesystem claim** — I got a comment-id container wrong (content was in `5169214782`, not `5198010118`); the peer grepped instead of accepting it and it changed the outcome. Cf. [[feedback_a_relayed_claim_about_an_artifact_is_a_filesystem_claim]], [[feedback_published_negative_env_claims_need_rederivation]].
- **A gate on someone else's reply needs its own resume path** — the whole chain was gated on one line of Python that never came. Cf. [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]. My clone-absence is evidence about me only: [[feedback_shallow_clone_makes_your_head_the_graft_root]]. Cross-repo shape mirrors [[project_12325_metal4_std_flag_vs_capability]].

**Re-engage triggers:** reporter posts the `has_feature` result · `kaizhangNV` asks a question or mentions the bot · a `Fixes #1089` appears on #809 or a successor · #809 merges (verify #1089 stays OPEN).
