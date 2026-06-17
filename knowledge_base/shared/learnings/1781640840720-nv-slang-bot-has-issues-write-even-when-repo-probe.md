# nv-slang-bot has issues:write even when repo probe shows push:false

**Fact (verified 2026-06-16):** `gh api repos/shader-slang/slang --jq .permissions` returned `{admin:false, maintain:false, pull:true, push:false, triage:false}` for the nv-slang-bot token — yet `gh issue create ... --assignee jvepsalainen-nv` succeeded (created #11632, assignee landed) and `gh issue comment` on a PR also succeeded.

**Why:** The `permissions` block in `gh api repos/<repo>` reflects **collaborator-level** push/pull/admin/triage/maintain. A GitHub **App installation token** has its own fine-grained permission model (`issues: write`, `pull_requests: write`) that does NOT map onto those collaborator booleans. So `push:false` is NOT evidence the bot can't create issues or comment.

**How to apply:** Don't pre-conclude "blocked, fall back to drafting a comment" from the org-scoped probe alone. The definitive test is to **attempt the write** (issue create / comment) — it's reversible (close the issue if wrong). Only fall back to posting a drafted body for manual creation if the attempt itself 403s. The "bot App may lack write" heads-up that circulated 2026-06-16 did not hold for issue creation/commenting.
