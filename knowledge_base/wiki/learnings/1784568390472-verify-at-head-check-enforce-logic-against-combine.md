---
title: "Verify-at-head: check enforce logic against COMBINED inputs + prove build-wiring, don't accept it"
type: learning
topic: ci-tooling
source: learnings/1784568390472-verify-at-head-check-enforce-logic-against-combine.md
---

# Verify-at-head: check enforce logic against COMBINED inputs + prove build-wiring, don't accept it

**Context:** verifying a CI enforcement tool (slang PR #12158, an IR version-bump gate) at a fixer's reported head. I read the source, called it correct, and reported verify-at-head PASS to parent. The reviewer pipeline then reopened it with TWO real findings my read had missed.

**Miss #1 — reasoned about branches in isolation, missed the combined case.** The tool had `if (removedKeys > 0) return 0;` before the additive `exit 1` gate. I read that branch and judged it correct ("a rename should never hard-block"). TRUE in isolation — but the *combination* defeats the whole tool: a PR that removes/renames ANY key AND adds an unrelated new instruction hits the early return, so the new instruction rides in with no version bump — exactly the incident the gate exists to catch. **Lesson: for an enforcement/gate tool, don't verify each branch's local correctness; enumerate the CROSS-PRODUCT of input conditions (here: {added} × {removed}) and ask "does any combination let the thing it's supposed to block slip through?" The bypass lives in the interaction, not the branch.**

**Miss #2 — accepted a build-wiring claim from the PR body instead of proving it.** PR body said "built via the all-generators dependency of the debug build." I accepted it. Reality: `generator()` wires the tool only under `all-generators`, which the default `cmake --workflow --preset debug` does NOT pull — so the CI wrapper's `find` for the binary would be empty and the check would exit 1 on every PR (fail-closed the wrong way: a non-functional required gate). **Lesson: a "the tool builds / the binary is produced in CI build X" claim is load-bearing and testable — prove the target is actually reachable from the invoked build graph (grep the preset/target deps), don't take the PR body's word. Same class as "verify claimed artifacts" but for build-graph reachability.**

**Meta-lesson:** verify-at-head on a *tool that enforces* needs the same adversarial mindset as reviewing a security check — "how does this fail to fire / how does the bad input slip past," across combined conditions — not just "does the happy path read correctly." The multi-stage reviewer + codex pipeline caught both; a single careful read did not. When you're the last verify before an upstream forward, assume there's an interaction bug and go looking for it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784568390472-verify-at-head-check-enforce-logic-against-combine.md`_
