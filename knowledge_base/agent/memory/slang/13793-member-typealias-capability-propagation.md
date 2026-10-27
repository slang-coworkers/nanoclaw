---
type: chain
title: slang#13793 — member typealias capability requirements don't propagate to the enclosing struct
description: Opened 10-20 21:50Z by kaizhangNV (MEMBER, the assignee). Triaged in 31 min, so it fails R6. The fixer was dispatched. The reporter's own PR #13798 (10-21 02:47Z) superseded it, and the chain was abandoned 10-21 03:56Z. Terminal unless a webhook arrives. 10-21 17:32Z: jhelferty sent the design question to tangent-vector and skiminki-nv; 10-26 17:08Z: kaizhangNV (sole assignee) to document the desired behavior. Both held.
---

# slang#13793

**State: terminal (abandoned, superseded by human PR #13798).** No bot PR exists. The resumable artifact is the triage
comment [6303080098](https://github.com/shader-slang/slang/issues/13793#issuecomment-6303080098), last edited
10-21 03:57Z. It hands review over to #13798 and @-mentions kaizhangNV. Labels: `reproduced`, Type=Bug.

## Finding (triager's)

`SemanticsDeclCapabilityVisitor` has no `TypeDefDecl` case, so it falls to `visitDecl {}`. A struct's capability set
comes only from the `[require]` declared on it and its parents (`visitContainerDecl` / `getDeclaredCapabilitySet`,
slang-check-decl.cpp). P2, not a regression (2026.13.1 behaves the same).

## Outcome

- The fixer's fold design failed its own self-review. `struct Foo : IDifferentiable { typealias Pair = DifferentialPair<Foo>; }`
  hits a fatal E40002 cycle. #13798 takes the same fold approach and adds a `visitDeclaredSubtypeWitness` guard.
- The triager measured #13798 at `18bbd1d46`; I did not check these myself. Four shapes that compile cleanly on master
  now error: an extension method (E36100), a multi-target interface conformance (E36118), a body method (E36108), and
  disjoint aliases in an unused struct (E36100). On master, the first three give the same errors as an explicit
  `[require(metal)] struct`. The fourth has no master equivalent. These shapes are posted on the issue; the decision
  belongs to kaizhangNV. Scratch files: `/workspace/agent/scratch-13793/`.
- The fixer's use-site prototype is **partial**, per the triager's 03:57Z correction. It avoids the four errors but does not
  add the alias requirements to `Context` itself, and it misses generic `Context<int>` until #13616 lands. The prototype was
  never posted, and the fixer has cleaned up its worktrees and branch.
- #13798 moved to `743612712` at 03:57Z; that commit adds generic member aliases (`maybeGetInner`). Nobody has re-run
  the four shapes at that head.

## Inbounds after close

- **10-21 17:32Z `pr_mention` from jhelferty-nv (MEMBER), comment [6322363809](https://github.com/shader-slang/slang/issues/13793#issuecomment-6322363809):**
  *"Needs further discussion per Tess. Adding @tangent-vector and @skiminki-nv"*. The comment does not mention
  @nv-slang-bot; the `pr_mention` label comes from the router, not from the comment text. This is maintainers routing work
  among themselves, the same shape as the #12339 and #13498 pings, and it asks us nothing. Assignees are now tangent-vector,
  kaizhangNV and skiminki-nv. #13798 is still open at `743612712` with no review decision. **Held: I dispatched nothing
  and posted nothing.** The open semantics question (does a member alias restrict the struct's own extensions, conformances
  and methods, or only its use sites?) is now a design discussion among those three maintainers.
- **10-26 17:08Z `pr_mention` from jhelferty-nv, comment [6422405634](https://github.com/shader-slang/slang/issues/13793#issuecomment-6422405634):**
  *"next steps: @kaizhangNV to follow up on documenting desired behavior."* Again there is no @nv-slang-bot mention, and
  this is the same maintainer-routing shape. tangent-vector and skiminki-nv are no longer assignees; kaizhangNV is the
  only one. #13798 is still open at `743612712`, not merged and with no review decision. **Held: nothing dispatched, nothing posted.**
- **Resume when:** a comment addresses @nv-slang-bot or asks the bot something, the design is decided and someone asks
  for the bot's help, or #13798 merges or closes.

## Lessons

- **Before dispatching a fixer, check the issue timeline for a PR from the reporter or assignee.** Here the reporter
  was also the assignee and a MEMBER, and their PR appeared 5 h after the issue. This is the case the R6 four-day wait
  (nanoclaw#1993, still a draft) exists to prevent. Until that gate merges, routing does not apply the wait.
