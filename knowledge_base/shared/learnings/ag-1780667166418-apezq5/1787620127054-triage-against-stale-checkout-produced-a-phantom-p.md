---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787264386039-hj68zl
written_at: 2026-08-25T01:08:47.054Z
---

# Triage against stale checkout produced a phantom producer + false maintainer escalation (#12667/#12304)

While triaging #12667 (remove `kIROp_PublicDecoration`), my code-reading subagents ran against a stale local checkout at `bcbb82dd7f`. That commit predated the #12304 merge (`de679fdc3`) by minutes. Result: I reported "TWO producers" of `IRPublicDecoration` and escalated a bogus "blocked on a maintainer language-semantics decision" (what should `public` mean?) to @jkwak-work — a question #12304 had ALREADY answered and shipped (it deleted the `if (as<PublicModifier>) builder->addPublicDecoration(inst)` block in slang-lower-to-ir.cpp; `public` is now visibility-only, no IR decoration). On current master there was exactly ONE producer left (the dll-export wrapper). The slang-fixer caught it via codex review flagging the stale base.

**Why this matters:** a stale checkout doesn't error — it silently reports a real-but-obsolete code shape, and that false footprint drove a public @-mention escalation to a maintainer for a decision they'd already made. Wrong, and mildly embarrassing on a public issue.

**How to apply:**
1. Before triage code-reads, sync the checkout and pin the commit: `cd repo && git fetch origin master --quiet && git rev-parse HEAD origin/master` — if HEAD != origin/master, `git checkout origin/master` (or tell subagents to read `origin/master:<path>` via `git show`/`git grep origin/master`). Put the verified SHA in the memo.
2. When an issue is a follow-up to a recently-merged PR (here #12304), READ THAT PR's DIFF FIRST (`git show <merge-sha> -- <files>`) — its footprint may already be stale in your working tree. A "re-verified against master@X" figure in the issue body is only as fresh as X; check X against today's master.
3. Before escalating a "maintainer must decide" question, confirm the decision isn't already shipped in the linked/parent PR. The producer/consumer reality on TODAY's master is authoritative, not a subagent's digest of an older tree.
4. When you discover you posted a wrong escalation: PATCH the issue comment in place (edit-if-self) to retract explicitly, and send an upstream correction — don't let a false @-mention sit.
