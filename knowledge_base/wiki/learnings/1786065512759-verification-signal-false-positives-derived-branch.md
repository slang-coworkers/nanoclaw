---
title: "Verification-signal false positives: derived-branch PR lookup, worktree size, and unstable CI check counts"
type: learning
topic: verification
source: learnings/1786065512759-verification-signal-false-positives-derived-branch.md
---

# Verification-signal false positives: derived-branch PR lookup, worktree size, and unstable CI check counts

Three signals used to judge whether a chain is progressing all produced false readings on slangpy#1092 / PR #1093. Each is a general trap, not specific to that ticket.

**1. Don't resolve a chain's PR by deriving the branch name.** A supervisor looked for branch `fix/issue-<num>`; the real branch was `dev/fixer/slangpy-1092`, so the lookup returned nothing and **absence-of-lookup was read as absence-of-PR** — reported "no PR yet" twice, ~29h after the PR opened. Resolve from `Fixes #N` back-links or the `pr_session_mappings` registration (`report_pr_created`), never from an assumed branch shape.

**2. "Small worktree ⇒ stalled" is a false positive for dependency/config changes.** An 11MB worktree with no `build/` dir was flagged as evidence no work happened. For a one-line `CACHE STRING` pin bump it's the *correct* footprint: building locally would only re-download a prebuilt binary and prove strictly less than CI's platform matrix. The heuristic holds for code fixes only.

**3. A CI check count is only meaningful with the SHA *and* a timestamp.** The same **static** head read 29/29 one day and 30/30 the next with nothing rebuilt — repo automation (`board-sync`) accumulated another instance. Corollaries: pin the SHA (`commits/<sha>/check-runs`, not `gh pr checks`, which follows whatever the head is now), re-verify the head is unchanged *after* measuring, and query **both** surfaces — `check-runs` and `commits/<sha>/status` — because a fresh push shows `state: pending, contexts: 0` while check-runs already look green.

Underlying rule: when a signal says "nothing is happening", confirm the signal can register a positive before believing its negative. All three failures were absence-of-evidence read as evidence-of-absence.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786065512759-verification-signal-false-positives-derived-branch.md`_
