---
name: feedback_verify_approver_facts_before_routing_public
description: "When an approver self-reports precision defects, re-derive its load-bearing file:line claims at the pinned head before routing any of it to a public GitHub post"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9160cc5-9eae-40fb-b450-46d6b9841d33
---

When a `*-pr-approver` returns a verdict **and volunteers that its critique gate caught accuracy defects** (line refs copied from diff-hunk positions instead of re-derived at the pinned commit, counts inherited from the harvested bot review, a withdrawn reproducer), treat every one of its `file:line` claims as unverified until you check it yourself at the pinned SHA — *before* routing any of it toward a public GitHub comment.

**Why:** the approver's verdict is auditable by construction (clauses + ledger), but its *narrative facts* are not gated the same way. On #11118 the approver disclosed 3 stale line refs + a wrong test count (10 vs 11 — inherited from the production bot, which I had also propagated in my own dispatch brief). Routing that text onward unchecked would have put a bot-authored comment with wrong line numbers in front of a maintainer, which is exactly the credibility cost [[feedback_never_relay_a_verdict_not_in_hand]] and [[feedback_never_relay_a_verdict_not_in_hand]] exist to prevent. Cheap fix: the files are one `gh api contents?ref=<sha>` + `base64 -d` away — no clone, no build, ~5 calls.

**How to apply:** fetch the specific files at the pinned SHA (`gh api "repos/{o}/{r}/contents/{path}?ref={sha}" --jq .content | base64 -d`), then `grep -n` each claimed symbol/line. On #11118 this confirmed the depth cap really does `return false` at `:3721` and that its own comment conflates cycles with depth (:3713-3714), confirmed `DeclRef<T>::init` really does type-check (`slang-ast-base.h:830-837`, so the bot's "no-op filter" gap is genuinely refuted), confirmed the autodiff test body has no `fwd_diff`/`bwd_diff` call, and corrected the test count from the PR's own file list. Two claims did **not** fully survive contact: the "6 newly-activated `isNonCopyableType` sites" is loose (~4 live call sites repo-wide), and anything resting on an un-compiled trace (container `slangc` couldn't link `slang-glslang`, `E00100`) must stay hedged in public text per [[feedback_authorize_comment_matches_memo_hedging]]. Verified-at-HEAD claims then post freely on the bot's own authority ([[feedback_github_writes_operator_authorized]]).
