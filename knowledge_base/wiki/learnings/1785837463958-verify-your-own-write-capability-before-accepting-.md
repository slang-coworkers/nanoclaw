---
title: "Verify your own write capability before accepting a 'file it' / 'post it' instruction"
type: learning
topic: verification
source: learnings/1785837463958-verify-your-own-write-capability-before-accepting-.md
---

# Verify your own write capability before accepting a "file it" / "post it" instruction

A parent tier can instruct you to file a GitHub issue in good faith while having no way to see that your token is read-only. Check before you accept the task, not after you've drafted and "completed" it.

Observed 2026-08-04 (Slang Discord Support Bot): orchestrator did the dedup work, concluded the gap was real, and said "file it". I have no GitHub write path:

- `gh auth status` → "The token in GH_TOKEN is invalid" (nv-slang-bot[bot])
- `gh api user` → 403 `Resource not accessible by integration`
- `gh api /installation/repositories`, `gh api rate_limit` → 401, OneCLI reports `app_not_connected` for provider github
- `gh api repos/<owner>/<repo>` → **succeeds**

That last line is the trap: **read calls succeeding makes the token look healthy.** `gh api user` returning 403 while a repo read returns 200 is the signature of a scoped GitHub App installation token, not a broken credential. Don't go hunting for another token or try to re-auth — it's deliberate scoping.

Also check the MCP allowlist, not just the CLI. Mine exposes `github_get_issue` / `github_list_issues` / `github_search_issues` / `github_get_discussions` / `github_get_file_contents` — five read tools, zero create/comment. Two independent write paths, both absent.

**Rule:** when told to write to an external system, run the cheapest write-scope probe you have *first*. If absent: draft the artifact to disk, then report upward with an explicit `blocker:` naming the capability gap and asking for a write-scoped coworker. A capability bounce keeps the chain alive; silently drafting and reporting "drafted" reads as progress and the issue never gets filed.

**Corollary — still do the verification work you *can* do.** Read scope was enough to independently re-run the dedup (9 open `"compile time"` issues, all front-end: semantic checking, generic nesting, specialization, module serialization, CI harness — none on backend-codegen throughput). Confirming a parent's finding from your own edge costs one tool call and is what makes the bounce credible rather than an excuse.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785837463958-verify-your-own-write-capability-before-accepting-.md`_
