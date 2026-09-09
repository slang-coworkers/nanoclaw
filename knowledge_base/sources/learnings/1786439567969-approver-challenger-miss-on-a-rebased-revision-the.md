---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786376190630-6p704z
written_at: 2026-08-11T09:12:47.969Z
---

# [approver/challenger-miss] On a rebased revision the inter-head compare is mostly upstream noise — measure the PR's own diff vs base, and check ahead_by/behind_by to tell a rebase from a push

**Symptom.** slangpy#1050 R2 (`1629c32addf2`) → R3 (`5d72a59d1722`). The natural "what changed in this revision?" probe — `gh api compare/<R2>...<R3>` — reports **7 commits / 42 files / 13856 lines**, including an `external/slang-rhi` **submodule pointer bump** and a spread of files with nothing to do with BC codecs (`src/sgl/core/thread.cpp` 218, `src/slangpy_ext/py_doc.h` 150, `src/sgl/device/resource.cpp` 121, `tests/sgl/core/test_thread.cpp` 114, `slangpy/tests/device/test_buffer_from_native_handle.py` 90). The PR's actual surface vs its base is **27 files / 12901 lines**, and `external/slang-rhi` is **not in it**.

**Root cause.** The revision was a **rebase**, not a push. Four of those seven commits are upstream `main` work the branch was replayed onto (`#1097` slang-rhi update + parallel pipeline compilation, `#1098` nanothread adapter, `#1090` native buffer handle import, `#1099` nanothread private dep). A two-dot-style `A...B` compare between two *heads* answers "what commits are reachable from B but not A" — after a rebase that includes everything the branch caught up on. It is not "what the author changed."

**The cheap discriminator: `ahead_by` / `behind_by` against the base.**
```
R2: merge_base c6f97171a353  ahead_by 7  behind_by 4
R3: merge_base b2c9783baa9c  ahead_by 3  behind_by 0   # merge_base == base_commit
```
`behind_by` collapsing to 0 while `merge_base` moves forward **is** the rebase signature. Push-only revisions keep the same merge_base.

**Why this matters for the challenger specifically.** Two distinct failure modes, opposite signs:
- **Reviewing borrowed code.** Budget spent on four upstream PRs' worth of diff that no one asked about and that already merged on its own review. Worse, a finding raised against it is aimed at the wrong author.
- **A phantom submodule surface.** My Step-0 recall carries a prior atom that data/submodule pointer bumps break CI on *untouched* tests and are invisible to the review doc — a strong prior that says "look for the bump." Here the bump was real in the inter-head view and **not owned by this PR**. Firing that probe would have produced a confident, well-precedented, entirely misattributed concern. A good prior pointed at the wrong diff.

**How to catch it.** Always measure the PR's own surface as `compare/<base_branch>...<head>` (that is also what `eval-clauses.py` uses, so the clause and the challenger stay on one metric). When you want the honest per-revision delta, compute it against the **new merge_base**, or restrict to the PR-owned commits — here `b6821f127b7b` (bc7enc+bcdec vendoring), `2afcca623283` (optional NVTT CMake), `5d72a59d1722` (BC codec). And test membership by **explicit filter** rather than eyeballing a file list: `jq '[.files[]|select(.filename|test("slang-rhi"))]|length'` returning 0 is the check; "I didn't notice it" is not.

**Corollary — verify a file-count change by set difference, not arithmetic.** Files went 26 → 27 across the revision. That is consistent with +1 added, and equally with +3 added / −2 dropped. `comm -13` on the two sorted file lists showed exactly one addition (`src/sgl/core/rfilter.h`, 2 lines) and nothing dropped. A count delta identifies a *net*, never the composition — the same referent-vs-claim error as reading a reconciling sum as proof a figure is correctly placed.

**Outcome here.** Decision unaffected — `tier_eligible` failed on the PR's own 12901 lines (> cap 8000) and Step 1 was terminal, so the challenger never ran. The learning is pre-positioned for the revision where Step 1 *does* pass on a rebased head.
