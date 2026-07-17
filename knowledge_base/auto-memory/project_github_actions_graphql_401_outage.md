---
name: project_github_actions_graphql_401_outage
description: "✅ RECOVERED ~07-16 18:00Z (~3h outage) — FLEET-WIDE GitHub token 401 on actions API + GraphQL (REST core reads OK), 15:00Z–18:00Z; broke reruns/merges/CI-log-reads/GraphQL for ALL coworkers; recovered without confirmed operator action; NOT restart-fixable"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**Signature (07-16 ~15:39Z, babysitter + Main-confirmed):** `gh api` / `gh` calls to the **GitHub actions API** (`repos/*/actions/*`) and **GraphQL** (even `{viewer{login}}`) return persistent **401 "Bad credentials"** (3× retries), while **REST core reads work fine** (`repos`, `pulls`, `commits/*/check-runs`, issue reads). So dead: `gh pr checks`, `gh run view --log-failed`, `gh run rerun --failed`, `gh pr merge --merge-queue`, all GraphQL queries (mergeQueueEntry, reviewDecision, timeline-via-graphql). Still alive: REST metadata reads.

**⚠️ FLEET-WIDE, not per-agent (Main-scoped 07-16):** babysitter first read it as a babysitter-token gateway-routing gap (`ROUT…` token). But **Main's OWN token 401s identically** on actions API + GraphQL this sweep — AND Main was using both successfully EARLIER THE SAME SESSION (job-log reads on 87247297851, GraphQL mergeQueueEntry queries, run lookups all worked turns ago). ⇒ **fresh outage, onset ~07-16 15:00Z, affecting ALL tokens** — a shared gateway credential-injection failure on the actions/GraphQL paths, NOT a scope change or a single agent's config.

**Impact:** every coworker's CI-write + deep-read capability is degraded — babysitter can't rerun/read-logs/classify flakes, approver can't merge, anyone can't query GraphQL PR state. REST-read-only mode fleet-wide. Babysitter sweeps go read-only until restored.

**Operator-actionable (surfaced 07-16):** only a human can fix a gateway credential. PushNotification sent: re-auth the gateway credential for the **actions API + GraphQL paths** (the `8d85bfeb`-style secret / OneCLI GitHub token injection). **NOT restart-fixable** — same class as the prior provider-auth outages ([[project_slang_fixer_auth_outage]] 07-14, slang-triager 07-13, both OPERATOR re-login NOT restart) but a DIFFERENT credential (those were Bedrock/model provider auth; THIS is the GitHub gateway token, and path-specific: actions/GraphQL 401 while REST-core still injects OK → looks like a stale/unscoped injection on those paths).

**✅ RECOVERED ~07-16 18:00Z (~3h outage, 15:00Z–18:00Z).** Babysitter verified with the exact probe (`actions/runs total_count=40000`, GraphQL viewer OK, REST OK) and resumed normal sweeps on its own — no re-fire needed. Recovery was NOT tied to a confirmed operator action (the mobile PushNotification didn't send — Remote Control inactive; per [[feedback_push_not_away]] that says nothing about presence); the gateway cred likely refreshed/rotated back on its own or an operator acted without confirming to me. Either way the window is closed. #12136's earlier 8-platform assoctype/reflection regression ALSO self-resolved on new head 04d90845 (remaining red = its own `-fno-rtti` typeinfo link break in new unit-test, author-owned). **If this recurs:** same signature = actions/GraphQL 401 while REST-core OK → operator re-auth of the GitHub gateway cred for those paths; verify-recovery probe as above.
