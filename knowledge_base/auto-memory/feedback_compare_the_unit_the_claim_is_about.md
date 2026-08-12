---
name: feedback_compare_the_unit_the_claim_is_about
description: "A byte-identity claim about a JOB inside a file is not testable by hashing the FILE. Whole-file sha256 said 'claim false'; extracting the named block said 'claim true' — the file legitimately carries other content. Compare the unit the claim names."
metadata:
  node_type: memory
  type: feedback
---

**Instance (2026-08-10, nanoclaw#1177).** A commit message claimed its `.github/workflows/ci.yml` was *"byte-identical to nv-main's, so canonicalization is a no-op."* I hashed both files:

```
ci-pr1177.yml   12,495 B   sha256 0c5941ae…
ci-nvmain.yml   12,355 B   sha256 47d74153…
ci-pr1176.yml   18,072 B   sha256 db4be6d4…   (the nv-main companion PR)
```

Three different hashes ⇒ **"the claim is false"** was one message away from being reported. It would have been a manufactured finding. nv-main's `ci.yml` legitimately carries jobs the leaf's copy lacks (a typecheck ratchet, KB-observability tests) — the files were never supposed to match. Extracting only the `python:` job block, which is what the claim was actually about:

```
pyjob-ci-pr1176.yml.txt   62 lines / 2,986 B   sha256 60e48e57…
pyjob-ci-pr1177.yml.txt   62 lines / 2,986 B   sha256 60e48e57…   IDENTICAL
```

Claim **true** at the unit it named, and true in the way that mattered: two copies that agree cannot drift, which is the whole point of the assertion.

⭐⭐⭐**A hash is only evidence about the thing you hashed.** Widening the scope past what a claim names does not make the test stricter — it makes it test a *different* proposition, and the answer it returns is about that other proposition. Here the wider test returned a confident, well-instrumented, reproducible **inversion**.

⇒ **Before running an identity/equality check, say out loud what unit the claim is about** — a job, a function, a section, a field — and extract that unit first. If the container legitimately holds anything else, a container-level hash cannot decide the claim in *either* direction: it can only ever say "differs", which is uninformative when difference is expected.

⚠️**The failure direction is the dangerous one.** A too-wide comparison fails toward *"the author is wrong"* — a finding, something to report, something that generates work. That is the same asymmetry as a broken instrument manufacturing findings: an instrument defect that produces work costs more than one that hides it, because you act on findings. See [[technique_keeping_this_store_reachable]] for the general form.

✅**Cheap discriminator, no extra tooling:** if the claim is *"X is identical"* and the whole-file hashes differ, ask **"does this file contain anything OTHER than X, and is that other content expected to differ?"** If yes, the file-level result is void — not negative. Same shape as [[feedback_a_control_validates_the_instrument_never_the_target]]: I validated my instrument (sha256 works fine) while pointing it at the wrong object. And per [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]], voiding the file-level result returns the question to *unknown*, not to "the claim is true" — which is why the block-level extraction had to actually be run.

**Sibling error class, same review:** a probe-gated CI step that **skips** and one that **passes** are indistinguishable in the check-run rollup (both surface as the job's `success`). The rollup is the container; the step conclusion is the unit. Reading `steps[].conclusion` (`7 ruff => success`) plus the step log (`All checks passed!`) is what distinguishes "the gate ran" from "the gate was skipped and nothing objected" — cf. [[feedback_a_success_receipt_certifies_the_wrong_half]] family and the rollup-vs-check-runs blind spot in ANCHOR G.
