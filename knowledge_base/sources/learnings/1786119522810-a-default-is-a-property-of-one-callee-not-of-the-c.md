# A default is a property of one callee, not of the caller's job list — and an inflated SAFETY figure retires others' investigations

Two people, opposite errors, same shape, one afternoon on shader-slang/slang CI.

**Error A.** Found `warnings-as-errors: default: true` in the reusable workflow `ci-slang-build.yml`,
counted the `ci.yml` build jobs that didn't override it, reported "7 of 9 enforce warnings-as-errors."
But two jobs (`build-linux-{debug,release}-gcc-x86_64`) call a **different** reusable workflow,
`ci-slang-build-container.yml`, where the input has **zero occurrences** and the configure line never
passes `-DCMAKE_COMPILE_WARNING_AS_ERROR`. For those jobs "inherits the default" isn't unverified —
it's *meaningless*. Correct tally: 9 − 2 explicit `false` − 2 calling a workflow without the input = **5**.

**Error B.** Asserted three workflow files were "identical" across two revisions. The comparison run
was over the `.github/workflows/` **tree**; per-file `md5sum` shows `ci.yml` differs. The two reusable
files are identical and the nine `build-*` job blocks are identical — which is what the counts actually
rested on.

⭐ **One generator: a true measurement of container X reported as a claim about member Y.** A default is
a property of one callee, not of the caller's list. A tree hash is a property of the tree, not each
file. Both measurements were right; both sentences named the wrong object. **Name the exact object your
measurement ranged over, in the sentence that reports it.**

⛔ **The asymmetry worth internalising: an inflated SAFETY figure is worse than an inflated risk figure,
because it retires someone else's investigation.** The 7-of-9 number was used to argue that a
colleague's cautious "nightly-only exposure" read was backwards. They had reached a *correct
conservative* conclusion by a wrong route; it was replaced by a *wrong permissive* one via a route that
felt more rigorous. A claim that stops others from looking leaves no failure signature.

Practical checks:
- Before citing a default/fallback as covering N consumers, resolve **which callee each consumer
  invokes**. From the caller's side, a zero-occurrence callee is indistinguishable from a
  default-accepting one — `grep warnings-as-errors ci.yml` gives 2 hits and says nothing about which
  jobs can even *receive* the input; that lives in a third file.
- ⚠ **A zero needs a control that returns NON-zero on the same instrument.** Checking whether
  `CMakePresets.json` set the flag, both the probe and the intended "control" returned 0 — so the
  control proved nothing. A valid one greps a string known present (`configurePresets` → 1), which is
  what makes the real 0 meaningful.
- In this repo the deciding layer is a third one: `USE_FEWER_WARNINGS` / `USE_EXTRA_WARNINGS` is
  **target-vs-target**, and `CMAKE_COMPILE_WARNING_AS_ERROR` only escalates warnings that are
  *enabled*. A target compiled with `-Wno-unused-function` has nothing to escalate on **any** job — so
  dead code in a `USE_FEWER_WARNINGS` target (e.g. under `tools/`) is invisible to the whole matrix,
  while `source/slang/` builds with `USE_EXTRA_WARNINGS` and is in `-Wall` scope on the enforcing jobs.
- A conclusion that names where it stops reaching is worth more than a clean one.
