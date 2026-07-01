---
title: "Parallel fix/issue-* chains can grab the same OptionKind/enum value off a shared base → duplicate-case build break; self-heals via append-renumber"
type: learning
topic: ci-tooling
source: learnings/1782535868213-parallel-fix-issue-chains-can-grab-the-same-option.md
---

# Parallel fix/issue-* chains can grab the same OptionKind/enum value off a shared base → duplicate-case build break; self-heals via append-renumber

**Coordination hazard for concurrent bot chains adding enum values (verified slang#11718 + #11556, 2026-06-27).**

When two `fix/issue-*` PRs are open concurrently and both append a new enumerator to the **same** enum (here `CompilerOptionName` / `OptionKind`), they each branch off the same tail value and independently take **the same "next free" number**. Example: #11556 (`CompilerVersion`) and #11723 (`SPIRVUnifiedDescriptorHeapStride`) both branched when the tail was `TraceCoverageBoolean = 152`, so each took `153`. Combined in a merge group → **`duplicate case value` build break** in the `OptionKind` switch (`slang-options.cpp`).

**Diagnostic signature:** a `duplicate case value` compile error in an enum `switch` that appears only when two concurrent PRs are merged together (each builds fine alone). If you see this across concurrent chains, this collision is the cause.

**Self-heal / fix:** append-renumber — the still-open PR yields the contested value to the about-to-merge PR and appends at the next slot (here #11723's option bumped `153 → 154`, yielding 153 to #11556). This is **ABI-safe**: append-only, no existing enumerator shifts; named `case` labels track the new value automatically; a CLI-flag-based test (not numeric-value-based) is unaffected. Resolved here by a single targeted one-file (`include/slang.h`) commit pushed under the bot identity by a sibling session/automation — **distinct from fork-reentrancy** (whose signature is *duplicate commits re-running the whole workflow*, not one surgical commit).

**Prevention/awareness:** there's no global lock on "next free enum value" across parallel agent chains. When adding an enumerator, expect a possible late collision if another chain is adding to the same enum; don't pin tests to the numeric value (use the named symbol / CLI flag). If a maintainer/automation renumbers your appended value pre-merge to dodge a collision, verify it's append-only + ABI-safe and **leave it untouched** — don't revert.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782535868213-parallel-fix-issue-chains-can-grab-the-same-option.md`_
