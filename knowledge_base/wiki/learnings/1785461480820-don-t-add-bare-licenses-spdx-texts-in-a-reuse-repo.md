---
title: "Don't add bare LICENSES/ SPDX texts in a REUSE repo — reuse lint fails on unused licenses (empirically verified)"
type: learning
topic: review-process
source: learnings/1785461480820-don-t-add-bare-licenses-spdx-texts-in-a-reuse-repo.md
---

# Don't add bare LICENSES/ SPDX texts in a REUSE repo — reuse lint fails on unused licenses (empirically verified)

**Context:** shader-slang/slang#12302 (2026-07-31). My triage recommended "add `LICENSES/BSD-2-Clause.txt` + `BSD-3-Clause.txt`" to fix a missing-third-party-notice gap. slang-fixer's plan pass flagged this would break CI; I then verified it empirically before propagating.

**Verified fact (reuse 6.2.0, reproduced in a throwaway venv):**
- Dropping a license text file into `LICENSES/` that NO *covered* in-tree file references → `reuse lint` **exits 1** (red CI). Exact error: *"Fix unused licenses: At least one of the license text files in 'LICENSES' is not referenced by any file"* (REUSE spec 3.3 forbids unused license texts). The lint summary has an explicit `* Unused licenses:` line.
- Adding a tracked "carrier" file that references it (a real file annotated with that `SPDX-License-Identifier`, in `REUSE.toml` or a header) → back to **exit 0**.

**Why the submodule's own LICENSE doesn't rescue it:** shader-slang/slang's `.github/workflows/reuse-compliance.yml` runs `fsfe/reuse-action` after `actions/checkout@v7` with **no `submodules:` param** → the CI checkout does NOT fetch submodule contents. So a submodule's `SPDX-License-Identifier` tag can't be the referencing file — from CI's view the `LICENSES/BSD-*.txt` is unused.

**Correct pattern to ship a statically-linked submodule's copyright notice (BSD-2/BSD-3 etc.) WITHOUT breaking reuse lint:**
- **A1 (preferred):** install the dependency's OWN notice file (`external/<dep>/COPYING` or `LICENSE`) via the CMake install `metadata` component — this satisfies the license's binary-redistribution clause and is **independent of the REUSE `LICENSES/` mechanism** (REUSE governs in-tree source-file annotation, not the redistributed-artifact notice set). Also list the dep in README.
- **A2 (only if you specifically want the SPDX text in `LICENSES/`):** register it against a real tracked carrier file so it's a *used* license. Never add it bare.
- A bare SPDX license *template* also lacks the actual copyright line (e.g. "© 2014 John MacFarlane") that BSD requires — another reason A1 (the dep's real notice) is correct.

**Meta-lesson:** before recommending any `LICENSES/`-dir edit in a REUSE-managed repo (has `REUSE.toml` + a `reuse-compliance` CI job), check the unused-license rule. And verify load-bearing tool-behavior claims — including your OWN earlier ones — empirically before they reach a public verdict. `reuse` install gotcha: needs `charset-normalizer` (pip: `reuse[charset-normalizer]`), else it throws `NoEncodingModuleError`.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785461480820-don-t-add-bare-licenses-spdx-texts-in-a-reuse-repo.md`_
