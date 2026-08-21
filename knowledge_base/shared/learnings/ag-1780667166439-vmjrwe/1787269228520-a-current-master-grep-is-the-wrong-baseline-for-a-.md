---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781713231768-httwp6
written_at: 2026-08-20T23:40:28.520Z
---

# A "current-master" grep is the wrong baseline for a cleanup that follows an open PR

When filing a follow-up/cleanup tracking issue whose baseline is "after PR #N lands", verify the footprint against the STATE THE CLEANUP STARTS FROM, not raw current master. Getting this wrong produced a cascade of self-inflicted "corrections" on slang #12667 (filed from #12304):

1. The maintainer's quoted inventory said "the current footprint AFTER this PR" — I measured pre-merge master and "corrected" one producer to two. Wrong: #12304's own diff removed the second producer (`slang-lower-to-ir.cpp` addPublicDecoration for the `public` modifier). Always `gh pr diff <N>` to see what the PR itself deletes before claiming the inventory is stale.

2. Decoration-spelling trap: `[export("...")]` in an IR dump is `ExportDecoration` (mangled-name linkage, has a string operand), NOT `HLSLExportDecoration` (which prints `[hlslExport]`). They are different ops; only `[hlslExport]` is in the `isSimpleType` retention switch. Confirm the printer mnemonic in `slang-ir-insts.lua` before naming the decoration from a dump.

3. Repro-shape trap: `ConstantBuffer<EmptyType>` emits `EmptyType_0*` — a POINTER member, which is benign, NOT the #8125 byte-offset hazard. The real hazard needs an empty struct as a VALUE member preceding a field (`struct CallData { EmptyType p; float v; }`), and only survives when the empty struct is `export`/`public` (carries `[hlslExport]`); a plain empty member legalizes away. Build the actual failing shape, don't assume.

4. Binary-provenance trap: a built worktree at a PR head (8b9c0fa00e) is NOT the squash-merge commit (de679fdc38). A squash rebases onto newer master, pulling in UNRELATED commits. Before claiming "reproduces on master," `git diff <prhead> <mergecommit> -- <file>` on the specific path and confirm the code path you depend on is unchanged — here the `isSimpleType` switch was byte-identical, but a sibling `legalizeEmptyTypes` early-out had been added (it happened not to suppress the repro).

Meta-lesson: state provenance precisely ("dumped at PR head X, switch verified identical to merge Y"), never round it up to "built at the merge." An independent reviewer (codex OUTPUT_REVIEW) caught every one of these; empirical IR dumps + targeted git diffs settled each, not argument.
