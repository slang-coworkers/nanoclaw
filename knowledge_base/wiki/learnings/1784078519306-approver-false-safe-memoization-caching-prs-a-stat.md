---
title: "[approver/false-safe] Memoization/caching PRs: a static-CLEAN audit never rounds toward approve — CI on the pinned head is authoritative"
type: learning
topic: ci-tooling
source: learnings/1784078519306-approver-false-safe-memoization-caching-prs-a-stat.md
---

# [approver/false-safe] Memoization/caching PRs: a static-CLEAN audit never rounds toward approve — CI on the pinned head is authoritative

Symptom: shader-slang/slang #12106 ("Memoize shared Val and type DAG traversals", saipraveenb25) — a deep, careful static audit (subagent + codex second opinion) cleared 4 correctness probes (ioDiff clobber boolean-safe; SubstitutionSet key sufficiency; lowerVal/lowerType dispatch==dispatchType; cross-env parent==moduleInst guard sound). The production claude-pr-review ALSO verified "cache lifetime, key sufficiency, escape safety, sharing guard sound across reviewers" and returned 0 bugs (APPROVE_WITH_NITS). Both would have rounded to WOULD_APPROVE. But CI on the pinned head was RED: 8 test-slang jobs failed deterministically + SlangPy — a PR-caused generic-specialization miscompile (baseline PR #12105 green on the same 8 configs). Correct call was BLOCK.

Root cause: a memoization/caching change is correct only if the cache KEY captures every input that parameterizes the memoized result. Static review reasons about the inputs it *enumerates*; a real cache-collision bug is precisely the input the author (and reviewer) DIDN'T enumerate. That gap is invisible to static reasoning by construction — it manifests only when two semantically-distinct values hash to the same key at runtime and one result is wrongly reused (here: distinct generic specializations collapsed onto one → wrong-arg-count ctor, missing intrinsic emission, cross-specialization type mixing). Note the primary review's own gap #1 (env-local mapValToValue cache lacks the thisType guard, on an unstated/unasserted invariant) pointed straight at the failure — a flagged-but-uncleared scoping gap on a cache is a load-bearing signal, not a nit.

How to catch it: for ANY memoization/cache/dedup/canonicalization PR, treat CI-green on the pinned head as a HARD precondition for WOULD_APPROVE — do not let a static-CLEAN audit or a 0-bug review substitute for it. If CI is red on such a PR, triage PR-caused-vs-flaky (baseline an unrelated same-base PR on the SAME configs) before anything else; a PR-caused red on the exact machinery the PR touches is a verified 🔴 → BLOCK. The static audit's role is to LOCALIZE the bug (which cache, which unguarded input), never to clear the PR over red CI. Extends [approver/false-safe] const_cast (static review can't clear correctness without execution). Investigation only adds caution; it never upgrades a verified regression toward approval.

Fix: n/a (approver decision — recorded BLOCK; false-safe averted).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784078519306-approver-false-safe-memoization-caching-prs-a-stat.md`_
