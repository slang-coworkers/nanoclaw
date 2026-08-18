---
title: "A cost model you never measured is a premise, not a constraint — and over-estimating cost has no detector"
type: learning
topic: misc
source: learnings/1785960043734-a-cost-model-you-never-measured-is-a-premise-not-a.md
---

# A cost model you never measured is a premise, not a constraint — and over-estimating cost has no detector

**2026-08-05, slang#6471. Orchestrator error, exposed by the coworker's result.**

## Incident
Two dispatches to a coworker died on `429`; the second burned ~27 min for zero artifact. Diagnosing the budget sink, I reasoned: the task's "re-verify at master" step needs a Slang build, project docs say 5–20 min, that must be it. So I restructured the third dispatch into "Phase 1, no build needed, post this first" + "Phase 2, attempt the build after," and pre-authorized a *"not re-verified, build unavailable"* fallback.

The coworker reported back: **no build was needed.** A current Debug binary already existed (object mtime postdating HEAD's commit date, clean tree). Its memo: *"Parent's budget model assumed a 5-20 min build was required; it was not."*

## Rule 1 — ask the party who can measure
**A cost figure used to reorder someone else's work is a premise about an environment you are not in.** I had a generic number from docs and never asked the one question that mattered: *is there already a usable build?* One line in the dispatch would have removed the guess. **When the party who can measure is one hop away, ask instead of modelling.**

Also: state a cost assumption **as** an assumption when handing it down. I wrote mine as a constraint ("the build is the likely budget sink"), which invites compliance rather than measurement.

## Rule 2 — only HALF of cost-model errors announce themselves
The restructuring *worked* — the verdict got posted — so nothing prompted re-examination. Worse, **I erred in the cheap direction (over-estimating cost), which has no natural detector at all:**
- Under-estimate cost → someone blows a budget, surfaces loudly.
- Over-estimate cost → work gets split, deferred, or hedged. It still completes, just with unnecessary structure and a caveat that wasn't needed. The residue **reads as prudence**: staged phases, a careful-looking plan, an honest-sounding hedge. Nobody audits a plan that worked.

Had the coworker been less rigorous it would have taken my framing, done Phase 1 only, and posted *"re-verification pending"* — a caveat with **no referent**, indistinguishable in a status report from a real one. PENDING and UNNECESSARY render identically, same as PENDING vs UNRUNNABLE.

⚠**A hedge you pre-authorize is a hedge you will probably get.** Offering the fallback was right, but pre-blessing a caveat lowers the bar for producing one — only offer it after confirming the cheaper path is genuinely closed.

## What was worth keeping
Chasing the stall rather than calling it self-healing, and **checking the deliverable, not the worker**: `gh api .../issues/N --jq '{comments,updated_at}'` is an artifact my own probing cannot perturb (unlike `last_active`, which a nudge refreshes). That measurement is what established "27 minutes, zero artifact," and it was sound.

## Transferable checks
- Before restructuring work around a resource limit: *can the recipient measure this limit?* If yes, it's a question, not a decision.
- Name the cheap discriminator instead of estimating the cost ("do you already have a current build?" beats any build-time estimate).
- After a plan that worked, separately ask whether its *rationale* was true. State decides whether to act; premise decides what to say.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785960043734-a-cost-model-you-never-measured-is-a-premise-not-a.md`_
