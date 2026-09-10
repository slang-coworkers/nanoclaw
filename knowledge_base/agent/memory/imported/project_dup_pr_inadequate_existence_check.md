---
name: Dup PR from inadequate existence-check before dispatch
description: Before dispatching a coworker to create a PR for a bot-opened tracking issue, robustly verify no PR already exists — branch-name + body-text search alone misses it
type: project
originSessionId: 7e9aba8a-58b1-409f-9c44-44aeeb5715c6
---
I dispatched slang-fixer to create test PR #11677 for tracking issue shader-slang/slang#11673 when test PR #11675 **already existed** (both nv-slang-bot, both test-only, both on branches we control). My pre-dispatch existence-check missed #11675 and I created a duplicate.

**Why it was missed:** #11675 was on branch `test/issue-11668-matrix-cmp-coverage` (NOT `fix/issue-11673`) and its body referenced the underlying **fix** PR (#11668), not the tracking issue (#11673). So both my checks returned empty:
- `gh pr list --head fix/issue-11673` → no match (wrong branch convention)
- `search "11673 in:body"` → no match (body cited #11668, not #11673)

Bot-opened tracking issues say "A draft PR adding this … is linked below," but the linked PR commonly uses a different branch convention and references the underlying bug/fix PR rather than the tracking-issue number.

**How to apply:** before dispatching PR creation for a tracking issue, check for an existing linked PR via MULTIPLE signals, not just `head=fix/issue-<n>` + `<n> in:body`:
- the issue's development-linked PRs / timeline cross-references (`gh api .../issues/<n>/timeline`),
- a broad search by the underlying fix PR number and the expected test filename (`tests/bugs/...`),
- recent `author:app/nv-slang-bot` PRs touching the same file.

If any surface an existing draft, route the coworker to *take over* that PR rather than create a new one. (Outcome here: maintainer jkwak-work chose #11675 as canonical; #11677 closed as dup; both consolidated onto #11675 as fix+test.)

**Variant — concurrent author self-fix (no pre-existing PR to find).** shader-slang/slang#11928 (2026-07): author @jvepsalainen-nv filed a dead-code cleanup issue, we triaged→fixer→draft PR #11932 (+1/−39, @expipiplus1-approved), then the *author* opened + self-merged their own #11930 (removed both switches, deleted `slang-serialize-riff.{cpp,h}`, +6/−1464) days later. A perfect pre-dispatch dedup check would NOT have caught this — #11930 didn't exist at dispatch time. The mitigation is not tighter pre-checks; it's the **drafts-only guardrail** [[feedback_drafts_only_guardrail]]: we held #11932 draft, never merged over the author, and jkwak-work closed it cleanly ("issue is closed") — cost of supersession was zero. **How to apply:** for *contributor/author-filed* cleanup/refactor issues, treat the author as a live concurrent actor — supersession by their own PR is a normal, harmless outcome, not a failure, *as long as* the bot PR stays draft. Don't be surprised by it, don't race to merge ahead of it.
