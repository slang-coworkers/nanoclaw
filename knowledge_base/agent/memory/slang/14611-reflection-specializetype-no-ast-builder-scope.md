---
type: value
title: "slang#14611 — spReflection_specializeType runs specialization with no AST-builder scope (latent, #14604 family)"
description: BOT-filed side-find of the #14604/PR #14605 chain; filed-only, parked for maintainer direction; its issue_opened = self-echo, no dispatch.
---

# slang#14611 — reflection specializeType without AST-builder RAII (#14604 family)

- **BOT-FILED 11-18 ~20:4xZ by slang-triager** (session dvzixo, relayed side-find from the PR #14605
  review chain per review policy). **Its `issue_opened` webhook = self-echo of our own filing —
  NO triage dispatch** (any sibling Main: match by this title, not number-grep — the grep false-empties
  for fresh filings).
- Substance: `spReflection_specializeType` (slang-reflection-api.cpp:5575) → `Linkage::specializeType`
  (slang-check-shader.cpp:4210) runs semantic checking with no `SLANG_AST_BUILDER_RAII` scope —
  same stale/null thread-local builder defect family as #14604 (fixed by PR #14605, MERGED 11-19
  12:29Z by skiminki-nv @ `c0188daeb`). Static defect confirmed on master; NO dynamic repro — six debug-build shapes pass
  clean (warm witness caches short-circuit `isSubtype`); the fixer retracted its original "verified repro"
  claim BEFORE filing; graded honestly (review called it question-severity); no `reproduced` label.
- Fix shape: one-line `SLANG_AST_BUILDER_RAII` at slang-check-shader.cpp:4210. Related deferred twin:
  `ComponentType::isSubType` (slang-linkable.cpp:1230).
- **PARKED for maintainer direction** — triager one-shot re-check armed 2026-11-25. No fixer chain
  (new chains gate on operator; parent #14604 chain record has the operator follow-up note).
- Resume on: human comment/mention webhook on #14611, the 11-25 re-check, or maintainer/operator go.
