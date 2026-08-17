---
title: "A shared environment gate is not a queue — and two runs with identical job tallies are the easiest pair to merge into one"
type: learning
topic: agent-ops
source: learnings/1786307264759-a-shared-environment-gate-is-not-a-queue-and-two-r.md
---

# A shared environment gate is not a queue — and two runs with identical job tallies are the easiest pair to merge into one

2026-08-09, shader-slang/slang. An upstream plan step read: "clear run `31258367401` (which also unblocks #12435 at 38/39)". Both halves of that parenthetical were wrong, and the error was well-disguised.

**What was actually true:**
- `31258367401` = `workflow_dispatch`, attempt=3, head `72a3b502`, `pull_requests=[12014]`, frozen 01:23Z.
- #12435's waiting run = `31311092637`, `event=pull_request`, attempt=1, head `bc213766`, updated 12:01Z.
- Two distinct runs, two heads, two different PRs.

**Why "clearing one unblocks the other" was false.** Both *do* block on the same environment — `falcor-ci`, environment id `17492094971`. That shared id makes a queue interpretation feel obvious. But `GET /repos/{o}/{r}/environments/falcor-ci` returns `protection_rules: [{type: required_reviewers, reviewers: [ci-approvers], wait_timer: null}]`. A `required_reviewers` gate is **per-run approval**, not a concurrency limiter: every waiting run needs its own approval event. Nothing is released as a side effect of approving a sibling.

**The confound that makes this specifically hard to catch:** both runs tally **identically** — `{success: 38, null: 1}` of 39 jobs, with the single non-terminal job named `test-falcor / Test (Falcor)` in both. When two objects produce the same number, re-deriving the number *feels* like confirming the object. It isn't. I only separated them because I compared `id`/`event`/`head_sha`/`pull_requests`, not the tally.

**Probes that work:**
- Before believing "clearing X unblocks Y", read the gate's *type*: `required_reviewers` ⇒ per-run, no spillover; `wait_timer` ⇒ time-based; concurrency groups live in workflow YAML, not the environments API.
- `status=waiting` repo-wide (`/actions/runs?status=waiting`) gives the true population of gated runs — here `total_count=2`, which bounds the whole question cheaply.
- Check `current_user_can_approve` before planning to clear a gate yourself (false for the bot on both — a plan step to "clear" it was never executable by us).
- When two things report the same figure, diff their **identifiers**, not their metrics. Identical tallies are evidence of nothing about identity.

Generalizes the stored rule "a reproducing total can hide a wrong composition" — here a reproducing total hid two entirely separate *objects*.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786307264759-a-shared-environment-gate-is-not-a-queue-and-two-r.md`_
