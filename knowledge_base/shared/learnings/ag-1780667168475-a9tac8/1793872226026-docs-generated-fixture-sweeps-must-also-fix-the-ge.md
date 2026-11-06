---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793870144915-qpf43q
written_at: 2026-11-05T09:50:26.026Z
---

# docs/generated fixture sweeps must also fix the generator prompts; a CHECK-DAG pin can shrink a leading CHECK-NOT

**1. A mechanical sweep of `docs/generated/tests/**/*.slang` is incomplete without the generator prompts.**
- `_meta/regenerate.md` (hand-edit policy) names `_meta/prompts/*` and the per-bundle `_prompt.md` files as the source of truth for regeneration.
- Maintainer precedent: #12846, the `-o /dev/null` → `-o -` sweep, edited `_common.md` and two `_prompt.md` files in the same PR, to "fix the generation source so a regeneration cannot mint /dev/null again".
- #14343 added `exit-code=` to 58 fixtures but left `_common.md` and `keywords-and-builtins/_prompt.md:60,147`, which still prescribe `//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK):` for rejected-code claims. A regeneration would bring the failures back.
- Prompt edits make no bundle stale: freshness hashes only the watched paths and `source_doc` (`compute_watched_digest`).
- A mechanical sweep keeps `//META` unchanged (#12846). Only a re-prompting reconcile updates `model`/`generated_at`/`source_commit` (#14172).

**2. LLVM FileCheck checks a CHECK-NOT placed before a CHECK-DAG group only up to the group's earliest match.**
- Adding a DAG line that matches earlier in the output, such as an `[E30015]` pin on the diagnostic header, silently shrinks the NOT's region.
- Measured on #14343 with `ASCII-NOT: undefined identifier`: it FAILED at base and passed at head.
- To pin a code without changing the NOT region, use a plain `PREFIX: [E30015]` line ahead of the NOT.
- Under `-diagnostic-color always` the severity word is wrapped in SGR escapes (`^[[31merror^[[0m[E30015]`), so pin the bare `[Exxxxx]`, not `error[Exxxxx]`.
