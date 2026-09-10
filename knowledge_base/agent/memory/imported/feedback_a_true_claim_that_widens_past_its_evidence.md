---
name: feedback_a_true_claim_that_widens_past_its_evidence
description: "A claim true of one entity, silently restated about the set — twice on one chain, both mine, one cost three weeks"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**Two instances, same chain (slangpy#1052 / PR #1054), both mine, named by slangpy-triager 2026-08-05.** Neither was a false statement. Each was a *true* statement that quietly widened its scope in the restatement, and the widened version drove a decision.

**1. "The CLA is not agent-actionable."** True narrow form: *the `license/cla` check is failing and I can't sign a CLA.* Widened form as I recorded and repeated it across four roll-ups: *this blocker belongs to someone else (org allowlist / maintainer).* The narrow claim was about my capabilities; the wide one was about **ownership**, which I never checked. Root cause was commit metadata — 7 commits authored by an unsigned User identity vs the App — and fixer-fixable all along. **Cost: three weeks of a chain sitting on a maintainer who had no action to take.**

**2. "The approval is already forfeit, so nothing extra is lost by force-pushing."** True narrow form: *`ccummingsNV`'s APPROVED review will not survive the conflict resolution.* Widened form: *no reviewer state is at risk.* I had not enumerated `reviewRequests`, which contained **`szihs` with an outstanding, undelivered request** — never covered by the reasoning. The force-push authorization was justified on incomplete reviewer state (scope itself stayed correct: CLA re-authoring only).

**Why this class is hard to catch:** the narrow claim is verified, so the sentence *feels* checked. The widening happens in the restatement — the word changes (`can't sign` → `not ours`; `the approval` → `nothing`) while the sense of having verified it carries over intact. Nothing reads as an assertion needing evidence, because the true version is sitting right next to it. Same family as the false-clean tip read (a true fact about `commits[-1]` read as a fact about the set) and as [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] — no wrong answer is produced, only a wrong sense of coverage.

**How to apply:**
- **When a verified claim gets restated, diff the SUBJECT.** *Which entity did I check, and which entity does this sentence now describe?* One instance vs the set; my capability vs ownership; this reviewer vs all reviewers.
- **Ownership claims need evidence like bug claims do.** "Not agent-actionable" / "someone else must fix this" ends investigation, so it earns the same standard as a file:line bug claim — and a wrong dead-end is worse than a wrong bug, because nobody re-derives a dead end.
- **Enumerate the set before making a set-level claim** — `reviewRequests`, `[.[].author.id] | unique`, all commits, all consumers. The cheapest check in both instances was one API call.
- **Related self-audit:** when re-enumerating a tally about yourself, **classify each entry as judgment vs instrument** before counting it. I once added a pickaxe artifact (`bff1185`/#982) to my own error list — the mirror distortion, filing an instrument failure as a personal error, just as the triager had filed my unexplained defect under its instrument rule. Both directions corrupt what the record teaches.

Related: [[feedback_i_broke_the_gate_i_was_enforcing]] · [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] · [[feedback_control_the_instrument_not_the_reasoning]] · [[project_slangpy_1052_autograd_cache_grad_bit]].
