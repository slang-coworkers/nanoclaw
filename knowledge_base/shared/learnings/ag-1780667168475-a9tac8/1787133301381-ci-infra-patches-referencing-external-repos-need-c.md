---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787131639218-4upedo
written_at: 2026-08-19T09:55:01.381Z
---

# CI-infra patches referencing external repos need coordinator-side verification (A/C can't reach them)

When reviewing a `.github/workflows/*` (or any CI-infra) patch whose correctness rests on facts about an **external** repo — a pinned commit SHA, a dependency-manifest value, "commit X moved dependency Y" — Reviewers A (correctness) and C (clarity) **cannot verify those**: both run only against the `/workspace/agent/slang` checkout. The reviewer coordinator must verify the external facts independently and fold a "Coordinator — external verification" section into the combined report; do NOT let the verdict rest on the patch author's unverified narrative about another repo.

Concrete method (from #12617, pinning `NVIDIAGameWorks/dxvk-remix`):
- **Reproduce the CI's exact operation.** The patch did `git fetch --depth 1 origin <SHA>`; I ran precisely that (`git init` + `git remote add` + `git fetch --depth 1 origin <full-SHA>` + `git checkout FETCH_HEAD`). Exit 0 + clean checkout PROVES fetch-by-object-id works — public GitHub repos enable `uploadpack.allowReachableSHA1InWant`. Note: fetch by **abbreviated** SHA fails; use the full 40-char SHA.
- **Verify commit-parent claims by diffing across the boundary.** "SHA_pin == SHA_child~1" and "the child moved dependency Y" are settled by `git log -1 --format='%P' <child>` (parent field) and `git diff <pin> <child> -- <manifest>` — the diff shows the actual package/version change, not the author's paraphrase. In #12617 this caught a precision nit: the author said "moved to the internal gtl remote" but the remote-LIST file was unchanged — it was a package-IDENTITY change (`usd.py311.stock`→`open_usd`/nopython not on the public CDN).
- **GOTCHA — stale `GH_TOKEN`/onecli-gateway → 401 on public repos.** `gh api …` and `curl` with an auth header returned `Bad credentials (HTTP 401)` for a fully public repo because a stale token was injected. Plain `git` over https is unaffected. For "does this remote object exist / what's its content" questions, fetch it with git rather than trusting a suppressed `gh`/`cat-file`.

Also: CI-workflow patches are delivered as **patch/handoff, not a bot PR** — nv-slang-bot lacks the GitHub App `workflows` permission; a fork PR gets policy-closed. And `slang-pr-review` patch mode correctly skips Reviewer B (Devin needs a PR URL). A transient `API Error: 400 Invalid JSON payload: unexpected end of data` mid-run (seen at turn 7, during setup) is not reconstructable but loses no findings — archive the failed run dir and straight re-run.
