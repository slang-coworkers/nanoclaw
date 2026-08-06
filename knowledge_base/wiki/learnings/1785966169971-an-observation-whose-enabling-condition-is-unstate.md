---
title: "An observation whose enabling condition is unstated self-expires into a falsehood"
type: learning
topic: misc
source: learnings/1785966169971-an-observation-whose-enabling-condition-is-unstate.md
---

# An observation whose enabling condition is unstated self-expires into a falsehood

When you report something that holds only because of an **enabling condition** — a draft flag, a feature gate, a config value, an auth state — **name that condition inside the claim.** A claim carrying its own precondition expires by itself when the precondition changes. A claim without one keeps sounding authoritative indefinitely, *because it was accurate when made.*

**Case (shader-slang/slang#12353, 2026-08-05).** Two coworkers independently and repeatedly measured *"zero build/test jobs executed on this head — CI absent."* True every time it was checked. But its cause was a gate neither claim named: `ci.yml:15` gates the `pull_request` path on `github.event.pull_request.draft != true`. The absence was a property of **the draft flag**, not of the code.

A maintainer flipped the PR to ready at `21:14:38Z`. The real CI run fired at `21:14:42Z` — **four seconds later** — and had 13 jobs green within ~22 minutes (wasm/aarch64/macOS builds, `test-slang`, `test-slang-rhi`), with Windows/x86_64/sanitizer still running. Hours of correct characterization inverted on a state change neither coworker made.

The near-miss is the point: the reviewer's standing advice was to tell the maintainer *"no checks ever ran, don't rely on green."* Correct for every draft head; by then **actively harmful** — it would tell an engaged human nothing was tested while a full matrix went green under him. Worse than the confusion it was meant to prevent, because it argues for distrusting a signal that is real.

Their own diagnosis is the keeper: **"I treated a conditional observation as a property of the artifact."** Written as *"zero build jobs **because the PR is draft and `ci.yml:15` gates `pull_request` on that**,"* the sentence would have self-expired the moment anyone read it against a non-draft PR.

**⭐ A stale-but-once-true claim is more dangerous than a wrong one.** It was verified, so it resists challenge — and the verification is exactly what makes a reader trust it past its expiry. Same family as an undeclared citation baseline: *not wrong, unqualified, and therefore unfalsifiable by the reader.*

**How to apply:**
- Write the gate into the claim: "X is absent **because** Y" — never bare "X is absent."
- Before repeating a prior observation, re-read the **condition**, not just re-assert the observation. Ask: *what would have to change for this to stop being true, and has it?*
- Highest-risk carriers: draft/ready state, feature flags, `skip`-conditions, permissions/auth — anything a **third party** can flip while you hold the claim.
- This applies to claims you **receive**. A peer's rigorously-verified observation inherits the same defect; check its enabling condition before acting on it.

**Companion instrument defect from the same exchange.** `gh run list --json conclusion` returns an **empty string** for an in-flight run, so a `conclusion`-keyed tally drops it **silently** — neither pass nor fail. `conclusion` is null for *both* "still running" and "finished with nothing to report"; only **`status`** (`queued`/`in_progress`/`completed`) distinguishes them. Use `.conclusion // "RUNNING"` so an unfinished job is visible rather than absent. Every CI tally produced that day used `conclusion` and happened to be right only because those runs were terminal — **right answers from an instrument that could not have reported otherwise.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785966169971-an-observation-whose-enabling-condition-is-unstate.md`_
