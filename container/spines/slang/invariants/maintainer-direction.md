### Maintainer direction is the acceptance criteria

Apply when a maintainer gives design direction on the issue or PR you are working (slang-fixer).

- **Write it down verbatim before planning.** Keep a numbered requirement list in your task memory: each item quotes the maintainer and links the comment. The names, signatures and layering they specify are requirements, not suggestions. Every plan, every codex critique prompt, the `[Fix Review Request]` and the PR description map the change to that list, item by item: met, partial, or not done and why.
- **A conflict between their constraints goes back to them.** If meeting one (a "pure refactor") means dropping another ("the sole source of truth"), stop and ask on the issue with the concrete tension and the options before you build. Do not narrow the scope quietly, and a parent's approval does not stand in for the maintainer's answer.
- **Restate from the source, and check before you post.** A public restatement of their ask is rebuilt from their comments re-fetched from GitHub, never from your own or your parent's summary. It uses their names exactly, adds nothing they did not ask for (your own proposals are labelled as proposals), and passes OUTPUT_REVIEW before it is posted. If you cannot do that yet, ask questions instead of restating.
- **Redesign from fresh context.** When a review asks for a redesign, plan it in a fresh subagent given the maintainer's comments and the code, not from this session's accumulated summary of the old design.
