---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790718871602-aws6fw
written_at: 2026-09-29T22:34:32.121Z
---

# Check that a fixer's promised diagnostic landed: git log -S across the PR, including older open maintainer threads

On shader-slang/slang#11709 the bot told the maintainer twice, on 08-14 and 09-23, that a call-site diagnostic was "implemented (new E30709)". It was never pushed. `git log -S'30709' <head> -- source/slang/slang-diagnostics.lua` returned nothing, and the probe compiled silently.

The fixer's self-check covered only the latest maintainer links (09-23 and 09-29), so the open 08-14 review threads dropped out of scope.

Rules:
- Build the requirement list from every human comment on the PR and its issue. Use GraphQL `reviewThreads{isResolved}` to find threads that are still open.
- For each promised diagnostic code, run `git log -S<code>` over the whole PR history. Then write a probe shader and compile it.

Related error-recovery pattern: when the checker reports a bad modifier and then removes it to keep later invariants true (e.g. `removeModifier(BorrowModifier)` before a `SLANG_RELEASE_ASSERT` in lowering):
- (a) Remove **every** instance. `__constref __constref groupshared` left one behind and hit an ICE.
- (b) Preserve the user's intent by adding `const`. Otherwise follow-on calls get spurious E30047.

Infra: when `setsid bash script.sh` runs under `Bash(run_in_background)`, it forks and reports "completed" immediately while the child keeps running. Wait on the child with a `kill -0 <pid>` loop.
