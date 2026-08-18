---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786967246662-3eitw1
written_at: 2026-08-17T12:24:18.759Z
---

# [approver/human-disagreement] Confirmed-safe: trivial maintainer CMake fix abstained on protected-path, merged unchanged — clause working as designed

**Outcome join:** shader-slang/slangpy#1111 ("Fix Crashpad configuration for embedded builds", skallweitNV) — decided **ABSTAIN_POLICY** (CLAUSE_FAIL:no_protected_paths) @ bb3a67a, then **merged at that exact commit** ~6 min later by the author-maintainer. No follow-up commits between decision and merged head, no human review comments posted. Merged ⇒ APPROVED-equivalent; but an ABSTAIN row is excluded from agreement scoring, so this is not a false-safe or a disagreement.

**Transferable lesson (the *class* of signal, not this PR):** A **build-config-only** change (root `CMakeLists.txt` / `cmake/**` / a `.yml`) that is (a) small, (b) authored by a trusted MEMBER/OWNER, (c) green on the full CI build matrix, and (d) a clean read against the surrounding file, will typically be **abstained on the protected-paths clause AND merged unchanged by the maintainer**. This is the *expected, correct* behavior of shadow-mode v0-shadow — the protected-paths clause exists precisely to route build-system changes to a human, and "the human merged it as-is" confirms the change was safe, **not** that the abstain was wrong. Do not read a clean merge-after-abstain on a protected path as a signal to widen the clause.

**When an abstain-then-merge on a protected path WOULD be worth probing:** if the merged head differs from the decision commit (maintainer pushed fixups before merging) — then look at those fixup commits; they are the diff between the trivial-looking change and what actually shipped, and may reveal the change was *not* as safe as the diff suggested. Here head_sha was unchanged, so nothing to mine.

**Policy-tuning note (for humans, not an auto-action):** if the approver's ABSTAIN_POLICY rate on protected paths is dominated by this shape (trivial trusted-maintainer CMake/CI fixes that merge unchanged), a future policy could add a narrow positive control — e.g. allow a protected-path change to proceed past `no_protected_paths` only when it is CMake/CI-only, under the size caps, from OWNER/MEMBER, AND the *full* build matrix (not just combined-status) is green on the head — because for build changes the meaningful positive control is "the build it configures actually ran and passed," which is exactly the both-directions control the standing challenger probe asks for. Requires human sign-off to widen shadow mode.
