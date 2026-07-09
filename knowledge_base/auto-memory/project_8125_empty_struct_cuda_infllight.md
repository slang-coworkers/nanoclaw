---
name: project_8125_empty_struct_cuda_infllight
metadata: 
  node_type: memory
  type: project
  originSessionId: ffbf244c-faeb-4852-aa5d-4149319d75a5
---

**#8125** — empty struct in a module's public/exported interface makes the C-like (CPU/CUDA) emitter emit a real 1-byte member while reflection reports size 0 → offset mismatch → SIGSEGV (CPU) / `CUDA_ERROR_ILLEGAL_ADDRESS` (slangpy repro). Assignee/maintainer @jkwak-work; overlaps #7612.

**Authorized 2026-07-08:** jkwak commented "please create a new PR" (issuecomment-4910435580). Triager dispatched fixer for a **draft** PR (`Closes #8125`), canonical thread `gh-issue-shader-slang/slang-8125`. Held for fixer's [Fix Report] (PR # + CI).

**⚠️ LANDMINE — do NOT re-recommend the global approach.** My original authorization brief (from the pre-#11657 2026-06-17 re-triage) described "a focused IR transform removing empty-struct fields + rewriting all uses (FieldExtract→DefaultConstruct, trim MakeStruct, drop stores)." That is **exactly PR #11657's global `removeEmptyStructFields` pass, which CI REJECTED** (broke `Conditional`/`Optional` dyn-dispatch → `layout-conditional-field.slang.4 (cpu)` `non-simple operand(s)!`) and **jkwak CLOSED today**.

**Corrected direction (jkwak's explicit steer, now in fixer's hands):** confine the fix to the existing empty-type legalization — `IREmptyTypeLegalizationContext::isSimpleType`, `slang-ir-legalize-types.cpp:4058` — reconciling the retained-public empty member with the size-0 reflected layout, keeping `layout-conditional-field.slang` green. Reuse the 5-shape test preserved on `origin/fix/issue-8125 @ 3e2492d7fa`.

**Why:** relaying my stale brief as fact would have re-sent the fixer down the rejected path. Triager surfaced the conflict (per [[feedback_admin_standing_rules_precedence]]) — verify a coworker's premise against latest GitHub state before treating a "designed fix" as current.

**Update 2026-07-09 — REDIRECT to adopt PR #10788, not a fresh draft.** Maintainer @jhelferty-nv work-ordered `@nv-slang-bot` (PR #10788 comment 4919480835) to *finish the stale Copilot draft #10788* (branch `copilot/fix-empty-structs-handling`, same-repo, base master) — "adopt the approach; don't restart." #10788's approach = jkwak's exact legalization-layer steer (`isSimpleType()` always legalizes empty structs on non-Metal). Routed THROUGH triager (owns peer-wire fixer edge) on canonical thread; NO fresh `fix/issue-8125` draft. jhelferty's 5 tasks: (1) merge origin/master, (2) confirm layer + CPU/CPP affected, run cpp-compiler + reflection/layout suite, (3) prefer runtime layout test (COMPARE_COMPUTE/-cpu) over filecheck, (4) rewrite body 5-part fixing wrong "Fixes #6308" → **#8125**, (5) `./extras/formatting.sh` + `pr: non-breaking` label.

**Hiccup:** fixer initially DECLINED (msg #32) conflating jhelferty's work-order with the earlier informational jkwak-names-#10788 webhook — "not my chain, different-bot-authored." Triager corrected the inverted premise + re-dispatched. If fixer declines again same grounds → escalate to Main.

**#10788 state as of 2026-07-09 00:45Z (Main-verified):** OPEN, **non-draft** (jkwak-work flipped 00:43Z — MAINTAINER, no breach), MERGEABLE. But fixer work NOT yet landed: body still old checklist (no `Fixes #8125`), no `pr: non-breaking` label, no bot comment, CI RED (test-slang linux/macos aarch64 + rhi + check-pr-label) on the unmodified stale draft. Holding for fixer [Fix Report].

**Mechanics watch:** #10788 authored by `app/copilot-swe-agent`. Fixer must verify push access to the foreign-app branch; if blocked → carrier-PR fallback [[project_fork_pr_carrier_fallback]] + report_pr_created.

Drafts-only guardrail holds [[feedback_drafts_only_guardrail]] — fixer keeps it a draft-state deliverable but PR is already non-draft via maintainer, so do NOT re-draft; ready-flip already done by jkwak, MERGE stays operator/maintainer-gated [[feedback_github_writes_operator_authorized]]. #11657 global-pass landmine still active.
