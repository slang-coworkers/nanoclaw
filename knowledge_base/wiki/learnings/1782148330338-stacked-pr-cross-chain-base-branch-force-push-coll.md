---
title: "Stacked-PR cross-chain base-branch force-push collision (slang #11595/#11596): detect, DON'T force-push back, freeze + escalate to orchestrator"
type: learning
topic: slang-compiler
source: learnings/1782148330338-stacked-pr-cross-chain-base-branch-force-push-coll.md
---

# Stacked-PR cross-chain base-branch force-push collision (slang #11595/#11596): detect, DON'T force-push back, freeze + escalate to orchestrator

When two parallel chains work a stacked-PR pair where one PR's branch is the OTHER's base, a force-push of the shared base branch by the stacked chain — especially from a STALE checkout — silently clobbers the base chain's rebased work. This is a cross-chain hazard the individual chains can't prevent alone.

**Concrete case (2026-06-22):** Slice-2 PR #11595 owns branch `fix/issue-11591`; Slice-3 PR #11596 (`fix/issue-11592`) is **stacked on it** (`base=fix/issue-11591`). The Slice-2 chain had rebased `fix/issue-11591` onto current master (`8adee03c0`, 06-18). Four days later the Slice-3 source force-pushed `fix/issue-11591` back to the OLD 06-16 combined stack (`eda63ff9b`), reverting it to BEHIND-by-32 / "would revert ~137 unrelated files" as a merge diff.

**Detection signals (all GitHub-observable):**
- PR timeline `head_ref_force_pushed`: actor = shared bot identity, commit_id = an unexpected/old SHA, NOT your session's last push (compare to your known head).
- The force-pushed commits are OLD-dated (here all 06-16) → a stale-checkout re-push, not fresh work.
- A sibling PR with `base=<your-branch>` updated at the IDENTICAL timestamp as the force-push → that's the colliding (stacked) chain.
- `mergeStateStatus: BEHIND` + large file delta vs current master.

**Handling (restraint is the whole game):**
- **DO NOT force-push back to your rebased SHA** — that reverse-clobbers the stacked chain's base and starts a force-push war. Stale-but-stable + both chains holding = no war and (for draft, ready/merge-gated PRs) no merge risk. Sitting still is the safe state.
- FREEZE the branch; escalate to the ORCHESTRATOR. Cross-chain de-confliction is the orchestrator's domain — a chain can't/shouldn't puppet a sibling chain, and isolation rules prevent inspecting sibling worktrees. The orchestrator owns the coordinated rebase onto current master across both branches once the structure decision lands.
- **Make GitHub honest now:** edit-in-place the live maintainer decision-request comment with a factual stale-state note (base reflects a stale combined stack from a collision with the stacked PR; branch paused; will rebase onto current master) so the maintainer isn't misled by the BEHIND/revert diff. Consolidate into the existing comment (don't stack a new one) when the bot is still last commenter.

**Source-attribution caveat:** a force-push by a shared bot identity may come from an IDLED/phantom session, not a live reachable chain. Signal: if the orchestrator's message addressed to the sibling chain's thread COLLAPSES into your session, there is no distinct live sibling session for the router to deliver to. Infer intent from GitHub evidence (commit dates, absence of a combine announcement) — here "accidental clobber from a stale stacked checkout, not an intentional combine" — but DON'T overstate a GitHub inference as a session-state claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782148330338-stacked-pr-cross-chain-base-branch-force-push-coll.md`_
