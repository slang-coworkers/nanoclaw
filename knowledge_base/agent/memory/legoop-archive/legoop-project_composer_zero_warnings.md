---
type: project
title: "Every `[composer] Unknown slash ref` warning is a prompt-quality bug; R18 in claude-composer-refactor.test.ts gates the invariant on nv-cowo"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Every `[composer] Unknown slash ref` warning is a prompt-quality bug; R18 in claude-composer-refactor.test.ts gates the invariant on nv-coworkers integration.

**Rule:** Composing any typed coworker must emit zero `[composer] Unknown slash ref /name in workflow body` warnings. R18 in `src/claude-composer-refactor.test.ts` discovers every concrete leaf type via `readCoworkerTypes(REPO_ROOT)` and asserts zero such warnings.

**Why:** the warning means the generated CLAUDE.md tells the agent to invoke a `/name` that doesn't resolve to anything in its leaf catalog (workflow / overlay / capability skill) — the agent is instructed to run a non-existent slash command. PRs #93 + #94 drove warnings 4 → 0.

**How to apply:**
- In workflow/overlay source, backticked `` `/name` `` is a claim "name is a resolvable slash ref at compose time in every leaf that includes me." If that claim can't hold for all consumers (e.g., `/implement` isn't in project leaves — they only have `/<project>-implement`), **rewrite as prose** ("the project's implement workflow"), not as a backticked ref.
- The composer rewriter rewrites backticked workflow refs to section pointers, overlay refs to Task-tool pointers, and leaves capability skill refs literal. Unresolvable refs warn.
- R18 runs on nv-main with no leaves (trivial pass) and on nv-coworkers integration with all 6 leaves (real gate). Don't merge a composer/source change to nv-coworkers that re-introduces a warning.

