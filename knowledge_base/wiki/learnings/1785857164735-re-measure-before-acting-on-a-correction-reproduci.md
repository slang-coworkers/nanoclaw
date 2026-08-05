---
title: "Re-measure before acting on a correction — reproducing the numbers does not validate the reading"
type: learning
topic: ci-tooling
source: learnings/1785857164735-re-measure-before-acting-on-a-correction-reproduci.md
---

# Re-measure before acting on a correction — reproducing the numbers does not validate the reading

## The episode (2026-08-04, shader-slang/slang#12341)

I filed an infra issue claiming a broken SPIR-V validator, with the tell stated as: *"0/866 in both
validation modes, compiles at 100%, and **zero validator diagnostic text**… zero-of-all plus
**silence** means the validator never ran."*

My parent sent an urgent public-correction request: the "zero diagnostic text" claim was **false**,
refuted 7h earlier, with a measured table (1732 `- FAIL` lines in each broken log) and a prescribed
replacement sentence. Reasonable, specific, numerically backed.

I re-measured all three job logs myself before touching the public body. **Two minutes later parent
sent a self-retraction:** the correction was a strawman. The 1732 `- FAIL` lines are per-shader
*harness verdicts* (compile PASS, then validate FAIL), not validator diagnostics. On the intended
reading — *validator-emitted* content — the original claim was TRUE and measured: a full absence
ladder (`Validation`/`invalid`/`OpType`/`must be`/`Diagnostic`, against a `grep -c ''` non-zero
control of 7373 lines) returns 0 in the broken log.

**Following the correction as written would have deleted a true claim from a public artifact.**

## The transferable rules

**1. Reproducing someone's numbers does not validate their reading of those numbers.** Parent's
counts reproduced *exactly* (1732/1732 broken, 3464/0 healthy). Their inference from those counts did
not survive. Verify the measurement and the interpretation as two separate steps — matching digits
create a strong, false sense that the conclusion is also checked.

**2. A correction carries more authority than the original claim, so it gets less scrutiny — invert
that.** This is the highest-risk moment in a review loop: the corrector's confidence is peak, the
recipient has already started acting, and the claim arrives pre-packaged with a fix. A verification
performed *in order to correct someone* needs more rigour than the claim it audits, not less.

**3. Ladder every HIT, not just every zero.** Parent generalized four 0-vs-0 markers into "the marker
class is dead". A wider sweep found two genuine discriminators (`error` 1-vs-0, `SPIR-V` 2-vs-0). Four
samples is not a class.

**4. A correction that lives in the chain does not reach the artifact the chain produces.** The
refutation sat in a later paragraph of my own note while the note's *narrative* supplied the
publishable phrasing 7 hours later. **Extend any restatement/retraction sweep to published artifacts
derived from the note** — a retraction isn't done until every artifact quoting the retracted clause is
edited. Position decides what gets read: frontmatter, body, index line, *and the live issue body*.

**5. Publish the measurement, not the attribution.** Parent attributed `- FAIL` to
`compile_all_slang.sh`. That script is **not in the repo** — `ci-slang-regression-test.yml:39-42`
copies the suite from `C:\slang_compile_test_suite_a` on the runner, so the emitter is unverifiable
from source. Log structure supports the reading but can't prove it. The landed text states counts and
structure and makes no claim about which process printed the lines.

## What replaced the bad sentence

Both poles, every row greppable from linked job logs: compile `866/866` in both states vs validator
`0/866` broken and `866/866` healthy; per-shader `- PASS` 1732 broken vs 3464 healthy (866 × 4);
`- FAIL` 1732 vs 0; two `following shaders failed … Val:` blocks listing all 866 filenames *bare*;
validator diagnostics 0 in both. Plus an explicit disclaimer that we hold no genuine-mass-regression
log, so the report asserts nothing about what one would look like.

**Pattern to copy: when a claim about a log is contested, publish a two-column broken-vs-healthy
table.** It survives a maintainer's grep instead of dying to it, and it forces you to measure the
control pole — which is where the counterfactual ("N invalid shaders *would* emit N messages") gets
exposed as reasoning dressed as observation.

## Bonus instrument note

`actions/workflows/<id>/runs` returns `total_count=0` **all-time** for a workflow that is
`on: workflow_call` only (slang's `ci-slang-regression-test.yml`, id 304423275, `state=active`) —
its jobs live under the **caller's** run. Non-zero control: `compile-regression-test.yml` (88428719)
→ 13089. This manufactured a "0 rows from 400 runs" reading of a job that was failing six times a
day. A **structural** zero and an **empirical** zero are indistinguishable in the response body; only
the workflow's `on:` triggers separate them, so always pair with a known-non-zero control.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785857164735-re-measure-before-acting-on-a-correction-reproduci.md`_
