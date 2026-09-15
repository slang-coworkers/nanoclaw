---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-15T01:21:33.943Z
---

# E30624/MatrixLayoutMode cluster split into two verdicts — behind-master disambiguation isn't always uniform across a cluster

**Context:** Three PRs (#12783, #13078, #12992) all showed the identical CI failure signature — `undefined identifier 'MatrixLayoutMode'` → E30624 → E30855 — the classic "N unrelated PRs, identical signature, not their own diff" shape that has resolved to simple stale-base twice before (autodiff-adjacent depfile cluster, MatrixLayoutMode #12674/#12848 cluster). This time it did NOT resolve uniformly.

**Finding:** 2 of 3 (#12783, #12992) were genuine stale-base — their branch base predated the commit that introduced the symbol (#12986, "add `enum MatrixLayoutMode`"), confirmed via `gh api compare/<fix-commit>...<pr-base>` showing `behind_by > 0`. The 3rd (#13078) had a base *ahead* of the fix commit (`ahead_by: 24`), byte-identical source at the relevant line, a genuinely fresh CI build (verified via log: full core-module regeneration, no cache reuse) — yet still failed identically. **Coarse "is the PR behind master" is not the right check — check distance to the *specific* fix-introducing commit, not the tip.** A PR can be "BEHIND" master by one irrelevant commit yet already contain the fix, while another PR "BEHIND" by dozens of commits genuinely lacks it.

**Second finding — diagnostic reruns are a legitimate, narrow exception to "don't rerun non-infra failures":** the CI babysitter's "only rerun GPU/infra-intermittent" rule is a *flake-recovery* rule (don't waste recovery attempts masking real regressions). A **single, explicitly-authorized, one-off rerun used purely to classify flake-vs-deterministic** for a genuine unexplained anomaly is a different action and doesn't violate that rule's intent — but get explicit parent/human sign-off first, since it's still spending CI resources on a non-infra failure. In this case the rerun reproduced identically, which converted "unresolved anomaly" into "confirmed deterministic regression, safe to route to a fixer" — a single rerun fully resolved what static log/diff/source analysis alone could not.

**Third finding — check GitHub comments manually when investigating a PR, even outside your normal webhook wiring:** found a live, unanswered `@nv-slang-bot` mention ("resolve the rebase conflict", posted ~20 min prior) on #12783 purely by running `gh api repos/.../issues/12783/comments` while investigating disambiguation — this agent wasn't wired to receive that as a webhook inbound. If your role touches a PR for any reason, a quick comment-history check can surface addressed-to-you asks that would otherwise sit silently unanswered.

See also: `/workspace/agent/memory/ci-babysitter/e30624-matrixlayoutmode-disambiguation-2026-09-15.md` for the full evidence trail (base-vs-fix-commit table, ruled-out hypotheses, rerun confirmation).
