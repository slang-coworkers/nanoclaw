---
title: "Verify enforcing gates against combined-input cases + prove build-wiring"
type: learning
topic: ci-tooling
source: learnings/1784568398186-verify-enforcing-gates-against-combined-input-case.md
---

# Verify enforcing gates against combined-input cases + prove build-wiring

# Verifying an enforcing CI gate / correctness check: two failure modes that pass a naive read

When verifying that an *enforcing* check (a gate that `exit 1`s to block a PR) is correct, a per-branch read that is individually sound can still ship a real hole. Two disciplines, both learned from a live miss on shader-slang/slang#12157's C++ IR-version-bump differ (PR #12158), where a verify-at-head pass approved a tool the reviewer+codex then found broken:

## 1. Test decision logic against COMBINED / adversarial input cases, not each branch in isolation
The differ enforced "new IR instruction added ∧ version constant not bumped → fail." Its `removedKeys > 0 → return 0` early-return was individually defensible ("a rename shouldn't hard-block"). But in **combination** — a PR that removes/renames *something* AND independently adds an unrelated new instruction — the early-return let the new instruction ride in with no version bump, silently defeating the exact case the gate existed to catch. Reading each branch alone ("rename never hard-blocks" ✓, "additive path enforces" ✓) missed that one branch's early-return bypasses the other's enforcement.

**Discipline:** for any gate, enumerate the *cross-product* of input conditions (added ∧ removed, added ∧ renamed, empty-diff ∧ …) and confirm the enforced case still fires under every combination — especially where an early-`return 0` / short-circuit precedes the enforcing branch. The fix here was to key on a stable identity (the instruction's stable-ID not present in the base ID set = genuinely new → enforce), with no early return.

## 2. Prove build-wiring claims — don't accept a PR-body assertion that the target builds in the CI path that runs it
The tool was registered via a CMake `generator()` macro that only wires it under an `all-generators` aggregate — which nothing in the default `cmake --workflow --preset debug` (the CI build the check runs in) actually depends on. So the binary was never built in that path; the wrapper's `find` for it would be empty → `exit 1` on **every** PR. The PR body claimed "built via all-generators dependency"; that claim was accepted rather than proven.

**Discipline:** when a check depends on a build artifact, prove the artifact is actually produced by the specific CI build/preset that invokes the check (trace the dependency graph or build it), rather than trusting a description of the wiring. The fix was an explicit `add_dependencies(slang-test <tool>)`.

## Meta-lesson
The review/codex gate is what caught both — which is the point of a multi-stage review. But a verifier should aim to catch correctness holes *before* the gate, and these two patterns (combined-input bypass, unproven build-wiring) are the recurring ways a "looks correct per branch" read passes broken enforcement. Applies to any coworker doing verify-at-head, PR approval, or shadow review of an enforcing check.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784568398186-verify-enforcing-gates-against-combined-input-case.md`_
