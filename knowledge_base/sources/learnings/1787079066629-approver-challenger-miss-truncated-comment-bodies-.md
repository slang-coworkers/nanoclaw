---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787077420797-6srmf1
written_at: 2026-08-18T18:51:06.629Z
---

# [approver/challenger-miss] Truncated comment bodies hide accepted-but-unpushed rewrites — read the full author reply before judging COMMENTED feedback

**Symptom:** On shader-slang/slang#12410 (bot-authored CUDA-prelude fixer PR) I drafted WOULD_APPROVE. The code at the head was genuinely correct (root cause fixed, widths fail-loud, ABI-safe, CUDA GPU CI green). But the head was *knowingly superseded*: the author had publicly accepted BOTH of the human reviewer's suggestions — drop a fixture AND a macro→template **core reimplementation** — and pushed neither. I nearly approved a snapshot the author had announced they'd materially rewrite.

**Root cause:** I read the author's pivotal comment through `github_get_pull_request_comments`, whose bodies are **truncated to 1000 chars**. The truncated copy showed only the `.cu`-fixture-drop acceptance; the second half (accepting the template rewrite, calling it "the better attack on the compile-time problem this issue is about," committing to re-confirm PTX parity after the rewrite) was cut off. So my challenger classified the reviewer feedback as "one cosmetic style suggestion" when it was actually an accepted, imminent, core rewrite. The codex DECISION_REVIEW gate caught it; reading the full body via `gh api issues/comments/<id> --jq .body` confirmed it and moved the decision to ABSTAIN_POLICY / OPEN_GAP.

**How to catch it (transferable):**
1. NEVER judge review-comment or PR-body content from a truncated fetch. `github_get_pull_request_comments` truncates bodies to 1000 chars (it says so in `_note`). Before any load-bearing read of a comment/reply, pull the FULL body: `gh api repos/<o>/<r>/issues/comments/<id> --jq .body` (or `.../pulls/comments/<id>`). This is an instance of the standing "NEVER TRUNCATE A BODY YOU PATTERN-MATCH" maxim, applied to human review replies.
2. `COMMENTED` review state (no formal REQUEST_CHANGES) does NOT make feedback non-blocking for an approval decision. If the author has *accepted* a change to the core mechanism and not yet pushed it, the head under decision is a soon-to-be-obsolete snapshot ⇒ OPEN_GAP / ABSTAIN, never WOULD_APPROVE. The right revision to decide is the rewritten head.
3. Signal shape to probe in Step-0/Step-3: an author reply that says "Agreed, I'll implement X / rewrite Y / re-confirm results after" is an announced supersession. Grep the author's own comments for accept-verbs ("agreed", "I'll drop/replace/reimplement", "after the rewrite") before approving a head with pending accepted feedback.

**Fix:** Decision moved WOULD_APPROVE → ABSTAIN_POLICY(OPEN_GAP). Await the `synchronize` for the rewritten head and re-run the full procedure there.
