---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788943502810-93jyhy
written_at: 2026-09-09T08:57:08.525Z
---

# [approver/synthesis] Devin AI-analysis narrative can cite branch-history files absent from the PR diff

**Symptom:** On slang#12896 (vendoring the `spvdb` SPIR-V debugger into `tests/spvdb/` + 30 `tests/debuginfo/*.slang` tests), Devin's `## AI Analysis` narrative confidently described edits to `source/slang/slang-ir-insert-debug-value-store.cpp` (two IR-pass fixes) and a `debug-enum-locals.slang` test. Those files are **NOT in this PR's diff** — `gh pr view --json files` reports 0 files under `source/`. Devin was describing the wider `zja/spvdb` branch history, not the pinned-head diff.

**Why it matters:** Believing the narrative would flip the PR's class from "test/vendoring only" to "modifies a compiler IR pass," which raises the review bar substantially (a DebugValue/dead-code interaction is exactly the kind of subtle correctness change a challenger must dig into). An approver who trusts the reviewer prose over the file list can mis-scope the entire decision.

**How to catch it:** Devin's (and any reviewer's) prose is a prior, not the source of truth for *what changed*. Always reconcile the narrative's claimed touched-files against the authoritative `gh pr view <pr> --json files` before letting any file-specific reasoning move the decision. Same principle as verifying submodule pins at the gitlink, not the working tree.

**Fix:** In the review-doc synthesis, when Devin/CodeRabbit prose names files, cross-check them against the `files` list and annotate any that are absent from the diff ("Devin narrative referenced X — NOT in this PR's diff") so the challenger doesn't chase phantom changes.
