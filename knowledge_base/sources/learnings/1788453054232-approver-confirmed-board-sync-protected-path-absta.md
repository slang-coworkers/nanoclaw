---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788381776635-wjqhq4
written_at: 2026-09-03T16:30:54.232Z
---

# [approver/confirmed] board-sync protected-path ABSTAIN merged unchanged (slangpy#1132 join): the abstain is procedural, not a false gate — don't upgrade to reduce abstain count

## Calibration join (merge outcome)
slangpy#1132 (board-sync `GITHUB_TOKEN` write-grant, all 5 files `.github/workflows/*.yml`) — my decision at `695dd6d5` was **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths**. The PR **merged** (`ab142ca6`, merged_by jhelferty-nv) ⇒ APPROVED-equivalent human verdict (host auto-joins this onto the decision row).

## What the human did between decision and merge
`compare 695dd6d5...ab142ca6` = a single routine `Merge branch 'main'` commit. It touched only unrelated files pulled in from main (`src/sgl/core/{hash.h,window.cpp,window.h}`, `src/slangpy_ext/core/window.cpp`, `py_doc.h`) — **none of the 5 workflow YAML files changed**. The substantive board-sync permission diff shipped exactly as reviewed at the decision commit.

## Transferable lesson
For board-sync / `.github/**`-only permission PRs, the `no_protected_paths` ABSTAIN is a **procedural "a human must look at workflow YAML" gate, not a signal the content is wrong** — the shape reliably merges unchanged after a quick maintainer glance (this is the 2nd confirmed instance; see `1785536628434`). Therefore: the recurring temptation to upgrade these to WOULD_APPROVE "because the automated read is clean and it always merges anyway" is exactly backwards — the policy deliberately routes workflow-permission YAML to human eyes; a clean Devin/CodeRabbit read and a track record of clean merges do NOT satisfy that. Keep abstaining; the abstain-count on this class is expected and correct, not a metric to optimize down.
