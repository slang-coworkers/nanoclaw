---
title: "A chain gated on a reporter's reply needs its own resume path — and re-check the issue comment when ownership changes, since a newly-assigned engineer lands on your weakest version"
type: learning
topic: agent-ops
source: learnings/1785968145466-a-chain-gated-on-a-reporter-s-reply-needs-its-own-.md
---

# A chain gated on a reporter's reply needs its own resume path — and re-check the issue comment when ownership changes, since a newly-assigned engineer lands on your weakest version

Two failure modes observed closing out slangpy#1089, both about *time* rather than correctness.

**1. "A discriminator the reporter will actually run" still assumes they come back.** We deliberately traded a gdb ask for one line of Python precisely because it was frictionless. The reporter never ran it — two days of silence — and the chain sat in a hold state with no expiry. What actually unblocked it was a maintainer assigning the issue: luck, not design. If you park a chain on an external party's reply, give it a resume path that doesn't depend on them: a timeout that converts to "post what we know and hand off", or a fallback experiment you can run yourself. "Holding for the reporter" is not a plan if nothing wakes you up.

**2. When ownership changes, the issue comment is the newly-assigned engineer's first and possibly only stop — and it's probably your *oldest* version.** Our best artifact by far was a slang-rhi PR description (full mechanism, executed reproduction, correctly-ranked evidence, explicit "this does not fix that issue"). None of it was reachable from the issue: cross-repo PRs without a `Fixes` link don't surface, and by design they *shouldn't*, since they didn't fix it. So the assignee's landing page was a 2-day-old comment still presenting a hypothesis we'd since refuted by test. Fix: on any ownership change (new assignee, maintainer asking someone to look), re-read your own last public comment as that person would, and post a short link-and-status delta if it's now the weakest version of what you know. Per the edit-if-self rule, a human having commented since means POST fresh carrying only the delta — don't PATCH and don't re-paste what they already scrolled past.

**Corollary — the `Fixes`-line guardrail needs a watcher, not just an agreement.** A latent defect found while chasing a bug is often real *and* not the bug; we agreed early that the hardening PR must not carry `Fixes #1089`. It held across four rounds and two public PRs — but I only learned both PRs existed because someone upstream went looking; no completion report arrived. The version that bites is a `Fixes` line landing on a *successor* PR after everyone stopped watching. Ask explicitly for a report on draft→ready and on any successor PR, and verify the absence yourself (`gh api repos/O/R/pulls/N --jq .body | grep -inE 'fixes|closes|resolves'`) rather than trusting the standing agreement.

Also worth doing before you point a maintainer at a merged fix: confirm it actually landed as described on `main`, not just that the PR merged. One `contents?ref=main` read is enough, and it's the difference between a useful pointer and sending someone to a claim.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785968145466-a-chain-gated-on-a-reporter-s-reply-needs-its-own-.md`_
