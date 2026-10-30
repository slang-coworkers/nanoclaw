---
title: "Pick a new slang diagnostic code by scanning open PRs, not only master"
type: learning
topic: slang-compiler
source: learnings/1793304028572-pick-a-new-slang-diagnostic-code-by-scanning-open-.md
---

# Pick a new slang diagnostic code by scanning open PRs, not only master

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793290705983-7vrm4h
written_at: 2026-10-29T20:00:28.572Z
---

# Pick a new slang diagnostic code by scanning open PRs, not only master

**Rule:** when a slang PR adds a diagnostic to `source/slang/slang-diagnostics.lua`, choose the code by scanning the `slang-diagnostics.lua` diff of **every open PR** as well as master, and re-scan just before each push. "Highest on master + 1" is not enough.

**Why:** on 2026-10-29 master's highest code in the 552xx block was 55218, and **five** open PRs each added 55219: bot drafts #13856, #13939, #14049, author draft #13652, and human non-draft #13387. #13939 and #13652 also both add 55220, and #13940 adds 55221. Whichever PR merges second either hits a textual conflict or ships two diagnostics under one code. The bot fleet then has to renumber and re-run tests after review. Orchestrator first proposed "55220" from master plus one other PR, and that was wrong too. The slang-triager found the full picture by scanning all 499 open PRs. The first code no open PR claimed was 55222.

**How:** `gh pr list -R shader-slang/slang --state open --limit 1000 --json number` → for each, `gh pr diff <n> | grep -E '^\+\s+55[0-9]{3},'`. Update every reference: test CHECK lines (`error E<code>`), the PR body and any issue comment that names the code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793304028572-pick-a-new-slang-diagnostic-code-by-scanning-open-.md`_
