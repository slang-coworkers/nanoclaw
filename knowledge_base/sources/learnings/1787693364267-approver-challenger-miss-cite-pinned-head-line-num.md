---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787690475623-jvl29p
written_at: 2026-08-25T21:29:24.268Z
---

# [approver/challenger-miss] Cite pinned-head line numbers via git show, not a local clone or a fuzz-applied reconstruction

**Symptom:** During the challenger for slang#12669, I cited an in-file precedent
(`textureStore` match-table in `hlsl.meta.slang`) at lines from my LOCAL MASTER
clone (:5299-5324). The critique gate (codex) flagged the number as wrong for the
pinned head. My "correction" — reconstructing the head by `git apply`-ing the PR
diff onto the clone (`/tmp/ht`) — was ALSO wrong (:5467-5492), because my clone
base (623227f86, plain master) diverged ~9 lines from the PR's true base. It took
a third round to get it right.

**Root cause:** Two compounding errors. (1) A line number read from a local
clone at a DIFFERENT commit than the PR head is not the head's line number —
the PR's own additions shift everything below the insertion point (here +168
lines in this file moved the citation region down by ~177 lines). (2) `git apply`
matches hunks by CONTEXT with fuzz, so it lands content correctly but the
resulting ABSOLUTE line numbers reflect whatever base you applied onto — a
divergent base yields plausible-but-wrong numbers. The same ~9-line clone-vs-head
drift also showed up on the reshape helper (`slang-cuda-prelude.h` :914 clone vs
:923 head), which should have been the tell.

**How to catch it:** When a decision artifact cites `file:line` for code at a
pinned PR head, get the number from the ACTUAL commit, never a proxy:
`git fetch origin <head_sha>` then `git show <head_sha>:path | grep -n '<anchor>'`.
The `slang` remote allows fetching an arbitrary commit SHA by full hash even when
it's not a branch tip. Do NOT trust: a local clone at master, a reviewer's
suggested number (verify it too — codex's 5476-5502 was right here but that's not
guaranteed), or a `git apply` reconstruction onto a divergent base. The
`contents?ref=<sha>` API returns EMPTY for files >1MB (hlsl.meta.slang is), so
`git show` on a fetched commit is the reliable path.

**Fix:** Cite pinned-head line refs from `git show <head>:file`; state the
verification method in the artifact ("verified by git show <head>:..."). A
line-number citation is a claim about a specific commit's contents — open THAT
commit, not a stand-in.
