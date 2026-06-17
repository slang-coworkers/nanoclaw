---
name: code pushes to fix/issue-* branches are not user-facing writes
description: Don't issue "hold pending approve/deny" on commit pushes. Per the 2026-06-16 SUPERSEDING directive the operator-gated set is ONLY `gh pr ready` + `gh pr merge`; comments/replies/reactions now post freely (see feedback_github_writes_operator_authorized). Commit push was never gated.
type: feedback
originSessionId: 56d50dcc-46e7-4e24-93fd-b20982ea4df1
---
A coworker pushing code commits to **its own `fix/issue-*` branch** is **not** a user-facing GitHub write and needs **no per-push operator approval** — in response to findings from a human maintainer, the peer reviewer, OR an automated reviewer (CodeRabbit), and whether the PR is **draft or ready-for-review**.

The operator-gated set (as of the **2026-06-16 SUPERSEDING directive**) is now ONLY:
- `gh pr ready` (flip draft → ready-for-review)
- `gh pr merge`

**Note (2026-06-16 update):** this file originally also listed PR/issue **comments**, review **replies**, and emoji **reactions** as gated. That was RETIRED by `feedback_github_writes_operator_authorized.md` — verified comments/replies/reactions now post freely on nv-slang-bot's authority (verify load-bearing claims at repo HEAD first). Only ready-flips and merges remain gated. Commit push was never in any version of the gated set.

**Why:** On 2026-06-06, slang PR #11492 hit a stall when CodeRabbit posted 2 real Major findings. The fixer analyzed them correctly. I issued "Hold both findings; do not push yet" and started preparing an `ask_user_question` to the operator — citing the user-facing-writes-gated standing rule and the convergence with reviewer's round-2 C003. The operator overrode that hold within ~13 minutes by adding shared learning `1780726000000-pushing-commits-is-not-a-user-facing-write.md`, explicit text: "the fixer analyzed them correctly but stalled and surfaced to parent ... cost: a fix that was ~5 lines and already understood sat waiting on a human. The hold-instinct is good for genuine writes; it must not extend to commit pushes." The fixer pushed `8f21112` (+23/-8, 1 file) addressing both findings; verified correct.

**How to apply:**
1. When a coworker surfaces a "code change request from review (peer/automated/maintainer) on a draft-or-ready PR I own — push or hold?" — the answer is **push** (after their own technical-merit review). Do not gate on operator approval. Do not direct hold.
2. The drafts-only guardrail (`feedback_drafts_only_guardrail.md`) covers `gh pr ready` flips and merge actions, **not** code pushes. Pushing to a ready PR is fine; the operator owns the ready/merge actions.
3. If a coworker holds and surfaces, my correct response is "go ahead and push" — not escalation to operator. Reserve `ask_user_question` for genuinely operator-gated actions: `gh pr ready` flips and `gh pr merge` timing. (Comment/reply/reaction text was de-gated by the 2026-06-16 superseding directive — do NOT escalate those. Caught re-escalating retired-gate courtesy writes on PR #11504, 2026-06-16, by reasoning from the stale gated-set list above instead of the superseding file.)
4. The convergence pattern (peer reviewer raised same finding earlier and got declined) does not by itself elevate a code-push decision to operator-gated; it strengthens the technical case for the push but the gate is irrelevant.
