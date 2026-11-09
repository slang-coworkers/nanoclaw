---
type: project
name: project_13947_metal_clip_distance_packing
description: "PARKED until #13939 and #13940 merge, no fixer (Main's order, #13934 chain, 10-25 12:50Z). slang#13947 (bot-filed 13:10:55Z, Feature, `Metal`): pack several / vector SV_ClipDistance outputs into one Metal clip_distance array. It is the tracker for #13940's E55221 and #13939's Metal-vector E55202 once #13939 closes #13931."
---

# slang#13947: Metal clip-distance packing (feature)

**Origin:** slang-reviewer's Q3 on draft #13940. #13939 says `Fixes #13931`, and #13931 was the only tracker for Metal packing, so E55221 would have had no home. The #13934 Main ordered a dedicated issue at 12:50Z, and the #13934 fixer filed it at 13:10:55Z.

**State the body records:** #13940 gives E55221 for several clip outputs. #13939 gives E55202 for Metal vector clip distances (`isUnsupported = isVectorTypedVarying(parentVar)`). Parked until both merge.

**Routing:** its issue_opened Main (`sess-1792933857073-fb371g`) owns it; per the order, no fixer now. Resume when both #13939 and #13940 have merged, which the parent chains' webhooks deliver. Whether #13939 keeps `Fixes #13931` is still the operator's call (raised 12:50Z).

**13:14Z resume trigger armed (issue_opened Main `fb371g`).** The merge webhooks for #13939/#13940 go to the fixer sessions via pr-mappings, and no one told them to un-park #13947, so it had no watcher. Verified live at 13:12Z: #13947 open, 0 comments, no timeline cross-ref yet; #13939 draft @ `ba4db451b7`, #13940 draft @ `c38538f3e0`; only my session on the thread; the #13934 Main reported the park to the operator (row 61). One-shot `recheck-13947-metal-clip-caf0` runs 2026-11-01T13:00Z. If both PRs have merged, it asks the operator whether to dispatch slang-fixer; if either is still open, it re-arms +7d (cap 3). No GitHub post.

Related: [project_13934](project_13934_metal_clip_cull_distance_empty_attribute.md), [project_13931](project_13931_sv_clipdistance_vector_form.md).

**2026-11-01 13:00Z re-check (`caf0`): still parked.** Both PRs are still open drafts and not merged: #13939 @ `ba4db451b7`, unchanged since 10-25; #13940 @ `2bfef77a33`, its head moved from `c38538f3e0` on 10-25. #13947 has 0 comments. No PR or non-Main session owns it, and the only session on the thread is Main `fb371g`. **New fact: jhelferty-nv assigned #13947 to jkwak-work on 2026-10-26.** When it unblocks, put that in the dispatch question, because the human assignee may want it. I sent a status line to orchestrator-dashboard (msg 21) and re-armed `recheck-13947-metal-clip-f32b` for 2026-11-08T13:00Z (re-chase 1/3). No GitHub post.

**2026-11-08 13:00Z re-check (`f32b`): still parked.** Both PRs are still open drafts and not merged: #13939 @ `a650d9bb40` (head moved from `ba4db451b7`, updated 11-06); #13940 @ `2bfef77a33` (unchanged). #13947 is open with 0 comments, assigned to jkwak-work (unchanged), and no PR owns it. The only session on the thread is Main `fb371g`. I sent a status line to orchestrator-dashboard (msg 9) and re-armed `recheck-13947-metal-clip-e20c` for 2026-11-15T13:00Z (re-chase 2/3; the next one must not re-arm). No GitHub post.
