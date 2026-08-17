---
title: "A 403/401 on one endpoint is evidence about that endpoint, not about the capability"
type: learning
topic: verification
source: learnings/1785833063004-a-403-401-on-one-endpoint-is-evidence-about-that-e.md
---

# A 403/401 on one endpoint is evidence about that endpoint, not about the capability

## The mistake

I probed GitHub branch protection as the `nv-slang-bot` app and got:

```
repos/{o}/{r}/branches/master/protection/required_status_checks
  → 403 "Resource not accessible by integration"
```

and concluded *"the bot structurally cannot verify branch protection."* Wrong. The same data is
fully readable one route over:

```
repos/{o}/{r}/branches/master  →  .protection.required_status_checks.contexts
  → ["check-formatting","check-ci","SlangPy Tests"],  protected=true
```

Only the dedicated protection **sub-resource** is gated; the branch object exposes the same field.

## The rule

**A refusal on one endpoint is evidence about that endpoint, not about the capability.** Before
recording "I can't read X," try at least one alternate route that carries the same field —
a parent object that embeds it, a GraphQL equivalent, a list endpoint instead of a detail endpoint.

This is the same shape as a path-classed gateway 401 (some REST paths 401 while others return 200
with the same token) and as `--paginate` failing on page 2+ while explicit `?page=N` succeeds.
The generalization: **capability claims are per-route until proven otherwise**, and the cost of
over-generalizing is that you either attribute a fact you could have verified yourself, or you skip
a check entirely on a future run.

Corollary for reporting: *"attributed to X, I couldn't verify"* is the right posture when you
genuinely couldn't — but it becomes wrong the moment an alternate route exists. First-hand beats
attributed, so spend the one extra call.

## Companion rule from the same investigation: cite precedents by what they DO

I recommended a CI tool-presence gate "modelled on `ci-materialx-regression-test.yml:73`". That
line is:

```yaml
"$SLANGC" --version || echo "Could not get slangc version"
```

`|| echo` **does not fail the step.** As a template for a *failing* gate it would have reproduced
the exact silent-tool bug I was trying to prevent. The real gate is four lines earlier at `:65-69`
(`if [ ! -f "$SLANGC" ]; then echo "ERROR: …"; exit 1; fi`).

**Citing a precedent requires reading what it does, not what it is for.** A line that looks like a
tool check can be a deliberately non-failing diagnostic echo. Same trap in
`ci-slang-build-container.yml:115-116` — informational `echo`s, not gates.

## And: don't let a mis-scoped range become a load-bearing premise

A subagent reported that a failure list in the log was **empty** and built an inference on it. The
list actually held 866 entries — its `awk` line-range window was mis-scoped. My own `grep -c` had
reproduced the identical artifact, so I nearly confirmed a false claim by repeating the same
mistake. Direct `sed` of the region settled it.

When a claim of *absence* is doing real work in an argument, re-verify it with a **different
instrument**, not a variation of the one that produced it. Two tools sharing a windowing bug agree
with each other perfectly.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785833063004-a-403-401-on-one-endpoint-is-evidence-about-that-e.md`_
