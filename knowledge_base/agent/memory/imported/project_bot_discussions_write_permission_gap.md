---
name: project_bot_discussions_write_permission_gap
description: nv-slang-bot GitHub App lacks Discussions:write — cannot post/reply on GitHub Discussions; addDiscussionComment returns FORBIDDEN
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

The GitHub App backing **nv-slang-bot** lacks the **`Discussions: write`** permission on shader-slang/slang. It can **read** discussions (GraphQL discussion queries work) but **cannot post/reply**.

**EMPIRICALLY CONFIRMED 2026-07-16** (slang-triager, msg 38906): `addDiscussionComment` GraphQL mutation returned
```
{"type":"FORBIDDEN","message":"Resource not accessible by integration"}
```
Same class as [[project_bot_workflows_permission]] (`workflows: write` gap) — a durable GitHub-App-permission limitation, not a transient/auth failure. **Retrying won't help** until the App gains the permission.

**Auth-probe caveat:** `gh auth status` / `gh api user` failing is EXPECTED for an App installation token acting as `nv-slang-bot[bot]` — see [[feedback_gh_auth_status_misleading]]. The authoritative signal is the mutation itself (FORBIDDEN), not the probe. GraphQL discussion *reads* + REST issue *reads/writes* still work — only discussion *writes* are blocked.

**How to apply — the play for a GitHub Discussion reply the bot must make:**
1. Coworker drafts + verifies the reply body (save locally), locates the target comment's node IDs (discussion node `D_...`, reply-root top-level comment node `DC_...`).
2. Attempt the post; on FORBIDDEN, **stop — do not retry.** Hand the mechanics to Main → operator with the ready-to-run GraphQL and the node IDs.
3. Operator posts with a credential that has `Discussions: write` (PAT or App with the perm), OR grants the App the permission so the coworker can post directly.

**Discussion-post mechanics** (for whoever has creds): discussions are one-level-nested; a reply threads under a top-level comment root.
```
gh api graphql -f query='mutation($d:ID!,$r:ID!,$b:String!){addDiscussionComment(input:{discussionId:$d,replyToId:$r,body:$b}){comment{url}}}' \
  -f d="<discussion-node-id>" -f r="<top-level-comment-root-node-id>" -f b="$(cat <body-file>)"
```

**First occurrence:** Discussion #11840 (operator-face of #11877 operator-overload regression), replying to jkwak-work's @nv-slang-bot mention re: JS/WASM AllowGLSL. See [[project_11877_operator_overload_fastpath]]. Body drafted at (triager side) `/workspace/agent/active-work/discussion-11840-reply.md`; escalated to operator 07-16.

**⛔ STILL BLOCKED — re-confirmed 07-17 ~20:40Z (Main, direct attempt).** Operator asked again (dashboard msg 43670) pointing at anchor `discussioncomment-17653985` (brussig-tud's JS-frontend question, distinct from jkwak's `17654002`). **GraphQL recovered this session** ([[project_github_actions_graphql_401_outage]]) so Main attempted `addDiscussionComment` directly — STILL `FORBIDDEN "Resource not accessible by integration"`. **Proves the two blockers are independent:** cred recovery (GraphQL 401→OK) does NOT fix the App-permission gap; `Discussions:write` is still ungranted. Reply verified at HEAD `3649fb98` (binding surface unchanged: `createSession(int)` only, no `CompilerOption*`/`SessionDesc`/`AllowGLSL`/`MatrixLayoutColumn` bound → brussig correct that BOTH AllowGLSL AND MatrixLayoutColumn are unreachable from JS). Ready-to-post body at `/tmp/disc-11840-reply.md` (Main side) + relayed to operator. Node IDs: discussion `D_kwDOBZiKEc4And-U`, reply-root (jkwak's comment) `DC_kwDOBZiKEc4BDWCA`, target question `DC_kwDOBZiKEc4BDWDh` (17653985). **Resolution: operator grants the App `Discussions:write` OR posts it themselves — Main gave the GraphQL command + body 07-17.**
