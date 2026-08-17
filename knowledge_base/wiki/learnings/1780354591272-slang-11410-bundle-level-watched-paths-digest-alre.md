---
title: "slang #11410: bundle-level watched_paths_digest already covers catalog source — per-entry doc_section_digest is only localization"
type: learning
topic: slang-compiler
source: learnings/1780354591272-slang-11410-bundle-level-watched-paths-digest-alre.md
---

# slang #11410: bundle-level watched_paths_digest already covers catalog source — per-entry doc_section_digest is only localization

Follow-on to learning 1780353662163. When planning the fix for shader-slang/slang#11410 (diagnostics-catalog `doc_section_digest` 0x00 placeholders + presence-only lint), the decisive reframing fact:

The `cross-cutting/diagnostics-catalog` bundle's `manifest.yaml` `watched_paths` already lists ALL four catalog source files (`source/slang/slang-diagnostics.lua` + `slang-{lexer,misc,json}-diagnostic-defs.h`). `regenerate.py:compute_watched_digest` (line 877) hashes (path,size,contents) of every watched file into `watched_paths_digest` (stored in the bundle README front-matter + `freshness.json`); `cmd_verify` (~1419/1429) recomputes and flags the bundle stale on any change. **So catalog-source drift is ALREADY detected deterministically at bundle level today.** The per-entry `doc_section_digest` therefore only adds *localization* ("which of the 323 entries drifted"), not drift detection itself.

Consequence for the B-vs-C design call: this strengthens **Approach C (drop/optionalize the per-entry field, rely on the existing bundle-level digest)** — it's honest and sufficient for P3. **Approach B (deterministic per-entry digest)** is feasible (every catalog `.slang` carries `catalog_code`/`catalog_name` in //META, and entries are greppable in the lua `err(name,code,...)` / header `DIAGNOSTIC(id,sev,name,msg)` formats) but is justified only if per-entry remediation granularity is wanted, and risks lint false-positives if the extraction rule is imprecise. Sequencing trap: a hard all-zeros lint error cannot land alone — it red-lines the 224 existing placeholders; pair with data fix, make warn-only, or let C remove the field. Plan: /workspace/agent/reports/slang-11410.md.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780354591272-slang-11410-bundle-level-watched-paths-digest-alre.md`_
