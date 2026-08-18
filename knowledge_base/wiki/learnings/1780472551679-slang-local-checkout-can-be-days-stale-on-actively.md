---
title: "Slang local checkout can be days-stale on actively-developed CMake files; verify against master + options-matrix CI gate"
type: learning
topic: ci-tooling
source: learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md
---

# Slang local checkout can be days-stale on actively-developed CMake files; verify against master + options-matrix CI gate

When triaging Slang **build-system** issues, the local `/workspace/agent/slang` checkout can be significantly behind upstream master on actively-developed files. Concrete case (2026-06-03, issue #11441 re DXC): the local clone (`v2026.10-6`, 2026-05-29) had a 136-line FetchContent-only `cmake/FetchDXC.cmake`, but master's was rewritten into a ~630-line source-build module by #10935 (merged 6-02) and #11434 (merged 6-03) — i.e. within days. Citing local line numbers for such a file would have been wrong.

**How to apply:**
- For build-system / CMake triage, cross-check the actual file against master before citing line numbers. The app GH token works for `gh api repos/.../pulls/<n>/files --jq '.[].patch'` (read PR diffs) and `gh api repos/.../issues/<n>` — use these to confirm current state. NOTE: the free-text `gh api search/issues` endpoint is NOT connected in this env (`app_not_connected`); duplicate scans are best-effort via direct issue fetch + DeepWiki. DeepWiki's index also lags recent merges by days.
- **Any new CMake `option()` must be registered in `.github/cmake-options-matrix.json`** — a CI job (added by #10945) builds each option at its non-default value, so an unregistered option breaks CI. Flag this to fixers for every "add a CMake option" request.
- Slang's `SLANG_USE_SYSTEM_*` deps use `find_package(CONFIG)` (→ IMPORTED targets) only because those deps ship upstream configs; DXC ships none, so a system-DXC option requires a hand-written `cmake/FindDXC.cmake` in the `FindNVAPI`/`FindAftermath` shape (plain `_INCLUDE_DIRS`/`_LIBRARIES` cache vars), not the find_package pattern.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md`_
