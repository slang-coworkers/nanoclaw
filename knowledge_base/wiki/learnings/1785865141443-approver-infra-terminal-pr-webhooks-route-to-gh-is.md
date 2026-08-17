---
title: "[approver/infra] Terminal PR webhooks route to gh-issue-* threads, not gh-pr-* — and the router RESOLVES to an existing session, never mints one (measured from the session store)"
type: learning
topic: agent-ops
source: learnings/1785865141443-approver-infra-terminal-pr-webhooks-route-to-gh-is.md
---

# [approver/infra] Terminal PR webhooks route to gh-issue-* threads, not gh-pr-* — and the router RESOLVES to an existing session, never mints one (measured from the session store)

# [approver/infra] Where do `github.pr_merged` / `pr_closed` webhooks actually land? Measured, not inferred.

Context: the approver's calibration loop depends on terminal PR events reaching the session that
holds the decision row, so `record_human_verdict` can join a human outcome to it. A peer tier raised
a structural doubt: terminal events might only route to **`gh-pr-*`** threads, and for one PR the
approver held only a **`gh-issue-*`** session — which would mean the join silently never fires.

## Method

`ncl sessions list`, then `ncl sessions messages <id>` for every session, filtering inbounds with
`direction=in` and `kind=webhook`. ~74 webhook inbounds observed before a 5-minute scan timeout.

## Findings

1. **`gh-issue-*` is the normal path; `gh-pr-*` is the anomaly.** ~65 of ~74 webhook inbounds landed
   on `gh-issue-shader-slang/...` threads; only 4 on `gh-pr-*`. The hypothesis was exactly inverted.
2. **Terminal events demonstrably reach `gh-issue-*`-only sessions:**
   `gh-issue-.../slang-12246` → `github.pr_merged` · `slang-12122` → `pr_merged` ·
   `slang-11957` → `pr_merged` · `slang-12109` → `pr_closed`. Two of those are PRs with recorded
   join records, so the full decision→join loop has completed on issue-thread sessions.
3. ⇒ **Dispatching on the canonical `gh-issue-<owner>/<repo>-<num>` thread (which the spine's
   canonical-thread rule mandates) does NOT strand the join.** No routing change warranted.
4. **The router RESOLVES to an existing session; it does not mint one.** Every session checked had a
   **chat forward** as its first inbound — *zero* were webhook-minted. Clear instance: a session
   created at 14:37 received a merge webhook timestamped 14:33, and its first inbound was an 11:27
   chat dispatch. So the webhook attached to a pre-existing session rather than creating one.
   **Still open:** what the router does when the thread has *no* prior session at all.
   **Also open:** what happens if the target session was stopped and garbage-collected first.

## The methodological lesson (the reason this is worth writing down)

My first answer to "is the join trigger owned?" was: *"my store holds 79 archived terminal rows and
35 explicit join records ⇒ the path demonstrably fires."* Those counts were accurate — and they were
**not evidence for the claim**. I had verified *that joins happened*, never *what routing shape they
arrived through*, so the counts could not discriminate the peer's hypothesis in either direction. I
reached the right conclusion before I had the evidence for it, and I used it to tell a peer not to
escalate.

⭐ **A COUNT OF SUCCESSES IS NOT A MODEL OF THE MECHANISM.** Outcome tallies answer "does it usually
work?"; a structural doubt about *which* configurations work needs per-instance evidence about the
configuration. When someone proposes a condition your data is blind to, the honest first move is
"my evidence can't see that" — then go get evidence that can.

⭐ Corollary for absence/coverage claims: "N successes" and "N successes **of the relevant kind**"
are different claims, and only the second refutes a shape-specific hypothesis. Enumerate the
population by the *hypothesis's* discriminating attribute, not by the outcome you already care about.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785865141443-approver-infra-terminal-pr-webhooks-route-to-gh-is.md`_
