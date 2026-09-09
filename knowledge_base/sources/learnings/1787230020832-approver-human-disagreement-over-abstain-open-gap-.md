---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787208113173-doxczh
written_at: 2026-08-20T12:47:00.832Z
---

# [approver/human-disagreement] Over-abstain: OPEN_GAP on a confined-blast-radius CI-hardening item that the maintainer merged as-is — slangpy#1119

## Signal (what the merge revealed)
shader-slang/slangpy#1119 "Thread sanitizer" (skallweitNV, MEMBER). I decided
**ABSTAIN_POLICY:OPEN_GAP** on the head `f0dffd12b3df`, waiting on a human/security-owner to
accept — or the author to fix — the CI supply-chain surface CodeRabbit flagged as merge-gating
(unverified LLVM 22 archive download, unpinned `lukka/get-cmake@latest`, checkout without
`persist-credentials: false`). Outcome: **merged at `f0dffd12b3df` — my exact decision commit,
zero interval commits, none of the three items addressed, no formal human review
(reviewDecision=REVIEW_REQUIRED), merged by the author himself.** merged ⇒ APPROVED-equivalent,
so this is a decision/human mismatch: I abstained, the maintainer shipped it as-is.

## Both rationales (audited in both directions — the flattering read gets the harder look)
- **Why the abstain was defensible:** the review source (CodeRabbit) explicitly called it
  "required before merge or need explicit security-owner acceptance"; no acceptance existed at
  decision time; fallback tier + Step-3 "any doubt ⇒ ABSTAIN." The approver never blocks (never
  writes to GitHub) — abstain only routes the security-hardening tradeoff to a human, which is
  literally what then happened. So the system did not malfunction.
- **Why it was nonetheless an OVER-abstain (the real lesson):** I under-weighted BLAST RADIUS.
  The download lives in a `schedule` + `workflow_dispatch`-only lane (no `pull_request` trigger) —
  a **non-required, non-shipped** nightly/dispatch job, not PR CI, not an artifact, not the
  compiler — fetched over TLS from the **canonical llvm-project GitHub release**. That is exactly
  the #12618 "CI-only supply-chain hardening = conservative-lean APPROVE class in shadow mode"
  shape (blast radius confined to a non-required/non-shipped job; reduces or holds surface; from a
  trusted host). Against that, a bot's "merge-gating" label is a prior to WEIGH, not a verdict to
  adopt — a maintainer merged it without hesitation and without touching any of the three items.

## Transferable rule (sharpens Step-0 recall for the next similar PR)
For a CI/build-infra finding (unverified external download, unpinned action, credential
retention): **the decision hinges on blast radius, and blast radius is read from the lane's `on:`
triggers + whether the job is required/shipped — not from the bot's severity word.**
- Confined (schedule/workflow_dispatch-only, non-required, non-shipped, non-artifact) + trusted
  host (canonical release over TLS) ⇒ this is the conservative-lean CI-hardening class; the
  hardening item is advisory and the gap tends to CLEAR. Do not abstain solely because a bot
  labeled it "required before merge."
- Reachable on PR CI / shipped artifact / the compiler / a required check ⇒ real blast radius ⇒
  OPEN_GAP stands.
Concretely: before abstaining on such an item, run `gh api .../actions/runs/<id> --jq .event`
AND read the workflow `on:` block; if the lane is dispatch/schedule-only and non-required, lean
toward clearing. (Counter-audit so I don't over-correct: this is a calibration nudge on the
CI-hardening class, NOT license to clear a download that feeds PR CI or a released artifact, and
NOT a relaxation of the false-SAFE bar on 🔴 functional bugs — approving a real code defect is a
different and worse error than an over-abstain.)

## Note on prior recall
My Step-0 recall surfaced #12618 (this exact APPROVE class) and slangpy#925. I had the right
prior in hand and still abstained — the miss was weighting, not retrieval. Next time, when #12618
matches, explicitly test the blast-radius predicate before defaulting to the bot's merge-gating
label.
