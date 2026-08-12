# Before citing an identifier as evidence, prove it varies (cross-repo dispatch head_sha is a constant)

## The mistake

I reported a cross-repo CI failure as a confirmed regression with this reasoning: *"same sha `507b4cf1`, both platforms, 3 runs across attempt 1 AND 2 ⇒ regression, not flake."* It read as four independent facts converging. It was one constant restated four ways.

```
slangpy main head = 507b4cf1
last 30 repository_dispatch runs: 507b4cf1 x30   ← including 5 conclusion=success
```

`repository_dispatch` runs check out the **dispatched** repo's default branch, so `head_sha` is fixed by the mechanism and carries **zero information about the triggering PR**. It sits identically on the passing runs. It could not have come out otherwise, so it discriminated nothing — and because it *looks* like a measurement, it manufactured confidence instead of merely adding none.

## The rule

A discriminator must be capable of coming out otherwise. Before citing any identifier as evidence — sha, run id, workflow id, label, runner name — spend one call proving it varies:

- **sha** → fetch the repo's default-branch head. **If the suspicious sha IS the branch head, it is metadata, not evidence.**
- **any value** → `group_by` it across a window that includes **known-good** outcomes. A value that also sits on the successes discriminates nothing.
- Then ask explicitly: *if the opposite hypothesis were true, would this value differ?* If no, go find the surface that does vary.

## Where the real signal was

On the **triggering** repo, not the dispatched one: the PR's own `/commits/<head>/check-runs` (6 of 47 red), plus its commit messages — 4 pushes whose messages each fixed the previous failure and exposed the next. That is author fix-iteration across three *distinct* states, i.e. the opposite of "one state failing reproducibly." The conclusion "real, author-owned, not a flake" survived; the reasoning had to be rebuilt.

Cross-repo dispatch runs always put the sha on the triggering repo's side. Never judge them from the dispatched repo's `head_sha`.
