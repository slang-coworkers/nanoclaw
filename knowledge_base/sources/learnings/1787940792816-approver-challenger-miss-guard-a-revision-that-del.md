---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787679838053-tefesj
written_at: 2026-08-28T18:13:12.816Z
---

# [approver/challenger-miss-guard] A revision that deletes a carve-out to fix leg A can regress leg B on an off-per-PR-CI path — re-probe the carve-out's original justification

**Context.** slang#12717 R1 (BLOCK): a slang-test guard rejecting absolute `-o` paths kept a `/dev/null` carve-out and left 3 std-suite `-o /dev/null` tests → broke the Windows every-PR CI leg. R2 (synchronize) responded by **removing the `/dev/null` carve-out entirely** and converting those 3 tests to `-o -`. That fixed the every-PR break — all matching per-PR jobs green (16 `/ test-slang` + 6 `/ test-slang-rhi`, 0 non-success, incl. Windows). I re-BLOCKed R2 anyway.

**Why R2 was still a 🔴.** The carve-out existed for a reason the R1 PR body itself documented: ~1000 `docs/generated/tests` `.slang` directives use `-o /dev/null` and run **nightly on Linux** (`nightly-slang-test.yml` → `slang-test -test-dir docs/generated/tests`). Removing the carve-out makes the guard reject `/dev/null` on ALL hosts, so those **972 nightly test files** (~1000 directives) would all fail. `_common.md` at the head still *mandates* `-o /dev/null` and states `-o -` is NOT a substitute for `-dump-ir` (IR is already on stdout; adding target text mixes them and FileCheck fails) — so a mechanical `/dev/null`→`-o -` swap there isn't even valid. The PR migrated neither the docs-generation idiom nor `expected-failures.txt`. The bot author acknowledged this exact break in a PR comment as an open question to the maintainer.

**Transferable probes:**
1. **When a revision DELETES a carve-out / special-case / exemption to fix one failure, re-open the ORIGINAL justification for that carve-out.** A carve-out almost always encodes a real dependency; deleting it doesn't erase the dependency, it relocates the failure. Grep the tree for the inputs the carve-out used to protect (here: `-o /dev/null` across all test trees, not just the one the fix touched).
2. **Green per-PR CI is NOT exculpatory when the affected suite runs on a different schedule/tree.** Enumerate WHERE the affected inputs run: per-PR vs nightly vs release. `docs/generated/tests` is nightly-only (`-test-dir docs/generated/tests`), so a fully-green per-PR run is structurally incapable of catching a regression there — the classic false-green. Ask "could the safety observation have come out otherwise?" — if per-PR green looks identical whether or not the nightly tree is broken, it carries no bits about the nightly tree.
3. **A generated-test tree fails as a class, at its generation source.** ~1000 files sharing an idiom (`_common.md` mandating `/dev/null`) can't be fixed by hand-editing generated files (the next regen re-adds the idiom, and unique-name races appear under parallel workers). The fix belongs in the generation source + regen — which makes it a real prerequisite, not a one-off edit.

**Revision-chain discipline that worked:** treat each `synchronize` as a full fresh procedure (fresh clauses, harvest, Devin, challenger, critique) — one ledger row per revision commit. R1's BLOCK reason (Windows every-PR + #12334) did NOT carry forward; R2 earned its own distinct reason (nightly-Linux docs regression). Also: Devin's flag was **stale-framed** (it re-described R1's removed carve-out) — I quarantined its framing and based BLOCK on my own head-current investigation rather than parroting the flag. A bot review can lag the head by a revision; verify its subject commit before trusting its framing.
