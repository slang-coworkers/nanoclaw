---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788201669194-g6v28y
written_at: 2026-09-02T23:30:04.224Z
---

# [approver/challenger] On a synchronize, diff the PR's OWNED files to tell a base-merge from a real revision; neither a base-merge nor a human APPROVAL clears an unaddressed correctness flag or red downstream CI

**Context.** shader-slang/slang#12840 rev4 (@84532584) arrived as a synchronize whose raw `compare(prevHead...newHead)` file list was huge (dozens of `.github/**`, `docs/**`, `README.md`, `CLAUDE.md`). That looked like a big change but was a **master merge** updating the PR's base — the PR's net diff vs base was still the same 12 matrix-layout files, and a **targeted** compare of the three flagged logic files (`slang-ir-specialize-matrix-layout.cpp`, `slang-emit.cpp`, `slang-code-gen.h`) between the two heads was **empty (byte-identical)**.

**Technique — don't trust the raw compare file list on a synchronize.** `gh api repos/O/R/compare/<prevHead>...<newHead>` uses merge-base semantics, so when the branch merged master it returns ALL of master's delta, drowning the (possibly zero) PR-owned change. To answer "did this revision actually change the flagged logic?": (1) `gh pr view <pr> --json files` to confirm the PR's real changed-files set vs base; and (2) filter the compare to the specific flagged files (`.files[] | select(.filename==...)`) — an empty patch there means the logic is untouched. A base-merge does NOT address any prior review concern; treat the revision's correctness posture as identical to the previous code-bearing revision.

**Calibration — a human APPROVAL is not a correctness clearance for the approver.** At rev4 a maintainer formally APPROVED, yet an independent tool (Devin) still flagged the same 🔴 across rev2/3/4, CodeRabbit's Major target-aware-default inline comment stood, and the downstream "SlangPy Tests" CI stayed red on a `pr: breaking change` (int→enum public contract that "requires downstream updates"). The approver's decision was ABSTAIN on policy (fork head + red CI) — excluded from agreement scoring, so it does not contradict the human. The right move is to keep surfacing the still-open, code-unaddressed correctness concern + red downstream CI to the human rather than letting the approval imply they're resolved. Persistent red downstream CI on a breaking change is itself strong independent evidence to keep flagging regardless of who approved.

**Meta note.** The `record_human_verdict` MCP tool referenced by the skill for `github.pr_review`/merge joins is NOT present in this approver's toolset — human APPROVED/CHANGES verdicts can currently only be surfaced in the report, not joined onto the ledger row. Worth an operator fix if human-outcome joins are meant to be automated here.
