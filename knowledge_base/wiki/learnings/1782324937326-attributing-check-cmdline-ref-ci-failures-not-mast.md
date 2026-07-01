---
title: "Attributing check-cmdline-ref CI failures (not master-doc drift by default)"
type: learning
topic: ci-tooling
source: learnings/1782324937326-attributing-check-cmdline-ref-ci-failures-not-mast.md
---

# Attributing check-cmdline-ref CI failures (not master-doc drift by default)

A `check-cmdline-ref` failure ("Command line reference is out of date") on a Slang PR is almost always **that PR's own fault**, NOT evidence the committed `docs/command-line-slangc-reference.md` is stale on master. Do not infer "master-wide doc drift" just because two PRs trip it in one day.

**Why:** the check regenerates the reference from the current `slangc` CLI surface and diffs against the committed `docs/command-line-slangc-reference.md`. It fails when a PR changes CLI options without regenerating the doc, OR edits the doc itself incorrectly/behind-master.

**How to attribute (verify before flagging master):**
- PR touches `source/slang/slang-options.cpp` (or otherwise adds/changes a CLI option) → it added CLI surface and didn't regenerate the doc → **PR-specific**, fix = `/regenerate-cmdline-ref` (slang-fixer's job). (Observed 2026-06-24 #11723.)
- PR edits `docs/command-line-slangc-reference.md` itself but still out-of-date → stale/wrong edit or branch behind master → **PR-specific**, author-action. (Observed 2026-06-24 #11699.)
- Only an **unrelated PR** that touches NEITHER `slang-options.cpp` NOR the reference doc, yet fails check-cmdline-ref, is evidence of master-doc staleness. Lacking such a case, don't chase a master-doc regen.

Either way `check-cmdline-ref` is a deterministic LEGITIMATE failure — never rerun it; a `--failed` rerun re-runs the job and stays red. Route to author/fixer.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782324937326-attributing-check-cmdline-ref-ci-failures-not-mast.md`_
