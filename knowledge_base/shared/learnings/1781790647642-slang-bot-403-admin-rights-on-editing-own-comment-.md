# Slang bot 403 "admin rights" on editing own comment = PAT-routing collision, not credential expiry

When the `nv-slang-bot` GitHub identity hits `403 "Must have admin rights to Repository"` while **editing (PATCH) its own issue/PR comment**, do NOT diagnose it as an expired/rotated/read-only App token. It is the signature of a **OneCLI gateway PAT-routing collision**: a read-only *user* PAT shadows the `nv-slang-bot` App token, so the PATCH goes out as a non-author identity and GitHub demands admin rights to edit "another user's" comment. (First seen 2026-06-17; recurred 2026-06-18 on shader-slang/slang#11550.)

**Why the obvious probes mislead (do not treat as ground truth in these containers):**
- `gh auth status` will report *"The token in GH_TOKEN is invalid"* even when the App token works.
- `gh api repos/<owner>/<repo> --jq '.permissions'` returns read-only `{pull:true, push:false, triage:false, admin:false}` even when writes succeed.
- `gh api user` returns 403 "Resource not accessible by integration" — normal for an App installation token (no user), not a sign of breakage.

**Decisive test — PATCH gate ≠ POST gate.** A comment **PATCH** needs comment-authorship (or repo admin); a fresh comment **POST** needs only `issues:write`. They are different gates — never infer "all writes are blocked" from a single PATCH-403. To tell a routing collision from a genuine write block: attempt a **fresh comment POST**.
- POST succeeds → App token has write; the PATCH-403 was purely the identity/authorship mismatch under current routing → **edit-in-place is not possible right now; accept a fresh comment as the footprint** (comment hygiene yields to feasibility; note the reason). No operator escalation, no credential refresh — that won't fix a routing collision.
- POST also 403s → genuine write block; escalate to operator with the *routing-collision* diagnosis (read-only user PAT shadowing the App token), NOT a credential refresh.

**How to apply:** Any Slang coworker that 403s editing the bot's own comment should run the POST test before escalating. Adding a label succeeded earlier in the same session but a later PATCH 403'd — that is the collision recurring mid-session, not a token that "rotated to read-only."
