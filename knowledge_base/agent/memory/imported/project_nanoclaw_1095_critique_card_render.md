---
name: project_nanoclaw_1095_critique_card_render
description: "slang-coworkers/nanoclaw#1095 critique-gate card render — 3 findings: relative session link never linkifies (md() needs a scheme), `released` counts admin intent not release, mobile drops Approve-once; reviewed inline, comment 5200778885"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1095
---

**slang-coworkers/nanoclaw#1095** — `dashboard: render critique-gate cards with the PR, session and
provenance`, author **`szihs`** (human), base **`nv-dashboard`**, branch
`fix/nv-dashboard/critique-card`. 4 files, +266/−2. Head `71eea1e4`, base `d858d9ac` (clean rebase,
merge-base == base tip). `ci` + `label` both green (ci was `pending` at first read, `pass` 2m14s at
publish). Reviewed 08-06, comment **`5200778885`** — posted via **`gh api .../issues/N/comments`**
after `gh pr comment` failed `GraphQL: Resource not accessible by integration (addComment)`
(see [[feedback_gh_pr_comment_graphql_fails_where_rest_succeeds]]; the REST fallback works).

**ROUTING: handled INLINE by Main — ~23rd instance** ([[project_nanoclaw_pr874_webhook_route_approver]]).
NanoClaw platform-infra fork; no `nanoclaw-pr-approver` exists and slang/slangpy approvers are
repo-scoped ⇒ would `ABSTAIN_POLICY`. **Dashboard-render companion to #1092**
([[project_nanoclaw_1092_critique_gate_resolved_wedge]]), which I reviewed 08-05.

## 🔴 Finding 1 — the relative session link never becomes a link (the PR's own central claim)

`app.js:5404` emits `` · [session](?session=<id>)`` into a string that goes through `md()`, whose
link rule **requires a scheme** (`app.js:3280`: `/\[([^\]]+)\]\((https?:\/\/[^)"]+)\)/g`). No match ⇒
renders as literal `[session](?session=sess-…)` brackets. PR body says *"Both ends link"*; the PR
link works, the session does not. **Second layer: `?session=` is not a route** — sole occurrence in
the file, no `URLSearchParams`/`location.search` consumer. House idiom is
`openSessionFlowById(group, sid)` off a delegated data-attribute click (`.tl-session-link`,
`app.js:4049-4055`). Suggested an anchor + `data-session-id` handled in the same listener this PR
already extends for `.reason-more`.

⭐⭐⭐**FOUND ONLY BY RENDERING, NOT BY READING.** The diff line looks obviously correct — a markdown
link with a real id in it. Harvested `esc`/`md`/`clampedReason`/`critiqueProvenance`/
`renderApprovalItem` out of the head `app.js` via brace-matching into a `new Function` sandbox and
called it with the producer's payload. ⇒ **For a template-string renderer, execute the template; a
diff read cannot tell you what a downstream regex will refuse to match.**
⚠️Harness needed 3 fixes first (`REASON_CLAMP`, `NANOCLAW_TZ`, `_tzSameDay` all undefined out of
their closure) — each an obvious `ReferenceError`, i.e. **loud harness failures, not silent wrong
answers**, unlike the #1092 harness bugs that read as findings.

## 🟡 Finding 2 — `released` counts admin INTENT, not enforcement release (breaks in both directions)

The endpoint's headline number is defined (its own comment, and migration 932's header) as deliveries
admitted with the requirement unmet. But `approved` is recorded **when the admin clicks** —
`applyBypassApproval` (`src/modules/critique-escalation/index.ts:233-234`) writes `resolved:'approved'`
and the `approved` row together, *before* the grant is used. #1092 made the grant one-shot + TTL ⇒ the
two come apart:
- **Over-count:** grant expires unused → hook's expiry branch (`gate-critique-on-deliver.sh:250-255`)
  prints *"EXPIRED unused — requirement still enforced"*, never calls `stamp_failed_open`. 0 deliveries,
  `released` already 1.
- **Under-count:** grant consumed → hook calls `stamp_failed_open` (`:258`) which stamps
  **unconditionally, never consulting `resolved`** (`:219-229`), but the host sweep returns first:
  `if (!esc || esc.resolved) return;` (`index.ts:285`). `failed_open` row never written.

**Same `resolved`-double-duty root cause as my #1092 Finding 2 — CONFIRMED STILL LIVE on `nv-main`.**
Simulated both paths against the real control flow: consumed → `["approved"]` (ingestion reported
`SKIPPED (resolved guard)`); expired-unused → `["approved"]` with zero deliveries. Kill-switch path
(`CRITIQUE_ESCALATION=0`) records correctly. ⇒ the **human-authorized** release is the one class that
never lands as `failed_open`. Framed as arguably #1092's bug, raised here because **this** PR makes
the number load-bearing.

## 🟡 Finding 3 — mobile drops the safety-bearing label

`mobile.js:459` still reads **`Approve`**; PR body claims the button reads `Approve once` "matching
the one-shot grant". Also desktop-only: `critiqueProvenance` (the context offered *in place of* the
removed countdown) and the clamp expander (mobile hard-slices at 180, tail unrecoverable). ⇒ the
quick-approval surface is the one not saying the grant is one-shot.

## ✅ Verified positively (each by execution, not assumption)

- **Tests pass AND are not inert.** Base `d858d9ac`: **5 failed / 80 passed**; head: **5 failed /
  83 passed**. The 5 are pre-existing export/import failures in MY env (untouched by this PR, none
  are the new tests) — measured on both sides rather than assumed. **Negative control:** stripped
  just the new identity block from the mapping → identity test fails on `a.sessionId`.
- **Payload keys match the producer field-for-field** vs `requestApproval` (`index.ts:380`);
  `class`/`denials`/`selfHealAttempts` correctly `typeof`-guarded so `0` isn't coerced to `null`.
- **Escalation SQL matches migration 932's real schema** — read the migration, not the test's inline
  DDL. ⚠️**932 lives on `nv-main`, NOT on this PR's base `nv-dashboard`** ⇒ the graceful-degradation
  path is the live one until the branches meet. `days` clamped 1–90; `sqlite_master` probe + catch.
- **`requireAuth`-only is consistent** with `/api/sessions`, `/api/coworkers`, `/api/hook-events`,
  `/api/tasks` — checked before flagging. Looser than sibling `/api/approvals` (`is_admin`), but that
  gates a per-group scope, not secrecy ⇒ **not a finding**.
- ⭐⭐**Double-escaping (`esc()` → `md()` ⇒ `&`→`&amp;amp;`) is PRE-EXISTING, not charged to this PR.**
  Rendered `request_rebuild` + the generic fallback with the same adversarial input; both do it
  identically. ⇒ **before reporting a defect in a new branch, run the same probe against the old
  branches — an inherited house pattern reported as a regression is a false finding.**

**RESUME:** maintainer (`szihs`) owns merge. Watch for `synchronize` — re-fetch head and re-run every
measurement before restating anything ([[project_nanoclaw_1092_critique_gate_resolved_wedge]]: my
#1092 headline finding evaporated mid-review that way). If Finding 2 is accepted host-side, the fix
lands in `src/modules/critique-escalation/index.ts` ordering, not in the dashboard.
