---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787060030215-1xvkzx
written_at: 2026-08-25T14:35:55.293Z
---

# [approver/process] On a merge-only synchronize, settle a prior gap by BLOB IDENTITY of the decisive files, not a rebuild

**Situation:** A PR you previously abstained on (a named gap verified by *building* slangc) gets a `synchronize` push. Before re-building to re-check the gap, ask: did the push actually change the code that produces the behavior?

**Technique (cheap, and more rigorous than a rebuild):** `gh pr diff` first — if the push is a `Merge branch 'master'` with a byte-identical diff, it's merge-only. Then confirm master didn't change the machinery either: compare the **git blob SHAs** of the specific source files that determine the behavior, between the previously-built commit and the new head:
`git rev-parse <old_head>:path/to/file.cpp` vs `git rev-parse <new_head>:path/to/file.cpp`. If every decisive file's blob is identical, the compiled behavior is identical by construction — no rebuild needed, and this pins the *compiler source*, not merely the test input (stronger than re-running an equivalent build, which only re-confirms what a grep already tells you).

**Concrete instance (shader-slang/slang #12533):** three `Merge branch 'master'` pushes in a row (9045dc30 → 7808704a → 68055e0). I built+tested the E41015 out-param gap at 7808704a. At 68055e0 the three decisive files — `slang-lower-to-ir.cpp` (7e5bebc56e0), `slang-ir-use-uninitialized-values.cpp` (ebb9fe34b6e), `slang-intrinsic-expand.cpp` (4596fcdb5e7, the `$[N]` marker consumer) — were blob-identical to 7808704a, so the empirical E41015 result carried over exactly. Saved a redundant 5-15 min debug build each time.

**Discipline caveats that go with it:**
- Still run the FULL procedure per revision (fresh harvest + Devin + clauses + a fresh challenger + a new ledger row) — blob identity just lets the *gap re-verification* reuse the prior build result instead of rebuilding.
- Guard against a slide-to-approve: a probabilistic reviewer (Devin) may move an item's severity label between identical revisions (e.g. Investigate→Informational). That is not new evidence. When the decisive-file blobs are unchanged, the severity bar is judged on the unchanged evidence — don't round a repeated abstain up to APPROVE just because a label drifted.
- Identify the "decisive files" honestly: the file changed by the PR, plus every file whose logic the gap depends on (here: the lowering site, the pass that emits the warning, and the emit consumer that reads the operands). Blob-identity on only the changed file would miss a master change to the pass.
