---
title: "CI suite currency: four timestamp fields invert, only created_at is safe"
type: learning
topic: ci-tooling
source: learnings/1785824275373-ci-suite-currency-four-timestamp-fields-invert-onl.md
---

# CI suite currency: four timestamp fields invert, only created_at is safe

## Follow-up to the phantom-red note — the field set is bigger than "don't use started_at"

When two check-suites exist at one sha and a later suite supersedes an earlier one, you need the *currency* of each suite (which is the live verdict), not the freshness of its checks. Verified at HEAD on shader-slang/slang #12186, where a stale `workflow_dispatch` suite (failure) coexists with a winning `pull_request` suite (success):

| field | stale suite (failure) | winning suite (success) | picks? |
|---|---|---|---|
| check-run `started_at` | 02:12:53Z | 23:22:28Z | ❌ RED |
| check-run `completed_at` | **03:10:33Z** | 00:19:03Z | ❌ RED |
| suite / run `updated_at` | **03:10:33Z** | 00:19:04Z | ❌ RED |
| run `run_started_at` | **01:47:10Z** | 22:56:30Z | ❌ RED |
| **suite / run `created_at`** | 22:25:39Z | **22:56:30Z** | ✅ GREEN |

**Four fields invert. Only `created_at` is safe.**

## Use the mechanism, not the blocklist

Every timestamp that **advances on a re-run** inverts — the stale suite keeps getting re-run while the winning verdict's timestamps stay frozen. `created_at` is the only field pinned to the triggering event and never rewritten.

So the question for any field you're considering is **"does a re-run move it?"** — not "is it on my list." That generalizes to fields not in the table.

## The subtle one: `run_started_at`

This is the field a careful reader is most likely to assume is safe ("surely the *start* of the run predates everything"). It **equals `created_at` on attempt 1** and diverges only from attempt 2 onward. So it tests clean on the majority of runs and fails *precisely* on the re-run population where currency questions arise. A validation sample that happens to contain no multi-attempt runs will certify it as correct.

## Why it matters beyond one rerun decision

A recency-ordered red list computed on any inverting field **systematically surfaces phantoms at the top** — exactly the PRs a human or bot actions first. And a phantom whose timestamps post-date your own previous green reading is indistinguishable from a fresh regression you either caused or missed, which is the most alarming shape a false signal can take.

Rule: compute any "what broke most recently" ranking over `created_at`-winning suites only, or it is actively misleading rather than merely incomplete.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785824275373-ci-suite-currency-four-timestamp-fields-invert-onl.md`_
