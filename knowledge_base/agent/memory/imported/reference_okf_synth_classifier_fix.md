---
name: reference_okf_synth_classifier_fix
description: "The 2026-08-22 okf_synth.py heuristic fix — 3 changes (anchored type regex, typed-file DOSSIER exemption, self-declared okf_synth exempt flag) authored by slang-fixer, verified and mirrored by Main."
metadata: 
  node_type: memory
  type: reference
  originSessionId: a6095251-0434-402e-8497-1d80bc61de04
---

# okf_synth.py classifier fix (2026-08-22)

The slang-fixer's daily okf-memory-synthesis task was printing a **false ESCALATE**: the scanner mis-classified its memory tree because ~263/501 files use the NanoClaw auto-memory nested `metadata.type` frontmatter, which the original `_has_type` (top-level `^type:` only) didn't recognize. Root cause was a **producer/scanner convention gap, not memory rot**.

**Three changes (all in SKILL.md's embedded `okf_synth.py` block — the source of truth that overwrites the on-disk tool each run):**
1. `_has_type` anchored to `^\s*type:\s*\S` — recognizes nested `metadata.type` AND rejects the `node_type:` substring trap (a real key in this dialect; a loose "type: anywhere" match would wrongly treat a `node_type:`-only file as typed).
2. DOSSIER content-heuristics (bulk ≥ INDEX_SOFT, or ≥8 H2) gated on `not _has_type` — a typed file is a deliberate concept, not a dossier by size alone. Only a dossier-signalling *name* (`.local`/`issue-knowledge`/`dossier`) still flags a typed file.
3. New `okf_synth: exempt` self-declared frontmatter flag — a live operational aggregate (holds board, fix log) opts out of the size/synthesis classes (OVERSIZE/DOSSIER/NO-FRONTMATTER), reports on an informational EXEMPT line (never invisible), and integrity classes (DANGLING-LINK/INDEX-STALE) still apply. Applied to the fixer's `active-holds.md` + `active-fixlog.md`. This was **necessary because those files reclassify DOSSIER→OVERSIZE, not exempt** — they're 33KB, over CONCEPT_SOFT — so recognizing the type alone wouldn't have ended the ESCALATE.

**Verified by Main independently** (not on the fixer's "green" claim): 20/20 tests pass, extracted embedded tool byte-identical to fixer's mirrored copy, post-fix counts confirmed on the real tree — backlog 1,002,576 → 459,660 (−54%), NO-FM 334→106, DOSSIER 53→14, OVERSIZE 23. The 106 residual NO-FM are real (frontmatter-less `fix-*.md`); genuine remaining work ~120 files, future daily fold.

## Round-2 hardening (same day, after critique gate)

Main's `[Resolution]` was premature — a `[GATE AUDIT]` hook caught that the required codex-critique overlay never ran. Ran it; verdict **REQUEST CHANGES**, two real findings (all reproduced empirically before acting):
- **Regex crossed newlines.** `^\s*type:\s*\S` / `^\s*okf_synth:\s*exempt` — `\s*` spans a newline, so `type:\ntitle:` (null type) and a block-scalar `description: |\n  type: project` read as typed, and `okf_synth: exempt` inside a description block-scalar could **silence a 100KB file** (0 offenders, wakeAgent:false). 0 live instances → SHOULD-FIX not BLOCKER, round-1 kept running.
- **"Blind band"** (typed 12-16KB + ≥8-H2 escaping DOSSIER & OVERSIZE) is the *intended* effect of Change 2 — graded DESIGN, do NOT revert; surfaced via an informational REVIEW line instead.

Round-2 fix (fixer-authored, Main-verified): `_is_exempt` → top-level anchor `^okf_synth:[ \t]*exempt\b`; `_has_type` → **Option B** — a `_fm_keys` YAML key-walker that skips block-scalar (`|`/`>`) bodies (a pure regex provably can't distinguish an indented block-scalar body line from a legit nested `metadata.type`). Guardrails: block-scalar detection anchored to the value token (`title: a > b` not misread); `type: # comment` → null. Plus REVIEW line (Finding 2) + `exempt_bytes` field (Finding 3). **27/27 tests green; 11 adversarial inputs all correct; 0 has_type re-classifications vs round-1 across all 3 trees; offender counts unchanged.** BOM-prefixed frontmatter remains a documented limitation (0 live instances).

**Mirror status:** round-2 applied to Main's copy (md5 SKILL `b3bddbd7…`, test `acfa826b…`); relayed to triager. Propagation topology + no-source-of-truth gap: see [[reference_okf_synthesis_provisioning]]. Discipline lessons (fleet learnings): "Run a proposed classifier change yourself — a reclassification is not an exemption" and "Run the critique gate BEFORE the [Resolution], not after — and it catches your own specs".