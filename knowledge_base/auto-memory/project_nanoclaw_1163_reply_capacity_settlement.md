---
name: project_nanoclaw_1163_reply_capacity_settlement
description: "nanoclaw#1163 (F15, closes my #1123 findings) settle-by-reservation-id + stop refunding on age. Reviewed INLINE by Main, MERGED mid-review (all 7 blobs identical). State machine sound (7,380-seq sweep, 0 violations) but 🔴 the operator recovery command cannot reach the prod daemon and reports success. Comment 5237035700. TERMINAL, 3 follow-ups offered."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1163
---

# `slang-coworkers/nanoclaw#1163` — "discord: settle reply capacity by reservation id, and stop refunding on age (F15)"

Author **szihs**, branch `fix/nv-slang/reply-capacity-settlement` → **`nv-slang`** (correct base — `container/mcp-servers/**` is absent on nv-main), base `2e8015f5` (= #1123's merge), head **`d83b1844`**, 7 files +665/−46. **Reviewed INLINE by Main** — standing rule, ~32nd instance: nanoclaw fork has no approver wired, the `pr_ready_for_review` generic *"route to the project's `*-pr-approver`"* is overridden. See [[project_nanoclaw_pr874_webhook_route_approver]]. Comment **`5237035700`** via REST (`POST /issues/N/comments -F body=@file`).

**Closes findings from MY OWN #1123 review** ([[project_nanoclaw_1123_reply_capacity_refund]]) ⇒ verified by execution + ran an adversarial pass on my own draft rather than rubber-stamping a fix to my own report.

**MERGED 06:26:11Z mid-review** (`8b3c32a9`, szihs). Re-fetched: all **7 changed files byte-identical between reviewed head and merged tree by blob hash** ⇒ every measurement applies to `nv-slang` as it stands. 🔴 reframed as follow-up, not blocker.

## What reproduced (real venv, `uv sync --frozen` + `uv run pytest -q`, both trees, separate `.venv`s)

- head **`95 passed, 5 skipped`**; base **`2 failed, 77 passed`** (both `test_discord.py`, the drift he describes) ⇒ his "the suite was RED on a clean checkout" is true.
- Revert-only-`reply_capacity.py` drill: `-k "not admin"` → **16 failed** = his figure exactly; full file → 19 (4 admin tests aren't in his 26, module is new). His **3/13** harness-artifact split is exactly right.
- Test set difference: **17 added, 1 removed** (`test_abandoned_reservation_stops_counting_after_the_ttl` — the test that encoded the P1), 14 → 30.
- ruff: added files clean, `src/` 15 errors — both claims true. CI green 3/3 (`python` job 15s on head sha).
- **Exhaustive sweep** (mine, not his): all 7,380 sequences len ≤4 over `{pending,accepted,failed} × {a,b,None}` — 0 negative counters, 0 accounting non-idempotency over `(accepted, failed, pending, settled, charged)`. **The state machine is genuinely sound.**

## 🔴 The finding: the operator command cannot unstick the prod daemon

Full lesson → [[feedback_audit_the_compensating_control_not_just_the_fix]]. Short form: `feedback_collector.py` (prod daemon) calls `_load_thread_state()` **once** (`:458`) and never re-reads; `reply_capacity_admin.settle` only appends (`:134`). Measured: after settling 15, log-derived charged **0/15** and `admin list` exits **0** ("clean"), daemon still **15/15** with gate shut; only restart applies it. Since the charge is now permanent *by design*, the mode moved from unsound-but-self-healing to **wedged, with the recovery tool reporting success.** `discord.py` re-reads per call ⇒ unaffected (15/15 → 0/15).

⚠️**Told him NOT to just add a reload:** naive in-place `_load_thread_state()` **double-counts** — legacy `bot_reply` rows have no id so `apply_event` increments unconditionally by design (measured 2 → **3**); needs `clear()` + replay (safe: 2).

## 🟡 ×3

1. **The promised "alert" doesn't exist.** 0 consumers of `unresolved_ids()`/`unresolved_reply_count` in `src/` outside their own definitions; absent from the startup summary (`:194`) that already reports its sibling `failed`. Also: the body promises *"explicit state, an alert, and an operator command"* but its own three bullets are explicit-state / operator-command / **no-privileged-path** — the alert quietly became something else.
2. **My primary #1123 P1 is unfixed but INHERITED.** 5s `ClientTimeout` → `False` → `reply_failed` for a reply ingress accepted-and-recorded. Slow-ingress probe on **both** trees: received 4, charged **0/15**, 4 `reply_failed` rows — identical ⇒ not introduced. Flagged because the PR's own reasoning ("log cannot infer outcome from elapsed time") applies verbatim. `reservation_id` **is** genuinely on the wire (verified True at head, False at base).
3. **`settle` gates on `pending`, not `unresolved_ids()`** (`:107`) ⇒ can settle a seconds-old in-flight reservation. Both races land; state machine recovers (`conflicts=1`) but premature `--accepted` + real failure = **quota spent on an undelivered reply** = F15 in miniature. *(This one was the adversarial pass's catch, credited as such; I reproduced both directions.)*

## Ownership caveat — drilled, he's right

Ran nv-main's own matcher (`.github/nv-path-guard/ownership.py` + `nv-main.txt`) then `merge-train.sh`'s overwrite loop verbatim on a real checkout: `.github/workflows/ci.yml` **is** owned **and exists** on nv-main ⇒ overwritten, post-canon `python:` job count **0**. `container/mcp-servers/**` is owned by pattern but **absent on nv-main** ⇒ overlay-NEW branch, untouched (`reply_capacity.py` byte-identical). **Code lands and stays; the job that proves it works is deploy-scoped.** nv-main `ci.yml` is 239 lines vs nv-slang's 198 ⇒ companion PR wants authoring against nv-main's copy, not a cherry-pick.

⛔**My first canonicalization drill failed to clone and printed "python job: GONE / reply_capacity_admin.py: GONE" from a MISSING CHECKOUT** — both lines *supported the conclusion I was testing for*. Caught it, re-ran on a real checkout. Classic instrument-fails-toward-the-finding.

## Nits status vs #1123

`_read_thread_state` **still 3 calls/forward** (`:643/:653/:680`), still no log rotation anywhere (grep 0) — now *more* relevant since unsettled reservations are permanent rows. The conditional-expression-for-side-effect nit **is fixed**.

**RESUME = none; terminal.** Merged, green, review posted. Three follow-ups offered as one small PR (daemon-effective settle / wire the alert / gate on `unresolved_ids`); timeout case is separate + inherited.
