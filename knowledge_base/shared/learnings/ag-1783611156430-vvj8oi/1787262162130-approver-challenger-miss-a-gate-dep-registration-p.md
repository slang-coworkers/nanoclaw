---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787260895286-uafg6v
written_at: 2026-08-20T21:42:42.130Z
---

# [approver/challenger-miss] A gate/dep-registration PR must be probed for a SECOND load path with the same trigger

**PR:** shader-slang/slang#12666 @2915364f7500 — "Record imported .slang-module as a file dependency (fixes #12663)". Decision: ABSTAIN_POLICY / OPEN_GAP.

## Symptom
The PR adds `addFileDependency` in `findOrImportModule`'s **primary** include-search loop (`slang-session.cpp:1740`) so an imported `.slang-module` appears in `-depfile`. My challenger verified every load-bearing correctness claim (digest symmetry vs `isBinaryModuleUpToDate`, no core-module leakage, in-memory-only so no format bump, a genuine multi-file regression test) and was about to WOULD_APPROVE. The codex DECISION_REVIEW tier caught what I missed: the **same function has a second `.slang-module` load path** — the standard-module fallback (`slang-session.cpp:1751-1793`) — which loads via `loadModuleImpl(..., ModuleBlobType::IR)` and `return module;` **without** `addFileDependency`. So `import neural;` / `import workgraph;` (resolved by `findStandardModulePath` at `:41` to shipped `source/standard-modules/*.slang-module`) still omit the module from `-depfile` — the exact bug #12663 reports, left uncovered.

## Root cause (of the MISS)
I accepted the PR body's assertion "the standard-module fallback … deliberately not touched" as if it were a *justified* exclusion. It was not: the body gives a real reason for excluding `loadModuleFromBlob` (its blob may differ from its path) but gives **no reason** for excluding the fallback — and the fallback holds *both* `pathInfo` and the just-loaded `fileContents`, so the identical fix applies cleanly there. An unjustified "not touched" in an untrusted body is a claim to probe, not a boundary to respect. This is the CLAUDE.md "gate/flag PR" probe #3 ("jobs, not passes — read the WHOLE function, a second unconditional job needs its own flag term") generalized from gate-flags to **dependency-registration / any behavior-registration PR**: read the whole producer function, enumerate EVERY path that produces the same kind of output, and check each one registers.

## How to catch it (transferable probe — add to challenger for register/gate/emit PRs)
When a PR adds a registration (`addFileDependency`, a decoration, an emit, a gate term) at ONE site inside a function that has multiple branches producing the same output kind:
1. Grep the enclosing function for every `return` that yields the same product (here: every branch returning a loaded `Module`). `findOrImportModule` had two: primary loop (fixed) + standard-module fallback (unfixed).
2. For each unfixed branch, ask: is its trigger reachable by a supported user action? Here YES — hierarchical imports of shipped standard/experimental modules resolve there.
3. An exclusion is only "safe" if the body JUSTIFIES it (unreachable, or a hazard like blob≠path). "Deliberately not touched" with no reason = OPEN_GAP, not a nit.
4. `loadModuleFromBlob` was correctly excluded because it reaches `loadModuleImpl` DIRECTLY, bypassing the file-search loop — verify such claims (I did; it holds) rather than trusting them.

## Fix (the loop lesson)
The two-tier gate did its job: codex is the reason this didn't ship as a false WOULD_APPROVE. But the probe should live in the challenger so tier-1 catches it next time. For any "populate/register X at the producer" PR, the FIRST challenger question is "how many producer branches are there, and does the PR cover all of them?" — before verifying the one branch it did touch.
