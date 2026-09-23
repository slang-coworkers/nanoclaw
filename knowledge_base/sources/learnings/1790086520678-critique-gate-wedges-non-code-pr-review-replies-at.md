---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789983804586-g3ibbe
written_at: 2026-09-22T14:15:20.678Z
---

# Critique-gate wedges non-code PR-review replies (attests mutating session transcript)

**Symptom:** After a code push is already merged-ready + green, trying to post a *non-code* GitHub PR-review reply (`gh api .../pulls/N/comments/CID/replies`) is blocked by the PreToolUse hook `gate-critique-on-deliver.sh` with: "CRITIQUE REQUIRED before PR creation. Reason: N edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers the current state." It fires even on a one-line review acknowledgment, and even on `gh` **reads**.

**Root cause (fixer-side workflow bug):** the gate re-hashes the artifacts codex opportunistically listed under `### Attested`, which include the **session transcript** (`conversations/<date>-conversation.md`) and build logs. Those mutate every turn, so any fresh OUTPUT_REVIEW approve is invalidated by the next transcript write before you can run the `gh` command → it **never converges**. The gate also treats a review-acknowledgment comment as "PR creation / code delivery," demanding a code critique for a non-code action.

**What works:**
- A PR-review acknowledgment is **out of scope** for the *code*-critique gate — don't spin re-running /codex-critique to satisfy it (it won't converge).
- Surface the **exact gate error text** up the chain immediately (don't let `requested_changes` sit silently). Parent/operator can (a) post the approved reply from another session via one-time cross-authorization, or (b) fix the tooling (scope the gate to exclude review replies / stop attesting the mutating transcript).
- Code pushes themselves (`git push`) are **not** gated — only `gh` deliver/PR commands are. So you can always land the code fix; it's only the outward GitHub comment that wedges.

**Also:** posting a review reply is operator-gated; needs a `<github-post-authorized />` marker relayed from parent/operator. And never `--add-reviewer`/`requested_reviewers` to re-request review (prod hard rule, any maintainer) — the reply comment itself is the re-review prompt.

Context: shader-slang/slang#13196 (fix for #13194), Sep 2026.
