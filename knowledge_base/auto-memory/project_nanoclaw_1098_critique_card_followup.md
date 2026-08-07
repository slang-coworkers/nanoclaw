---
name: project_nanoclaw_1098_critique_card_followup
description: "slang-coworkers/nanoclaw#1098 fixes my three #1095 findings; verified by execution + 9/9 base-vs-head control. One live finding: raw anchors drop md()'s scheme check (javascript: becomes a live href, unreachable today). Comment 5201165396."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1098
---

**slang-coworkers/nanoclaw#1098** — `dashboard: fix three defects in the critique-gate card (review
of #1095)`, author **`szihs`** (human), base **`nv-dashboard`**, branch
`fix/nv-dashboard/critique-card-followup`. 3 files, +155/−27. Follow-up to
[[project_nanoclaw_1095_critique_card_render]] — **it fixes the findings I filed there**, which is
exactly the setup where rubber-stamping is the risk.

**ROUTING: handled INLINE by Main — ~24th instance** ([[project_nanoclaw_pr874_webhook_route_approver]]).
No nanoclaw approver exists; slang/slangpy approvers are repo-scoped ⇒ would `ABSTAIN_POLICY`.
Posted via `gh api .../issues/N/comments` (verb-split write path). Comment **`5201165396`**.

🔴 **MERGED MID-REVIEW at 06:09:49Z** (squash → `nv-dashboard` `9a30fb96`, single parent = base).
All 3 blobs of reviewed head `f7d61ffd` **byte-identical to the merged tip by hash** ⇒ the review
applies as-is. Merge-race count on this fork keeps climbing.

## ⭐⭐⭐ Two webhooks; the `synchronize` fixed a test I had just found failing

First head `91731b19` **shipped its own new test red** — CI `152 passed / 1 failed`, that test only,
matching my local run exactly. `src.indexOf('reason-')` anchors on the **renderer's class-name
literal**, which precedes the handler in both files (app.js char 228723 vs handler at 259188 — the
1200-char window lands ~30 KB short; mobile's first `reason-` is likewise the renderer). Author
re-anchored on `const reasonToggle` + `{0,800}` at `f7d61ffd`; 9/9 green.
⇒ **Only `approval-card.test.ts` changed between heads (app.js/mobile.js IDENTICAL by blob hash), so
every rendering measurement carried** — checked by hash rather than re-running blind.

## ✅ All three fixes verified BY EXECUTION (sandbox, not diff-reading)

Harvested `esc`/`escAttr`/`md`/`isReasonExpanded`/`clampedReason`/`critiqueProvenance`/
`renderApprovalItem` + mobile's `renderApprovalCard` by brace-matching into `new Function`.

- **Session link**: emitted `#/cw/<folder>/s/<id>` matched against `applyCwUrl`'s own regex
  (`app.js:6926`) over 4 shapes incl. slash-bearing id + HTML-bearing folder — all match, captures
  round-trip. **Negative controls**: old `?session=` form matches neither router (`false`) nor
  `md()`'s link rule (`false`).
- **Clamp matrix 8/8**: surface × length × expanded. Tail marker planted past each clamp (300
  desktop / 180 mobile) absent collapsed, present expanded; `show more`/`show less` mutually
  exclusive; short reason renders no toggle even with a **stale id** in `expandedReasons`.
- **Tests non-inert BOTH directions** (the strongest thing in the PR): base sources **9/9 fail**,
  head **9/9 pass**. Full suite head `1372 passed / 5 failed` vs base `1363 / 5` ⇒ delta exactly
  **+9 tests / +1 file**; the 5 are the same pre-existing export failures **by name on both sides**.

## 🟡 The one live finding — a narrowed guard, not an open hole

`md()`'s link rule enforced the scheme (`https?:\/\/` only) and **refused** `javascript:`/`data:`,
leaving them literal text. The new raw anchor passes `prUrl` through `escAttr()` only — escapes
`& " < >`, **never looks at the scheme** ⇒ `javascript:alert(1)` becomes a live `href` (rendered it).
**Reachability checked before flagging**: sole producer hardcodes it
(`critique-escalation/index.ts:356` → `https://github.com/${repo}/pull/${n}`) ⇒ **not reachable
today**; defence-in-depth. Sibling `renderMessageAttachmentsHtml` has the same `escAttr`-only shape
on `att.url`. Fix = `/^https?:\/\//.test(url)` before emitting. ⭐ **`escAttr` on an `href` reads as
"escaped therefore safe" while the safety actually rests on a hardcoded template two modules away.**
Everything else clean: hostile folder/sessionId URL-encoded into the hash, `<code>` degradation path
escapes, `repo`/`prNumber`/`reason` still `esc`-ed in both clamp branches, no attribute break-out.

🟡 **Carried from #1095, unchanged and NOT claimed by this PR**: `mobile.js:472` still `Approve`
(not `Approve once`); mobile's critique branch has no session link and no `critiqueProvenance`.

## ⛔ MY OWN NEAR-MISS — retracted pre-post, see [[feedback_leaf_branch_copies_of_owned_files_are_stale_by_design]]

Built a fully-reproduced headline finding (`agent_group_id` never written ⇒ `coworker_folder` always
null ⇒ the whole fix dead on arrival), with positive control and a verified two-hop-join fix. **Wrong
artifact**: `src/**` is nv-main-owned, so `nv-dashboard`'s `primitive.ts` is a stale tracking copy
(blob `68788766` = merge-base) while `nv-main`'s `31e1d382` **does** set it; composed state resolves
to nv-main with no conflict. Disclosed the whole near-miss in the comment rather than dropping it.
⛔ Paired instrument failure: **`merge-base` returned EMPTY on a shallow clone with exit 0**, so
`$mb:file` silently read the index and printed a plausible blob — `--unshallow` first.

**RESUME:** none required — merged, and the one live finding is unreachable today. If szihs replies,
the scheme-guard one-liner (plus the same on `renderMessageAttachmentsHtml`) is the follow-up.
Watch for the mobile `Approve once` label if a #1095 follow-up lands.
