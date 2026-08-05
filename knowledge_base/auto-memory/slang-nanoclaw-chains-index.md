---
name: slang-nanoclaw-chains-index
description: "slang-coworkers/nanoclaw (platform-infra repo) live chain rows, spilled from MEMORY.md at the index floor 2026-08-04. Open before any nanoclaw PR/review work. The ROUTING rule and verb-split write path stay in MEMORY.md's routing section (inside the load cut)."
metadata:
  node_type: memory
  type: project
  originSessionId: 44a66732-cecb-47d6-bb2a-658e5e0ab91c
---

# `slang-coworkers/nanoclaw` — live chain rows

⛔**Spilled from `MEMORY.md` 2026-08-04 at the index floor** (rows were already past every
candidate bound ⇒ dark either way; spillover is the lever, not deletion). **Named
`slang-nanoclaw-chains-index.md` deliberately so the documented tail-cut recovery glob
`ls .../slang-*-index.md` finds it.**

⚠️**The two standing rules for this repo stay in `MEMORY.md`'s ROUTING section, which is inside
the load cut — do not move them here:** (1) nanoclaw PRs are handled **INLINE by Main**, never
routed to a `*-pr-approver`; (2) the write path is **verb-split** — both `gh pr review` and
`gh pr comment` are denied, `gh api .../issues/N/comments -X POST` works. See
[[project_nanoclaw_pr874_webhook_route_approver]].

## Review-pipeline infra defects

- ⛔⭐⭐⭐[**Shared `tmp/pr-diff.patch` clobbered by concurrent review runs**](project_review_pipeline_shared_tmp_diff_clobber.md) — **5th+ occurrence, 08-04 on slang#12269.** ONE root cause, TWO shapes: the LOUD `INTEGRITY-FAIL` false positive **and** a reviewer subagent *silently reviewing the wrong PR* (#12271) while believing it read the correct diff. ⭐⭐⭐**The recurring false positive trains you to dismiss the guard exactly when it is also producing wrong output.** Discriminator: ignore the shared file — compare the run's own `pr-diff.reference` + footer-pinned head/`diff sha256` against live head. **Fix = worktree-per-run isolation (already in operator queue; this is more evidence).** Interim: scope the diff filename by PR + head sha.
- 🔴[**`persistent: true` does NOT rescue an in-session monitor**](feedback_in_session_monitors_dont_survive_teardown.md) — measured 08-04: armed persistent, still died silently ⇒ necessary-but-insufficient; use a host `schedule_task` cron or run foreground in-turn. ⭐⭐⭐**And teardown kills the DELIVERY mechanism, not necessarily the WORK — a 5-day-silent review pass had COMPLETED with output intact on disk; check artifacts before writing a run off** (I diagnosed it as terminated and was wrong).

## The learnings-KB builder series (#1066 → #1067 → #1068), author szihs, base `nv-main`

- 🔴 **[#1068 kb-health telemetry — MERGED 104s after opening; reviewed POST-merge (`5181115163`), merged blob == reviewed head BY HASH](project_nanoclaw_1068_kb_health_telemetry.md)** — ⛔**2 instrument defects LIVE on `nv-main`: (a) the cheap-line gate skips prose citations before `cite_re` runs ⇒ `sessions_citing` 10 vs 14 true (29% under) AND it is the DIVISOR of tokens/citing-session, so both errors argue for CUTTING the KB; (b) a zero-transcript run is byte-indistinguishable from a healthy one in `KB-HEALTH.md` (warning stderr-only, `rc=0`) ⇒ under the planned 05:45 cron a broken glob publishes "nobody uses the KB, cost 0" — the script's own documented landmine, in its own output surface.** ✅Offline claim exact, glob landmine real+handled, no-leak holds, ALL shape baselines reproduce (23 over-cap / 47 no-TL;DR). 🟡atoms/day divides by days-WITH-atoms (7× on a sparse fixture) · deltas ignore `window_days` (+200% at identical rate) · `other` in headline not breakdown · corrupt history silently drops 90 runs (non-atomic write). RESUME = szihs replies ⇒ follow-up PR (offered).
- ✅ **[#1067 footer normalizer — reviewed INLINE 08-04, every claim verified, the `URL`-vs-`LINK` claim STRENGTHENED (1,572 links validation was blind to on the live corpus); prod==repo BY HASH; normalizer differentially tested with BOTH controls (fires on drift, byte-identical no-op on pass 2)](project_nanoclaw_1067_footer_normalizer.md)** — 3 non-blocking notes posted (`5180310143`): dead `LINK`, a `len()`-not-bytes figure, 2 unasserted invariants holding 0/47. CI green @`066859d`. **Merge is szihs's.**
- 🔴 **[#1066 kb-fold bounded](project_nanoclaw_1066_kb_fold_bounded.md)** — MERGED `c2a7639`; **the `superseded_by` persistence defect is STILL LIVE on `nv-main`** (`finalize()` reads a mark from a tree `build()` regenerates ⇒ retirement never persists, and it fails GREEN-LOOKING: the operator cannot distinguish "nothing retired" from "retirement isn't persisting"). Follow-up PR **OWED**. RESUME = szihs answers the persistence question, or land it with #1068's fix set.

## ⭐⭐ The lesson this series keeps teaching

**Merge races are the NORM here, not the exception:** #1066 merged **26s** before my review posted,
#1068 merged **104s** after opening. ⇒ **For szihs + `nv-main`, post-merge review is the DEFAULT
posture: recheck `merged`/`state` BEFORE drafting a verdict, and verify the merged blob equals the
reviewed head BY HASH** (an identity claim wants a hash, not a diff-read). A finding filed under a
merged banner is easy to miss — say plainly that it is a review of the merged tree, not a gate.

**And both #1068 🔴s were in the INSTRUMENT, not the reasoning** — the design calls were right;
the telemetry that measures the KB could publish a confident zero about it. Direct instance of
[[feedback_a_guard_can_be_inert_and_read_as_passing]] and
[[feedback_control_the_instrument_not_the_reasoning]].
