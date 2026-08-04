---
name: gh auth-status / gh api user are misleading auth probes
description: Why gh api user fails in containers even when GitHub writes work, and how to actually verify GitHub access
type: feedback
originSessionId: bf56f147-5db5-4819-84b1-fe7a698a8fad
---
`gh auth status`, `gh api user`, and `gh api repos/szihs/*` return `app_not_connected` / HTTP 401 in agent containers **even when GitHub writes work fine**. Do NOT use them as auth probes or conclude "GitHub is down" from them.

**Why:** GitHub API calls route through the OneCLI proxy, which injects the real bot token only for paths with a configured secret rule — the org-scoped repos under `shader-slang/*` and `slang-coworkers/*`. `gh api user` and arbitrary user/other-org paths have no secret rule, so they 401 regardless of whether GitHub is connected. `GH_TOKEN=placeholder` is intentional; the proxy supplies real auth at request time.

**How to apply:**
- To verify GitHub access, hit a **representative org-scoped path**: `gh api repos/shader-slang/slang` (GET) — returns real data when the path works.
- ⭐⭐⭐**THERE IS NO PER-CONNECTION "AM I AUTHENTICATED?" ANSWER — injection is PER-PATH at the OneCLI proxy.** `https_proxy` is set to the gateway, so **all** egress (`gh`, `curl`, `urllib`) traverses it, and it injects the credential **only on paths that have a secret rule**. Main-verified 3-way control 2026-08-03 18:3xZ:
  ```
  path                          HTTP  X-Ratelimit-Limit  body.message         verdict
  repos/shader-slang/slang-rhi  200   6000               (none)               rule ⇒ injected + ACCEPTED
  repos/torvalds/linux          401   <none>             "Bad credentials"    cred FORWARDED and REJECTED
  repos/microsoft/vscode        401   <none>             "Bad credentials"    same
  rate_limit                    200   60                 (none)               reached GitHub ANONYMOUSLY
  ```
  ⚠️**Two errors corrected in this very table (Main, 2026-08-03 18:3xZ, status+body measured):**
  (a) `rate_limit` is **200 / limit 60**, NOT 401 — it *does* reach GitHub, anonymously;
  (b) `torvalds/linux` is **not** "not injected" — 401 `"Bad credentials"` means a credential
  **was** forwarded and rejected (a genuinely anonymous GET on a public repo returns **200**).
  ⇒ ⛔**"no `X-Ratelimit-*`" means the request FAILED, not that it went out clean — so a
  no-rule path is NOT a valid negative control.** ⭐⭐**Distinguish "the control returned
  nothing" from "the control FAILED": READ THE BODY.** A 401 body, an HTML error page, and a
  real anonymous 200 are indistinguishable through a header grep. This table had three
  successive wrong control claims (strip-`Authorization` · no-rule-path · `rate_limit`
  tiering) — **each assumed a condition it never checked.**
- ⭐**Correctly-scoped probe — ask "is the credential injected on THE PATH I'm about to use?", never "is my token healthy?":**
  ```
  gh api -i repos/<org>/<repo> | grep -iE 'x-ratelimit-limit|x-accepted-github-permissions'
    X-Ratelimit-Limit: 6000  ⇒ injected on THAT path (+ live Remaining/Used/Reset for quota)
  ```
  ⛔**Do NOT read `6000` as "the connection is authenticated"** — it is a statement about one path only. A sibling path can 401 in the same second. ⛔**Do NOT use `gh api rate_limit`** (no rule ⇒ 401/anonymous, and during a OneCLI disconnect it returns an error body with **zero numeric fields**). ⛔**Do NOT test by stripping your own `Authorization` header** — the proxy re-supplies it, so the "control" is not a control; the only valid control is **a path with no secret rule** (`repos/torvalds/linux`).
  ⚠️ I published the over-broad version of this recipe *and handed it to two coworkers* before controlling it. **Correct a bad recipe on the same edge you sent it.**
  ⛔**Do NOT use `gh api rate_limit` for this.** During a OneCLI GitHub disconnect it never reaches GitHub — it returns a OneCLI error body (`{connect_url, error:"app_not_connected", provider}`, HTTP 401) with **zero numeric fields**. A recipe phrased as "`rate_limit` limit 60 = anonymous / 6000 = injected" is **unexecutable exactly when you need it**. (I wrote that recipe on 2026-08-03 and had to retract it hours later — see [[project_github_actions_graphql_401_outage]].)
- **Weaker, and NOT sufficient alone: `gh api repos/shader-slang/slang --jq '.permissions'`.** An authenticated request returns a `permissions` object; an anonymous read of a **private** repo omits it. ⚠️**But on a PUBLIC repo the field can appear regardless**, so presence-of-`.permissions` **can read as authenticated while GraphQL is dead and the token is anonymous-tier** (observed 08-03: `.permissions` present, all-false, alongside `X-Ratelimit-Limit: 6000`). All-false values are normal for an App installation token (the 5-field collaborator object ≠ App issues/PR-write perms) and are **not** a per-repo write signal — see the 2026-06-10 recurrence below.
- ⭐**`gh api user` → `Resource not accessible by integration` is EXPECTED for a GitHub App installation token** — an App has no `/user`. That failure is a *positive identification of the credential type*, not a bug. Use it to pick the right diagnostic lens (App-token provisioning), never as evidence of an outage.
- ⚠️**Path-specific injection is the norm, not the exception.** On 08-03 a single token simultaneously had: REST reads ✅ 200 at the 6000 tier · `rate_limit` ❌ OneCLI 401 · GraphQL ❌ 401 Bad credentials. **Never generalize one endpoint's verdict to "the token."** Name the path with every auth claim.
- **POST/PATCH comments and PR creation on `shader-slang/*` and `slang-coworkers/*` work via the bot path.** Post a 5-bullet with `gh api -X POST repos/<org>/<repo>/issues/<num>/comments -f body=@<file>`.
- PR push flow: in the clone, `git remote set-url origin https://github.com/<owner>/<repo>.git` (drop baked auth), commit as `nv-slang-bot[bot]` + a single `Co-authored-by:` trailer (no AI attribution), `git push -u origin <branch>`, then `gh pr create`. The proxy injects the token per request.
- **Exception:** `.github/workflows/*` edits need an elevated PAT, not the bot path. Comment posts and non-workflow PRs do not.
- Incident: 2026-06-01 I wrongly reported "GitHub write path broken container-wide" based on `gh api user` 401s. Operator disproved it by posting real test comments on slang#11375 and nanoclaw#511 from inside the container.
- Recurrence: 2026-06-04 (issue #11474). slang-triager flagged "GH_TOKEN invalid / gh unusable" and fell back to web fetch. I almost relayed it as a real blocker + escalated to operator. Verified instead: org-scoped `.permissions` object present (authenticated), only `gh api user`/`rate_limit`/`auth status` 401. Confirmed false alarm. Coworkers (esp. triage) repeatedly hit this — worth making the bot-path write flow louder in their spines.
- Recurrence: 2026-06-10 (slang-rhi#772). slang-fixer prepared a correct fix, then declared "bot has ZERO write access to slang-rhi" and forced a patch-handoff to the operator, citing `push/pull/triage: false` + `gh api user` 403 + a supposed prior handoff on slang-rhi#762. **All wrong.** Receipts: PR shader-slang/slang-rhi#765 — author `nv-slang-bot[bot]`, head `fix/issue-762`, **same-repo (not a fork), MERGED 2026-06-03**; and issue #772 itself was *created* by the bot. So the bot has full push + PR + merge + issues:write on slang-rhi. Two added lessons: (1) the all-false `.permissions` object is **identical** for writable repos (slang) and is NOT a per-repo write-capability signal — never read `push:false` as "can't write"; the bot path works on all `shader-slang/*`. (2) **Verify cited precedents** — slang-fixer's "forced handoff like #762" was the opposite: #762's fix (#765) was a merged bot PR. To confirm whether the bot can write a given repo, check its history: `gh api "repos/<repo>/pulls?state=all&per_page=100" --jq '[.[]|select(.user.login|test("nv-slang-bot"))]'` — prior merged bot PRs = writes work.
