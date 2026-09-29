---
name: project_9153_public_by_default_structs
description: "#9153 public-by-default struct members — MERGED 07-22 as PR #12151 (LV-2026 gated); E30604 migration gap shipped as an open design question; approver ABSTAIN→human APPROVE calibration"
metadata: 
  node_type: memory
  type: project
  originSessionId: f00cad78-6d98-4ab9-9c85-a792a90c2555
---

**TERMINAL: MERGED 2026-07-22 21:39Z.** jkwak-work merged PR #12151 (merge commit `4f9d626be234`), and issue #9153 auto-closed. Public-by-default struct/class members ship in Slang 2026. The chain is closed and the fixer has reaped its worktree and branch. Re-engage only on a fresh substantive human comment. Thread: `gh-issue-shader-slang/slang-9153`.

## What shipped

Proposal 1, authorized by jkwak-work on 2026-07-15 (comment 4985648666): in a `public struct`, unmodified members default to `public`, and an explicit `private`/`internal` on a member still overrides that. bmillsNV set a hard gate: the rule applies only at language version ≥ 2026, so pre-2026 visibility is unchanged.

The change sits in the semantic layer, not the parser. The parser already attached `PublicModifier` to `public struct`. The fix is a branch in `getDeclVisibility` (`slang-check-decl.cpp`) that mirrors the existing interface-member rule. After Yong (csyonghe) suggested a simplification, the final form is an unconditional `return getDeclVisibility(parentAggTypeDecl)` for a 2026 aggregate member. As a side effect, a member of a nested private or internal struct now inherits that visibility cleanly instead of tripping the E30601 "visibility higher than parent" cap. The PR has about 13 LOC of semantics, cross-module tests (`public-struct-2025/2026[-lib]` plus a nested-visibility test), and user-guide and language-reference docs. Consumer tests pin `#language slang 2025` to prove the elevation follows the *provider* module's version, not the importer's.

## The E30604 migration gap (open design question, not a defect)

Consider this 2026 module, where `Helper` defaults to internal:

```slang
#language slang 2026
struct Helper { int x; }
public struct Foo { Helper h; }
```

It now fails with **E30604 UseOfLessVisibleType** twice: once on `h` and once on the synthesized `Foo.$init`. Here is why. `getDeclVisibility` raises `h` to Public, then `checkVisibility` (`slang-check-modifier.cpp` ~2360, reached per field through `checkVarDeclCommon`) compares that against the field type's visibility, which is Internal. Before the PR, both were Internal, so the check didn't fire. The same code compiles cleanly at `-std 2025`, under `public module`, or with `public struct Helper`.

The fixer posted the repro and the fork on the PR (comment 5013385417). One option treats this as intended hygiene: add a pinning test and a migration note. The other caps member visibility at the field type's visibility. The maintainers merged without choosing either option, so the question stays parked on the PR. The fixer's pinning test was never committed. The shipped docs don't include an E30604 migration note.

## Approver calibration (recorded)

The shadow approver returned ABSTAIN_POLICY (OPEN_GAP) in three rounds (@`044c1e1b09b0`, `f0371d1dd791`, `049dac19cd73`), each with 6/6 clauses passing and 0 Devin bugs. It never returned BLOCK, because E30604 is fail-safe and opt-in: a stricter error, never a miscompile. jkwak formally APPROVED at `049dac19cd73`, and that exact head merged. The human verdict is stamped on the R3 ledger row. **This counts as a clean resolution of a withheld verdict: the approver and the maintainers agreed. It is not a false-safe.** The approver correctly withheld on a design fork, and the maintainers settled the fork by shipping it.

## Durable lessons

- **Re-verify after a push that touches the cited code.** Yong's refactor rewrote the exact branch that R2 had called "byte-unchanged." The triager's first relay ("fork unaffected") was based only on the fixer's word. A source re-read, then the approver's build at the new head, showed E30604 still fires. See [[feedback_never_relay_a_verdict_not_in_hand]].
- **A COMMENT-state "looks good" is not approval.** Both code owners were positive for days while `reviewDecision` stayed REVIEW_REQUIRED, until jkwak left a formal Approve. The same distinction came up in [[project_12051_descriptor_reuse_pinning]]. A push after approval would have dismissed it, so the fixer correctly held still.
- **The "stall" was a session reap, not a credential outage.** Container teardown killed the fixer at 07-15 23:02Z mid-build, deleting the worktree and its uncommitted edits. Nothing had been pushed, so no 401/403 was involved. The plan report survived, and a clean redo took about 40 minutes. Lesson: commit WIP immediately.
- **A missing peer edge surfaced once.** slang-reviewer was briefly "not addressable" from the fixer, and the triager has no edge to it. The review path later fired without anyone wiring it. See [[project_coworker_named_edge_dropped_silent_hang]]. `report_pr_created` confirmation was chased per [[feedback_verify_report_pr_created]]. The approver stays ledger-only per [[feedback_approver_never_posts_route_reviewer]].
- **A maintainer flipping the PR out of draft is the sanctioned exit from the drafts-only guardrail.** jkwak did the flip on 07-18. The bot never does.
