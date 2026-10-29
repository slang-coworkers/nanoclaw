---
type: feedback
name: feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new_case_log
description: "Dated evidence for the live-state webhook check (2026-10-05..10-21): which rung decided #13411, #13449, #13557, #13511, #13591-#13602, #13686, #13747-#13749, #13727, #13791, #13800, #13808, #13827-#13838, and what was held. Split from feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new on 2026-10-21."
metadata:
  node_type: memory
  type: feedback
---

# Live-state webhook check: case log

Evidence behind the rungs of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]].
The rules distilled from these live there; this file only records what happened. "Held" means no
dispatch and no bot post; resume only on an @nv-slang-bot mention or an operator ask.

## Rung 5 — the mention target

- **#13411 (10-05), human-to-human mention.** jhelferty-nv asked jvepsalainen-nv (just assigned,
  owns the regen runs) whether the next gen run would fix it; no @nv-slang-bot. Held. The factual
  answer (`regenerate.py list-stale` on master already flagged misc.md, because
  `slang-ir-peephole.cpp` is a watched path) went to the operator; handoff recorded in
  `rechase-12249-13411-4260`.
- **#13511 (10-12), the mention answered our own question.** jkwak-work assigned jvepsalainen-nv and
  wrote "@tangent-vector for visibility" — exactly what our pending operator question (may the bot
  ping tangent-vector?) proposed. Held, closed the question on the dashboard, rewrote the re-chase.
- **#13727 (10-19), bot-authored issue.** jhelferty-nv asked pdeayton-nv about a follow-up to
  #13700 (cmt 6273544469). The webhook fired because the bot authored the issue. Held, no
  reaction. Fact to the operator only: filed by slang-fixer for #13700 round-4 point 2 (reply
  6230211229, commit `0a20737`); no fix planned without maintainer direction.

## Rung 2 — the comment body changed

- **#13449 (10-07).** saipraveenb25 posted a two-point comment at 16:40:44Z and deleted point (ii)
  at 16:41:38Z. I relayed the payload verbatim, presenting (ii) as his decision; the triager caught
  it by re-reading the live comment.

## Rungs 1 and 3 — deleted, or already held

- **#13557 (10-10), deleted and re-filed.** jkwak-work filed #13557 at 23:58Z, deleted it, re-filed
  the same body as #13558 at 00:01Z. The MCP read returned the opaque `'str' object` error; `gh api`
  returned 410. The re-file's session routed it.
- **#13411 (10-08), dashboard "New issue to triage".** Our own tracker, no labels and no bot triage
  comment because its triage is in the body. The chain was already held; answered the operator from
  live state, sent nothing to the triager.

## Rung 4 — a maintainer's own work item

- **#13591–#13602 (10-13).** szihs filed 12 issues in ~16 s: epic "Contributor standards for AI
  coding assistants" plus one per rule; each self-assigned with a "Done when" naming their PR (#13592
  → draft #13584). Its own R6 (#13596) asks the bot to stay off new human issues. Held; one report.
- **#13686 (10-16).** kaizhangNV, self-assigned, a gap in the structural ray-tracing frontend of their
  fork PR kaizhangNV/slang#24 (split from draft #12691); body says "not a claim about a released
  compiler". Master has no `slang.raytracing` module. Held.
- **#13747–#13749 (10-19).** jhelferty-nv filed three in ~1 min, self-assigned (#13747/#13748
  co-assigned saipraveenb25), follow-ups to their own #13728/#13406 with "Possible fixes" chosen;
  on 10-16 they had told the bot to stand down on #13406. Held; #13749 session `c4mrt3`.
  Same pattern again 10-20 (#13758) and 10-21 (#13838, `const` on `out`/`inout` → error outside
  HLSL; cross-referenced from #13406). Held, no dispatch, no post.
- **#13791 (10-20), assigned by a peer.** jkwak-work's Windows T4 CI-time proposal (`CI Improvement`);
  jhelferty-nv assigned it to the author 11 s later. CI workflow work, nothing to reproduce. Held until
  the author's own @nv-slang-bot ask 10-21 09:17Z lifted it; the chain (bot PR #13813, merged 14:16Z)
  is [[project_13791_windows_gpu_jobs_merge_back]].
- **#13800 (10-21), second #13686-shaped item.** kaizhangNV, E38000 on a generic structural RT entry,
  reproduced on their fork PR at `79f06e3f`; assigned to the author 12 s later. Master's
  `source/standard-modules/experimental/` holds only `workgraph.slang`. Held; session `zw6elr`.
- **#13808 (10-21), peer-assigned, then summoned.** jkwak-work's proposal to put slow process-spawning
  unit tests in `tests/skip-list-debug.txt`, assigned to the author 10 s later. Held; the body's
  prefixes also matched three tests its table omits (operator only). 09:14Z "@nv-slang-bot make a PR"
  (live body = payload) lifted the hold → slang-triager → fixer; PR #13812 merged 15:20Z
  (`a801f2685c`). My dispatch called companion PR #13806 "open"; it had closed 09:13Z, read at 08:54
  and not re-read. ⇒ **Re-read a companion PR's state at each send.**
- **#13893 (10-23), peer-assigned, released-compiler repro.** kaizhangNV, generic entry selection
  (`-entry 'genericMain<MetalOnly>'` / `-specialize`) skips the type argument's `[require(metal)]`;
  reproduced on v2026.20, not fork-only, but split from their fork PR kaizhangNV/slang#24 with fix
  direction given; jhelferty-nv assigned it to the author 11 s after filing. Held; session `bkxmo4`.
  ⇒ **A public-release repro does not by itself lift rung 4; the assignment and fix direction do the deciding.**
- **#13827, #13828, #13830 (10-21), three pdeayton-nv filings in one day, each assigned to the author by
  jhelferty-nv ~10 s later.** All in the author's own mimalloc / glslang-DLL line (#11925, #12036,
  #12105): `/MT` `LNK2005` with an override mimalloc v2.5.2 (pinned v2.1.7 unaffected; Slang sets
  `MI_OVERRIDE` off at `external/CMakeLists.txt:352`); arenas left mapped after `FreeLibrary` (no
  `mi_option` set on master); and `glslang_linkSPIRV`'s `new uint32_t[]` never freed
  (`slang-glslang.cpp:1149` → `slang-glslang-compiler.cpp:444`; the fix must free inside the
  allocating DLL, pattern `glslang_freeDisassembly`). Code facts to the operator only. Held; sessions
  `qtf86y`, `9uqdvv`, `ymwoer`.
- **#13831–#13838 (10-21 21:06Z), one jhelferty-nv batch of self-assigned #13406 / #11709 follow-ups.**
  Filed within seconds, each self-assigned ~10 s later (`/events` / timeline actor = author), 0
  comments, live body = payload, nothing asked of the bot; on 10-16 they had told the bot to stand
  down on #13406. Most name their own fix and build on code that exists only on #13406's head
  `afcc361ae6` (`checkEntryPointParamPassingMode`/E38054, the parameter-only modifier case, the
  `BorrowIn` switch) or on bot PR #11709's head (E30709/E30712), so none can start until those land.
  Held, no dispatch, no post. Records: [[project_13831_qualtype_exprinfo_value_category_access]],
  [[project_13838_const_on_out_inout_param_error]]; other sessions #13832 `l44wt9`, #13833 `rv632p`,
  #13834 `lgz08d`, #13835 `0wdklg`, #13836 `jk3a09`, #13837 `k1g05q`. #13836's 21:16Z author comment
  (no @nv-slang-bot) chose its direction 2 (warn at the forwarding call); still held.
- **2026-10-23, #13899** (kaizhangNV, assigned to them by jhelferty-nv 11 s later): follow-up to
  #13893 (same author, held by session `bkxmo4`), with `blocked_by #13893` and parent #11296 set on
  the timeline. It splits deferred work out of their fork PR kaizhangNV/slang#24 and names its own
  regression coverage. Their fix PR for #13893 is #13898 (approver paused, queued by `r81qhi`).
  Held, no dispatch, no post (session `2i7hu3`).
- **2026-10-25, slang-rhi#941** (albertrodriguezclo, CONTRIBUTOR; Metal `[SpecializationConstant]`
  pipeline needs `newFunctionWithName:constantValues:`): the reporter opened their own non-draft fix
  PR slang-rhi#942 (fork branch `fix/metal-function-constants`) 4 s after filing, and jhelferty-nv
  assigned jkiviluoto-nv 24 s later. Reporter ≠ assignee, so rung 4's "maintainer-owned plan" did
  not literally match, but a human report with its own fix PR and a human assignee is human-owned
  work, and R6 (#13596) holds the bot off human issues for 4 days. Held, no dispatch, no post
  (Main session `339i39`).
  10-26 17:14Z: tangent-vector commented (no @-mention). The comment links their refactor proposal
  #13882 and says it is not a prerequisite. It arrived as `pr_mention`. Still held, no dispatch, no post.
- **2026-10-29, #13997** (lujinwangnv, MEMBER; opt-in `SLANG_EMBED_STANDARD_MODULES` CMake option
  packaging the serialized standard modules into one runtime-loaded shared library). Self-assigned at
  filing (timeline actor = author), 0 comments, live body = payload, no PR yet, nothing asked of the
  bot; the body specifies its own design (build-tag check, library precedence over the loose dir,
  experimental gating unchanged). Rung 4 maintainer-owned plan. Held, no dispatch, no post (Main
  session `6iw6f4`). Resume on an @nv-slang-bot mention or an operator ask.
- **2026-10-29, #13998** (albertrodriguezclo, CONTRIBUTOR; CUDA/PTX `Texture.Load` of a 3-component
  texel references undefined `tex*fetch_int<float3>`, the `Load` twin of #12634). Same reporter and
  shape as slang-rhi#941: their own non-draft fix PR #13999 (fork branch
  `fix/cuda-texture-load-three-component`, "Fixes #13998") opened 25 s after filing, and
  github-actions auto-assigned jkwak-work. 0 comments, open. Human-owned work: held, no dispatch, no
  post (Main session `3tag9z`). #13999 routes on its own PR webhooks (approvers paused).
