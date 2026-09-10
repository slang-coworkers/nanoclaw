---
name: project_nanoclaw_1172_panel_tests_unreachable
description: "nanoclaw#1172 (szihs) KB-doctor dashboard panel — MERGED 3m48s after opening. Reviewed INLINE, comment 5239176967. 2🔴 are ONE defect: 4 of 7 new tests feed doctor blocks the route can NEVER emit ('ok' not in the status vocabulary), and because fixtures are hand-written the suite cannot see a route→panel rename that renders 'drift 0' above 4 drift findings. Fix verified in 4 directions."
metadata:
  node_type: memory
  type: project
  originSessionId: 64fa879e-84d1-406f-bf3d-3f04e839f951
---

# nanoclaw#1172 — "render the KB doctor report, which nothing has ever displayed"

PR https://github.com/slang-coworkers/nanoclaw/pull/1172, author **szihs**, base
**`nv-dashboard`**, head **`ad01f768a`**, merge-base `6e6b78b7f`, **2 files +211/−0**
(`dashboard/kb-doctor-panel.test.ts` new 108, `dashboard/public/app.js` +103).
**MERGED `a6280de4a` at 10:17:59Z — 3m48s after opening (10:14:11Z).** Both blobs on
`nv-dashboard` byte-identical to the head I measured, so findings are live.
`ci`+`label` green. My comment **`5239176967`** via
`gh api repos/.../issues/1172/comments --method POST --input <json>`.

**Routing: INLINE by Main.** Generic `pr_ready_for_review` *"route to `*-pr-approver`"*
string again; no nanoclaw approver wired. [[project_nanoclaw_pr874_webhook_route_approver]].
Direct sequel to [[project_nanoclaw_1169_fixture_not_verbatim]] /
[[project_nanoclaw_1121_kb_doctor_artifact]] / [[project_nanoclaw_1076_kb_doctor]].

## Body verified, both tamper claims reproduced

`grep -c doctor` on merge-base app.js → **0** ✓. Tamper A (unavailable renders a zero) →
reddens *says UNAVAILABLE rather than showing a zero*; Tamper B (fold unknown into drift)
→ reddens *shows unknown as its own count*. 7/7 at head. Full `dashboard/`:
**144 passed / 2 failed**, and both failures **byte-identical at base** (137/2) — the
baseline control that made the 🔴-2 construction meaningful.

## 🔴 The two findings are ONE defect: hand-written fixtures pin the panel against itself

**(a) 4 of 7 tests feed unreachable states.** Fed each literal through
`readKbDoctorArtifact`: tests 4/5/6 use `status:'ok'`, but `KB_DOCTOR_STATUSES` is
`['clean','drift','unknown']` (`kb-doctor-artifact.ts:28`) and the producer's line 367
emits only those three — **`'ok'` exists at neither end**. Test 3 pairs `complete:true`
with `unknownCount:3`, rejected by name at `:180`. Control: legal clean and legal
`unknown`+`complete:false` both return REACHABLE.

**(b) therefore the suite cannot see a route→panel break.** Renaming `driftCount` in the
emitted view consistently across artifact + its 22 tests + `server.ts` + `server.test.ts`
leaves the **whole suite at baseline 144/2**. End-to-end through the real validator and
real panel from a 4-drift artifact:

```
KB doctor — drift · 1h ago   drift 0   unknown 0
  builder: prod .learnings_wiki.py differs
  group-skills: 10/14 stale
```

`Number(undefined) || 0` — **`drift 0` above four drift findings**, the exact false zero
`kb-doctor-artifact.ts:143-148` was written to refuse, reintroduced at the layer this PR
added and invisible to the suite this PR added.

⭐⭐⭐ **A test that builds its input by hand tests the consumer against ITSELF, and the
producer boundary is exactly where the false zero re-enters.** The reachability probe is
cheap (feed each fixture to the validator) and would have caught both halves.

## The fix was verified in FOUR directions before publishing

118-line patch: build every `doctor` block via `readKbDoctorArtifact` from a
producer-shaped artifact + `expect(v.available).toBe(true)` so an illegal fixture fails
loudly. (1) **7/7 green at head** — asserts no behaviour change; (2) **catches the rename**
(*lists the drift findings* reddens, `drift 0` in the diff); (3) **both original tampers
still redden** — the *"does it still catch what it caught"* leg I skipped on #1169;
(4) full suite stays at baseline. Saved at
`/workspace/agent/pr1172-proposed-panel-fix.patch`. ⭐⭐ On #1169 I proposed a one-liner
that turned the suite `7 failed | 15 passed` **after having run it myself**; here I ran
direction (3) explicitly because of that.

## 🟠 Two coverage/gating findings, both CONSTRUCTED

- **XSS test validates a stand-in.** `loadPanel()` injects its own `esc`; neutering the
  **shipped** `esc` (`app.js:3570`) to `String(s||'')` leaves **7/7 passing**. Docstring
  claims it tests shipped code — true of `kbDoctorHtml`, false of the escaping. Shipped
  `esc` *is* correct today (verified) ⇒ coverage hole, not a vulnerability.
- **Panel gated behind `/api/funnel` 200.** `kbBox` at `app.js:471` sits inside
  `if (detail)` (424) inside `loadFunnel()`, below both early returns (391/396). Stub
  DOM+fetch: 200→YES, 404→NO, 500→NO. `/api/funnel` 404s when `reports/funnel.json` is
  absent (`server.ts:5359`). The own-container/own-catch reasoning is right *within* the
  block and does not reach the returns above it.

## 🟡 The remediation string names a schedule and a script that don't exist here

`app.js:510`: *"Runs daily at 05:50; `python3 scripts/kb-doctor.py` to produce one now."*
**`scripts/kb-doctor.py` is absent from `nv-dashboard`** (nv-main only; nv-dashboard's
path-guard allowlist is `dashboard/**` + named files). **05:50 is a COMMENTED crontab
proposal** — `cron-run.sh:36` on nv-main says *"kb-doctor is scheduled NOWHERE today"*,
and szihs's own `docs/deployed-closure-verification-2026-08-10.md:109` confirms prod has
no entry. Three cadences in play: `05:50` (this string, its only occurrence in the tree),
`05:45` (`kb-doctor-artifact.ts:31`), and none-scheduled (reality). ⇒ the PR's own
`driftCount: 4` prod evidence came from a **manual** run; nothing rewrites the artifact,
so it will age past `DOCTOR_STALE_HOURS=36` into `stale`.

## 🟡 Extractor + prettier

Brace-walk counts braces **inside string literals**: `const openBrace = '{';` (valid JS,
`node --check` passes) → `Tests: no tests`, *"must be brace-balanced"* — fails loudly, so
acceptable; a **balanced** pair in a `<style>` string is survived by luck (7/7 still pass).
Body's *"`prettier --check "src/**/*.ts"` clean"* is accurate but covers **neither changed
file** — `format:check` is `src/**` only; both changed files fail prettier directly, and
`app.js` + `server.test.ts` fail at base too.

## Method notes

`git worktree add -d <sha>` (detached), ref re-verified unchanged after — the #1169
branch-name worktree moved a ref and produced 503 files for a 5-file PR. `node_modules`
symlinked from `nanoclaw-kb`. Every tamper restored + `git status` verified between probes.

**RESUME** = szihs replies to `5239176967` ⇒ offer the saved patch for 🔴1+2; 🟠3 is ~12
lines (extract the shipped `esc`), 🟠4 moves `detail.appendChild` above the early returns.

See also [[project_nanoclaw_1160_empty_state_torn_publish]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_control_the_instrument_not_the_reasoning]].
