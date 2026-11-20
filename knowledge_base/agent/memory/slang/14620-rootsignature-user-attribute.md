---
type: chain-record
title: "slang#14620 — HLSL dialect: support RootSignature attributes — MERGED (PR #14623)"
description: Terminal record for the RootSignature attribute chain; PR #14623 merged 02:04Z 11-20 by tangent-vector, issue auto-closed. Includes the E31002 false-alarm lesson (attributes bind to the following declaration).
tags: [slang, root-signature, attributes, reflection, tangent-vector, entry-point, merged]
---

# slang#14620 — [RootSignature(...)] attribute support — TERMINAL (merged)

HUMAN-filed 11-18 23:4xZ by tangent-vector (MEMBER, self-assigned — NOT a stand-down).
Feature request: parse `[RootSignature("...")]` on entry points (was `warning E31000`
unknown-attribute; issue text says "W13000" — stale numbering), validate single string arg,
reflect via `IEntryPoint::getFunctionReflection()->findAttributeByName`. Explicitly out of
scope: root-signature DSL content validation, `ID3D12_ROOT_SIGNATURE_DESC` derivation, binding
influence. 👀 posted; dispatched to slang-triager on `gh-issue-shader-slang/slang-14620`
(triager sess-1795045455967-0vz8e4; fixer sess-1795046081637-lyik1s).

**Maintainer direction (cmt 6995244317, 23:58Z):** "begrudgingly okay with allowing the
user-space [RootSignature(...)] attribute to be accessible to Slang as well. It's probably the
simplest option by far." — closes the triager's flagged judgment call: Approach A (core-module
user-defined `RootSignatureAttribute`, no dialect gate) is blessed for BOTH dialects. Relayed
to the fixer (pinned send, in_reply_to my webhook row 22 — pattern from
feedback_in_reply_to_beats_target_session_id_pin).

**Triage:** feature-request / medium / P2 / frontend + reflection API. Recommended Approach A:
one core.meta.slang declaration `[__AttributeUsage(_AttributeTargets.Function)] struct
RootSignatureAttribute { string value; }` — kills the warning, validates string arg, free
reflection via existing user-attribute API, zero ABI risk (maintainer's own alternative #2).
Existing user-attribute reflection already reaches entry points. Alternative B (builtin
attribute_syntax + HLSL dialect gate) rejected as more surface for no gain. Triage cmt
6995182435; `reproduced` label applied.

**TERMINAL our side 03:14Z 11-19: draft PR #14623** @ head `86a77bb2a`
(https://github.com/shader-slang/slang/pull/14623, branch fix/issue-14620, pr: non-breaking,
explanation cmt 6996571781). 6 files +170/−0, 4 commits (5f7934086 failing repro → 2c224a96e
fix → bb0e374b5 unit-test nit → 86a77bb2a review nits: doc-comment contract, String spelling,
E39999 too-many case, separate E31002 placement test, unit-test result checks). Tests: repro
clean (was E31000); E31001 arity / E30019 type / E39999 too-many / E31002 placement asserted;
suites green (reflection 58/58, diagnostics 1093/1093, unit 688/688, language-server 80/80,
Debug build). Review: slang-reviewer APPROVE_WITH_NITS (A/B/C 0 bugs), nits applied, no new
round; Codex CODE_REVIEW + OUTPUT_REVIEW approve. Maintainer comment quoted verbatim in the PR
Risk section. Ready-flip: weekly-list policy (no per-PR ask). Remaining step: human review.

**Maintainer doc-comment review handled 21:22Z 11-19:** tangent-vector inline direction
(discussion r4635106310) — doc comments need a blank line between brief and details, no
prescriptive compiler-behavior sentences or implementer-facing rationale. Adopted ~verbatim;
struct-form rationale moved to commit message + PR explanation. Comment-only commit
`d41f96a52` (13+/13−) → **head now d41f96a52**, CI re-triggered, thread reply r4635278419,
explanation comment refreshed. Re-verified: repro clean, RootSignature tests 3/3, reflection
58/58, unit 688/688. Awaiting further maintainer review; webhook-driven.

**MAINTAINER APPROVED 23:59Z 11-19:** tangent-vector approved PR #14623 (review
5985342967, empty body, head d41f96a52) — all requirements R1–R6 met, no changes requested.
He had already marked it ready-for-review himself at 20:54:54Z (live isDraft=false — NO
pending operator ready-flip; my initial ready-flip-pending note was stale, corrected by the
fixer's output review). Remaining human step: merge only (Fixes #14620). CI green-pending on
d41f96a52. Issue-thread delta POSTed 00:10Z 11-20 as a PATCH of canonical cmt 6996639975
(one artifact: approval + review linked, "ready (by tangent-vector) and awaits only merge").
On merge/closed webhook: fixer cleans up worktree + sentinel, final report.

**TERMINAL 02:04Z 11-20: MERGED.** PR #14623 merged by tangent-vector at head `d41f96a52`;
issue #14620 auto-closed via the PR body's `Fixes #14620`. Worktree wt-slang-14620 and
sentinel removed (verified gone). Final series: 5 commits — core-module `RootSignatureAttribute`
(Approach A, maintainer's own alternative) + reflection .hlsl test + diagnostics tests
(E31001/E39999/E30019/E31002) + API unit test on
`IEntryPoint::getFunctionReflection()->findAttributeByName`. Peer APPROVE_WITH_NITS applied;
maintainer doc-comment round applied same-turn; maintainer approved → flipped ready himself
(20:54:54Z) → merged. No operator-gated action was ever needed. Canonical artifact: issue cmt
6996639975 PATCHed through its lifecycle (triage → held → approved → merged); explanation
comment current at final head. Durable lesson recorded (memory + shared learnings): the E31002
false alarm — attributes bind to the FOLLOWING declaration; a repro file's premise must be
checked against the saved bytes before flagging a checker bug. Filed→merged ≈ 26 h.

**Incident:** fixer session hit a provider/infra death ~01:20Z ("couldn't answer", #13618
class) while awaiting the reviewer verdict; triager sent retry #1 of 1 with chain-state recap;
fixer recovered, nits applied. Operator visibility posted to orchestrator-dashboard (id 53).

**Side-finding CLOSED 03:35Z 11-19 — disproven, nothing filed.** The fixer's claimed
spurious-E31002 quirk does not exist: its own byte-exact repro files stacked ALL FOUR
attribute uses immediately before `struct S {}` — attributes bind to the following
declaration, so every use was genuinely misplaced (Function-only target) and 1x E31001 +
3x E31002 was the CORRECT output; the "two valid uses on main" premise described a file
shape that was never saved (the fixer misread which decl the attributes attach to). The
intended split shape (3 on main + 1 on struct S) is fully correct on master; peer reviewer
(17 shapes) + triager (8 reconstructions + both byte-exact files on master AND a fresh
86a77bb2a PR-head worktree) all clean. Generic user-defined-attribute checking behaves
correctly in every composition constructed. Stays closed unless a real-world shader hits
an actual spurious E31002.
