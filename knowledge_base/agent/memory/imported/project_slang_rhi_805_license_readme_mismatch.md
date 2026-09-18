---
name: project_slang_rhi_805_license_readme_mismatch
description: "slang-rhi#805 README said MIT but LICENSE is Apache-2.0-w/-LLVM-exception — README was stale; README-only fix PR #806 MERGED + issue CLOSED 2026-08-03. Terminal."
metadata:
  node_type: memory
  type: project
  originSessionId: 02d0dfc6-a82a-441a-af2d-499cb10a0f13
---

# slang-rhi#805 — LICENSE/README license mismatch — ✅ MERGED + TERMINAL

**repo** shader-slang/slang-rhi · **opened** 2026-07-30 by KamalJDavis · **class** documentation / low / P3 · **thread** `gh-issue-shader-slang/slang-rhi-805`

Reporter flagged `README:14` says slang-rhi is "released under the MIT license" while `LICENSE` is **Apache-2.0 WITH LLVM-exception**.

**Verdict (verified @ main + git archaeology):** reporter correct, **README is the stale side**. Root = PR #111 (`bc7657abf`, 2024-11-21) deliberately relicensed MIT→Apache to align with parent shader-slang/slang; README was never updated. Fix = one line `README.md:14` → "Apache 2.0 with LLVM Exception" (README-only). Rejected: reverting LICENSE to MIT (undoes an intentional relicensing — maintainer/legal call, never a bot's).

**Outcome (2026-08-03):** DRAFT PR **#806** (`fix/issue-805`→main, `Closes #805`, README-only +1/−1, LICENSE untouched). `skallweitNV` APPROVED @ `f3b9f028f2` (binds — head unchanged). Squash-merged **`57b5dec033`** 18:10Z by jkwak-work; issue CLOSED `completed`. Re-read of merged state confirmed patch = exactly line 14, LICENSE on main unchanged ⇒ README and LICENSE now agree. Issue verdict comment `5137437442` patched in place through the lifecycle, with an explicit note to the OP that their **effective license is UNCHANGED** (Apache-2.0-w/-LLVM-exception since Nov 2024 — a doc correction, not a relicensing).

**Approver:** `WOULD_APPROVE` @ `f3b9f028f260`, mode `live_late`, policy `v0-shadow-relaxed`, Devin-only tier (Devin clean, no `claude-pr-review.yml` in slang-rhi ⇒ nothing to harvest), join `human_verdict=APPROVED`. No GitHub write (approver never posts). The `record_decision` ledger row is host-owned and **write-only from every agent tier** — emission provable from `outbound.db`, the row itself not agent-readable.

**Next human action:** none. RE-OPEN only on a fresh substantive human comment.

## Durable lessons this chain generated (all folded into their own concepts)
- ⭐ Corroboration requires independent **provenance**, not two files — `git log` the second source before calling it independent (LICENSE and `.reuse/dep5` share the #111 commit) → [[feedback_correction_must_sweep_whole_file]] (new surface class: **the audit artifact of record**).
- ⭐ The writer of an audit artifact cannot verify its own write; a ledger correction is reported upward as *attempted*, operator named as the only closer → [[feedback_recorded_is_unfalsifiable_across_tiers]].
- ⭐⭐ `processing_ack` keys on **inbound** ids; outbound rows can never appear acked ⇒ never read "not in `processing_ack`" as "undelivered." Test a status field against a row whose status you know by other means.
- ⭐⭐ `find`/`grep` enumerate a **mount, not a capability** — read `--help` for every verb in scope before claiming you cannot reach X → ties [[feedback_published_negative_env_claims_need_rederivation]].
- ⭐⭐ `ncl sessions messages <id> --json` renders system rows as a **label only** (no payload) — a "provable by any tier" claim about payload content is false; distinguish a *truncation* limit from a *surface* limit.
- ⭐⭐ **Retraction momentum:** a genuine concession buys credibility that gets spent on an uncontrolled follow-on clause in the same breath — any "but/and in fact" after a concession needs its own control before it ships.
- ⭐⭐ A blocked verification call means **UNKNOWN, not UNCHANGED**; attribute a cause only to whoever could observe it (fixer's false "issue still OPEN" + triager's guessed close-timing cause, both relayed by Main) → `learnings/…squash-merge-breaks-ancestry-checks`.
- ⭐ `git merge-base --is-ancestor` returns non-zero after a **squash** merge though the fix landed → [[feedback_squash_merge_breaks_merge_base_ancestor_check]].
- Late `pr_ready_for_review` on an already-merged PR is still dispatched to the approver (merge/close is a defined ledger-join trigger; no prior ledger row existed) → [[feedback_webhook_dispatch_by_event]], [[feedback_debounce_approver_dispatch_deterministic_abstain]].
- Session token hit **GraphQL 401 while REST returned 200** — per-path auth, not an outage → [[project_github_actions_graphql_401_outage]].
