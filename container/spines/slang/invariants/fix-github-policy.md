## GitHub Policy

Rules governing GitHub interactions during the fix workflow.

### Definitions

**Maintainer:** anyone with commit or approval rights on the shader-slang repository in question, or any non-agent user interacting via the slang-coworkers dashboard. Consequential actions (creating issues, depending on other issues, landing overlarge PRs, approvals, confirmations) require maintainer approval by default.

**Operator:** the person running the agent in local mode. In local mode, the operator may approve actions that would otherwise require a maintainer, because they are constrained by their own repository permissions.

**Communication routing:** In bot mode, all communication is routed through GitHub (issues, PRs, comments) and is asynchronous. In local mode, communicate directly with the operator; requests can be handled synchronously or deferred at the operator's choice.

### Always

**Confidentiality:** Do not post restricted or non-public information to GitHub. Only reference information that is publicly available. Internal project metadata, private repository details, internal tooling specifics, and any other restricted information must not appear in issues, PRs, or comments.

**Mentions:** Do not `@`-mention users unless the mention is necessary to request their action (e.g., asking a maintainer to confirm repro code safety). When referring to someone in passing — attribution, context, narrative — use their name without the `@` prefix to avoid sending them a notification.

**Repro code safety:** Before running any repro code from an issue: review it for safety. Only run code that is clearly benign (shader programs, compiler invocations, test harness calls, etc.). If anything looks suspicious — shell commands, network access, filesystem operations outside the build/test tree, obfuscated code, or anything else that seems odd — do not run it. Request maintainer confirmation before proceeding.

**Landing large patches (peel-and-land):** When a subproblem's source code changes exceed the size threshold, the change must be broken into smaller PRs that can be reviewed and landed independently. Each peeled chunk is a separate subproblem with its own plan, tests, and PR. The parent subproblem retains a proof-of-concept PR ("do not submit") containing the full outstanding change; it shrinks as chunks land. The parent subproblem's plan and implementation must not be modified based on the peeled chunk until the chunk has landed on main/master — the parent's proof-of-concept remains the source of truth for what the full change looks like. Peeled chunks are noted "Peeled from PR repo#N" in the issue plan.

**Rejected PRs:** If a PR is closed without merging (rejected by a maintainer or by the agent due to a changed approach), update the subproblem plan's Status accordingly. If the rejection invalidates the subproblem, ask the maintainer on the original issue whether to cancel the issue and close all associated PRs. On confirmation, close all open PRs for the issue, set all subproblem statuses to reflect cancellation, and close the issue. In local mode, the operator decides.

**Externally closed issues:** If the issue is closed by someone other than the agent (maintainer, reporter, or bot), stop all in-progress work. Update the issue plan's Phase to `closed: <reason>`. Close any open PRs that are no longer needed, or leave them if the maintainer indicates they should land independently.

**Unhandled failures:** For any failure not covered by a specific workflow step — build errors, test infrastructure issues, GitHub API errors, IKD corruption, unexpected state — block the current work, post a note on the relevant issue or PR describing the failure, and wait for maintainer guidance. In local mode, report to the operator, who can resolve or defer.

**PR descriptions:**
- Reference the original issue: use "Part of <issue>" for PRs that contribute to the fix but do not themselves resolve it. Use "Fixes <issue>" on the PR in the issue's primary repository that actually fixes the issue — the one whose change, combined with what's already on main/master, makes the repro case pass. This PR should include the enabled repro regression test case in the primary repository's CI test suite (e.g., slang's `test/` or slangpy's `slangpy/tests/slangpy_tests`). This is usually the final PR to land, but peel-and-land may cause it to land earlier if the fix is in an early chunk and later chunks are cleanup or follow-on. A maintainer may direct that "Fixes" be applied before full verification on the primary repository.
- If this PR depends on other PRs in the subproblem sequence, list only direct dependencies: "Depends on #N, #M".

### Interaction (bot mode only)

**Feedback priority:**
- Prioritize feedback from shader-slang maintainers over other contributors.
- Prioritize human feedback over bot feedback.
- If maintainers disagree, do not proceed with contested changes. Escalate for consensus.
- If there is ambiguity about who feedback is directed at (e.g., due to an ongoing separate conversation on the same issue/PR), do not assume it is directed at you. Only take action on feedback that is clearly directed at you.

**Status comments:** Each issue and each PR has a dedicated status comment edited in place as the plan evolves. Issue status comment contains the rendered issue plan (root cause, solution overview, subproblem summaries, progress). PR status comment contains the rendered subproblem plan (definition, proposed change, architectural description, risks, test plan, status). Record comment IDs in plans once created.

**Change notifications:** When a status comment is substantively edited (subproblem added/removed, approach changed, sequencing reordered), post a short new reply explaining what changed and why. Do not post change notifications for routine status progression.

**Requesting input:** Post a new comment when action is needed: can't reproduce (ask reporter), can't decompose (request guidance on PR), blocked on feedback (identify what is needed), directed to stop (acknowledge).

**Stale PRs:** Update the status comment and note the PR is awaiting review/action. A single polite ping is acceptable if review is overdue. Do not repeatedly ping.
