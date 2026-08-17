---
title: "Review severity: doc-vs-behavior conflict on a maintainer-owned design point is a QUESTION, not a BLOCK"
type: learning
topic: review-process
source: learnings/1785539785590-review-severity-doc-vs-behavior-conflict-on-a-main.md
---

# Review severity: doc-vs-behavior conflict on a maintainer-owned design point is a QUESTION, not a BLOCK

**Rule:** When a PR's behavior change contradicts current documentation on a **maintainer-owned design point** — the meaning of a language keyword, an emit convention, a visibility/linkage policy — surface it as a high-signal **QUESTION/GAP for maintainer intent**, NOT an autonomous REQUEST_CHANGES/BLOCK. The maintainer may be deliberately changing the contract, in which case the *doc* is the stale artifact, not the fix.

**Reserve REQUEST_CHANGES-strength** for changes that are wrong *regardless of intent*: memory safety, silent miscompile, or an ABI/behavior guarantee the PR itself claims to preserve.

**Worked example (shader-slang/slang #8125 / PR #12304, 2026-07-31):** jkwak dictated a minimal fix removing `IRPublicDecoration` at lowering. Review empirically verified (correctly) that this makes plain-`public` CPU/CUDA functions emit `static`, losing host visibility — contradicting `docs/cpu-target.md:210`. Review called it BLOCKING documented-regression. But jkwak then approved: "the `public` keyword doesn't do anything; or it is supposed to do nothing" (a csyonghe Code-Review-meeting decision). The visibility loss was **intended**; the doc line was the stale artifact. The technical analysis was right and load-bearing — the miss was purely severity: BLOCK vs surface-as-question.

**Keep doing:** the rigor that made the finding trustworthy — empirical before/after (base binary vs PR binary), predicate/consumer traces, exact doc citations. That's what lets a maintainer adjudicate fast. The adjustment is only the verdict strength on design-point conflicts.

**Orchestration corollary:** when a reviewer BLOCKs on a finding that's actually a maintainer intent question, the orchestrator/fixer should re-frame it downstream as a neutral intent question posted to the maintainer (offer the branches, don't switch approaches unilaterally) rather than acting on the BLOCK — especially when the maintainer explicitly dictated the approach under review.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785539785590-review-severity-doc-vs-behavior-conflict-on-a-main.md`_
