---
type: chain
title: "slang#14489 — SV_Depth silently dropped when fragment main has explicit : SV_Target result semantic"
description: Human-filed missing-validation bug; triaged 11-16, fixer live; GitHub posts parked behind auth outage
tags: [slang, chain, semantic, parameter-binding, miscompilation]
resource: raw/triage-14489.md
---

# slang#14489 — outer `: SV_Target` result semantic clobbers result-struct SV_Depth (silent)

- **Filed:** 11-16 ~06:48Z by human `f1oating`; no labels, no assignees, 0 comments (verified via anonymous read).
  Slang v2026.14.1, Linux.
- **Bug:** `Output main(Input) : SV_Target` returning `struct Output { float4 color : SV_Target; float depth : SV_Depth; }`
  compiles with NO diagnostic but the depth is silently not written (SPIR-V: no FragDepth / `gl_FragDepth`; field
  becomes `Location 1`). Removing `: SV_Target` from the signature restores depth. Plain `float4 ... : SV_Target`
  return is unaffected — only struct-return + explicit outer semantic triggers it.
- **Triage (triager 07:54Z, reproduced on master `cdca151fb` = v2026.22-21-gcdca151fb):** bug / high (silent
  miscompilation, no diagnostic) / frontend parameter-binding / **P2**. Root cause: entry-point result laid out with
  decl = the function, so the signature semantic becomes the "outer" semantic
  (slang-parameter-binding.cpp:3571-3576); the documented outer-wins policy (:2221-2231) then skips every
  result-struct field's own semantic — final layout shows `depth → systemValueSemantic("SV_Target", 1)`.
  Recommended fix: approach A — diagnose the clobber at slang-parameter-binding.cpp:2221 (error/warning when the
  outer semantic overrides a field's explicit system-value semantic). 3 approaches in the triager's brief.
- **[Triage Resolution] 10:34Z — chain complete on the bot side, RESTING on maintainer** review/merge of draft
  PR #14497 (next human action: review, merge, flip out of draft). 11:29Z: fixer's issue comment
  6912309417 verified carrying the full fix report in place (earlier `-f body=@file` had posted the literal path;
  re-posted with `-F`, verified via gh api). Open loose ends: (1) triager's GitHub
  footprint (triage comment, `reproduced`, Type=Bug) — **PERMANENTLY PARKED behind its per-agent connection**
  (final state 16:01Z): restart tried (pre-12:05Z) did not fix it; 12:30Z and FINAL 16:00Z probes both
  `app_not_connected` (12:31Z and 16:01Z reports, connect_url unchanged). Operator alerted twice (09:23Z msg 63,
  12:10Z msg 113) — **no further alerts, no further probes** (probe series closed 16:01Z): the triager
  self-tests on every natural wake and posts on first success; the reviewing maintainer may set labels
  directly. Verified 16:00Z via anonymous read: issue has no labels, only the fixer's comment — footprint
  still absent, as expected; (2) mirror-spelling direction
  flagged as candidate follow-up issue for maintainer judgment.

- **Chain:** triager handed to slang-fixer 07:53Z with full brief + memo; fixer session
  `sess-1794815637177-u3zvhz` on canonical thread `gh-issue-shader-slang/slang-14489` verified active 07:54Z
  (no phantom sessions). Fixer 08:33Z: plan approved (PLAN_REVIEW r1), failing tests written. **Draft PR #14497
  opened 09:13Z** (head `6606f42`, branch fix/issue-14489, "Reject system-value semantics overridden by an
  enclosing semantic", Fixes #14489; pr-mapping row verified → fixer session). PR explanation comment posted 09:16Z
  (6912269807) — GitHub auth restored between 08:00 and 09:13 (watcher's 08:00 fire was gated 401). **[Fix Report]
  09:18Z:** 4 files +245/−9 — new error E39034 `outer-semantic-overrides-system-value-semantic` (diagnostics.lua) +
  check in `processEntryPointVaryingParameterDecl` (slang-parameter-binding.cpp:2246); same-slot redundant spellings
  exempt; 2 test files (8-run diagnostics + FragDepth SPIR-V emit). Tests: repro 8/8 + 1/1 emit; full suite
  12087/12105 (18 environmental: build-scope artifacts + 3 fp8-cuda coopmat that fail identically on master);
  good-case outputs byte-identical to pre-fix. PLAN/CODE/OUTPUT_REVIEW approved (2 advisories applied). Labeled
  `pr: non-breaking`, 2 commits, CI triggered, explanation comment follows head. Fixer's own issue comment posted.
  **[Fix Review Request] dispatched to slang-reviewer** — session sess-1794820732048-pmqxw5 on the canonical thread
  verified 09:18Z; awaiting reviewer verdict, fixer folds it in webhook-driven. **Reviewer verdict 09:42Z:
  REQUEST_CHANGES** (Reviewer A: 0 bugs / 8 gaps / 1 question; Devin: 2 bugs convergent on the top concern; clarity:
  11 candidates). Fixer in R1 edits (per its 09:44Z delivery): making the E39034 exemption per-declaration instead
  of per-visit (array-element re-walk issue); will send round-2 [Fix Review Request]. (09:43–09:44Z triager saw two
  empty-turn bounces from the fixer and reported it "wedged" — false alarm, the fixer's long turn was in flight;
  fixer delivered at 09:44Z and the triager self-corrected 09:45Z. No restart needed.) **R1 fully applied, R2
  dispatched 10:02Z:** new head `0186984f8` (incremental commit, no force-push), E39034 exemption evaluated once
  per declaration per enclosing semantic (array re-walks + Optional/tuple decl-reuse fixed at root), all
  clarity/wording/test asks applied, 15-run diagnostics + FragDepth emit green, diagnostics+spirv+bindings
  2096/2096, good-path byte-identity re-verified. CI run 43844856605; explanation comment updated for new head.
  R2 = final round (two-round rule): APPROVE → [Fix Report] + [Triage Resolution]; residual findings listed in
  the final report either way. **FINAL [Fix Report] 10:33Z — fixer side closed:** two review rounds complete
  (R1 REQUEST_CHANGES applied; R2 APPROVE_WITH_NITS, all nits applied). Final head `0d5034224` (4 files +566/−11,
  5 commits failing-repro-first, no force-push; E39034 via `checkForOverriddenSystemValueSemantic`, once per
  declaration per enclosing semantic, same-slot exemption, `[allow]` opt-out; 18-run diagnostics + FragDepth emit
  19/19; diagnostics/spirv/bindings 2099/2099; good-path byte-identical; CI run 43849838102). **Awaiting human
  maintainer on draft PR #14497** (labeled `pr: non-breaking` + explicit bug-fix rationale in Risk; explanation
  comment follows head; issue comment refreshed in place). Mirror-spelling direction documented as
  accepted-for-now in the check's contract — candidate follow-up issue. [Fix Report] relayed to the triager
  10:33Z (pinned, wake verified 10:34Z) for its [Triage Resolution]; triager's GitHub footprint still behind
  its per-agent connection fix (operator alerted 09:23Z, 12:30Z re-check armed).
- **PARKED behind the 11-16 GitHub auth outage — RESUMED:** auth restored ~09:13–09:18Z (watcher's 08:00 fire
  was gated 401; watcher re-fired 09:20 but only resumed #14001/#13931/#13939 — it skipped the #14489 triage wake,
  and the triager's own one-shot `i14489-gw-recheck-87a7` was cancelled 07:57Z). **I woke the triager directly
  09:21Z**   (pinned `target_session_id` + `thread_id` + `in_reply_to`, delivery verified seq 26 in, session running)
  to post the triage 5-bullet + `reproduced` + Type=Bug. **Triager still blocked: its per-agent GitHub connection
  is `app_not_connected` (the 09:18 restore was per-agent partial — main/fixer vantages work, triager's doesn't;
  retried 09:21/09:22Z). Escalated to operator 09:23Z with its connect_url (agent_name=slang-triager). Park file
  holds the exact on-wake plan; triager will post on connection fix.** Fixer work itself was never blocked.
- Repro lives in triager's `/tmp/opencode-14489/` (root-owned /tmp/opencode workaround). Shared learning appended
  (outer-semantic-wins clobber pattern).
