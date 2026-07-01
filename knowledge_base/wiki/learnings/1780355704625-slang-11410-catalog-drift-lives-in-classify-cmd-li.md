---
title: "slang #11410: catalog drift lives in _classify/cmd_list_stale (not cmd_verify) + per-entry CHECK-pin already exists"
type: learning
topic: slang-compiler
source: learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md
---

# slang #11410: catalog drift lives in _classify/cmd_list_stale (not cmd_verify) + per-entry CHECK-pin already exists

Verified on current `master` (`regenerate.py` blob sha `a8ad8025`, 2887 lines; the issue/triage/plan cite an older HEAD `378491c6c` whose line numbers have drifted). Two corrections/additions to prior #11410 learnings:

**1. Bundle-level drift detection is in `_classify` (L1517–1536) / `cmd_list_stale` (L1539), NOT `cmd_verify`.** `cmd_verify` (L1886) runs slang-test (pass/FAIL reporting) and never touches digests. `_classify` recomputes `compute_watched_digest` (L943) and `compute_source_doc_digest` (L961) and compares to the stored `watched_paths_digest`/`source_doc_digest` → returns "stale"/"fresh". `cmd_mark_fresh` (L1593–1612) writes them. Prior learning `1780354591272` attributed this to `cmd_verify` — wrong function name, right substance. If you cite drift detection, cite `_classify`/`cmd_list_stale`.

**2. NEW: per-entry source pinning already exists at CHECK level, independent of `doc_section_digest`.** `_lint_test_file` (L1343) enforces a `//DIAGNOSTIC_TEST` source-pin rule (L1403–1459): every diagnostic test must pin to its diagnostic via an explicit code / caret-anchored CHECK, and for catalog bundles (`is_catalog`, L1439) a bare 4+digit numeric (L1440–1442). So catalog tests are already tied per-entry to their diagnostic code at lint time — catching renumber/reword/misattribution. This means `doc_section_digest` is redundant on TWO layers (bundle-level source digest + per-entry CHECK-pin), not one — it strengthens the "scope it down (Approach C)" verdict.

**3. `doc_section_digest` is value-validated nowhere** — it appears at exactly one line (L118, `_REQUIRED_TEST_META_KEYS`); lint is presence-only (L1351–1353). By contrast `doc_ref` IS existence-checked (L1378–1392).

**4. The `_common.md` vs catalog-prompt digest "contradiction" is actually a per-section override** (`_common.md` L7: per-section prompt wins). `_common.md` L267–269 = sha256 of an anchor-pinned narrative section; catalog prompt L65 = "sha256 of the catalog-entry line". The override governs but is underspecified for multi-line lua `err()` entries and unimplemented — which is why generators punted to 0×64.

**Maintainer verdict rendered 2026-06-02: Approach C** (scope `doc_section_digest` down for the catalog bundle via `is_catalog`, strip from 323 files) + warn-only malformed-digest lint guard; B deferred, A rejected.

**Infra note:** in the slang-maintainer container, `gh` cannot post (HTTP 401 `app_not_connected`, OneCLI "GitHub is not connected"). Public-repo reads via `gh api repos/...` succeed (unauthenticated fallback) but any authenticated op (`gh api user`, posting a comment) fails. To post GitHub comments, GitHub must be connected for the container; otherwise hand the drafted comment up the chain.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md`_
