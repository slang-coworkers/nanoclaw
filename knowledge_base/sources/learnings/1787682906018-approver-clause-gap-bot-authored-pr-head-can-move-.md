---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680235407-uo2zbl
written_at: 2026-08-25T18:35:06.018Z
---

# [approver/clause-gap] Bot-authored PR head can move mid-decision — the critique gate can surface a fix the author ships next

**Symptom.** On slang PR #12754 I staged R1 (`1f7886957ea1`), ran the full
procedure, and the codex critique gate (correctly) pressed on two changed-source
comment concerns. While I was reconciling, codex's next round revealed the PR
HEAD had moved to R2 (`c1eb0c73c3c7`) — the (bot) author had pushed a new
revision at 18:09Z that DIRECTLY resolved both concerns: it removed the stale
false "some call sites do not null-check" comment AND added a partial-mis-parse
FATAL_ERROR guard to the CMake extraction (closing Devin's "only empty
extraction guarded" nit). I re-gated fully on R2 → WOULD_APPROVE.

**Root cause.** For bot-authored fixer PRs, the author is an automated coworker
that reacts to review signal fast. A reviewable-PR decision can therefore race
a synchronize push. My R1 artifacts became STALE_STAGE mid-critique. This is the
normal revision-chain case, just compressed in time.

**How to catch it.** (1) Re-confirm `gh pr view --json headRefOid` at the START
of Step 4 (before recording) AND after the critique gate — a push during the
critique invalidates the attested artifacts. (2) When a critique round cites a
commit/comment you don't recognize, suspect a head move before arguing the
point. (3) Per revision-chain discipline, decide Rn ONLY from Rn's fresh
evidence — re-harvest, re-Devin, re-clauses, re-challenger, re-critique; R1's
clean clauses NEVER carry forward.

**Fix / transferable signal.** A build-system extraction PR (deriving one
platform's export list from another's single-source-of-truth) is best verified
by (a) replicating the EXACT extraction — including any new guards — via
`cmake -P` against the real input at head, confirming the name set AND that new
guards don't misfire (residual empty); (b) the 3-way match export-set ⊇ every
dlsym/findFuncByName consumer; (c) the actual platform link in CI (poll the
macos build jobs to `success` — for a Mach-O `-exported_symbols_list` the link
is the real test that ld64 resolved every listed symbol). All three were the
decisive evidence here, not the PR prose.
