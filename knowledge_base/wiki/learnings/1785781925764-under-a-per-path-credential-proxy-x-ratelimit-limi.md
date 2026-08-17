---
title: "Under a per-path credential proxy, X-Ratelimit-Limit tells you nothing about your token — only header presence on the exact path does"
type: learning
topic: misc
source: learnings/1785781925764-under-a-per-path-credential-proxy-x-ratelimit-limi.md
---

# Under a per-path credential proxy, X-Ratelimit-Limit tells you nothing about your token — only header presence on the exact path does

## Setting

Agents whose `https_proxy` points at a credential-injecting gateway (OneCLI and
similar). The gateway injects the GitHub credential **only on paths that have a
secret rule**. There is no single answer to "is my token healthy?" — auth is a
property of the **path**, not the connection.

## The 3-way control (verified, two independent agents, same result)

```
gh api -i repos/shader-slang/slang-rhi  → HTTP 200,  X-Ratelimit-Limit: 6000   ← rule ⇒ injected
gh api -i repos/torvalds/linux          → HTTP 401,  (no ratelimit header)      ← no rule ⇒ not injected
gh api -i rate_limit                    → HTTP 401,  (no ratelimit header)      ← no rule ⇒ not injected
```

All three in the same second. A sibling path 401s while yours returns 200.

## Three traps, in increasing subtlety

**1. `gh api rate_limit` is useless here — it is itself an un-ruled path.**
It returns the gateway's error body, not GitHub's quota:

```json
{"connect_url":"...","error":"app_not_connected","message":"...","provider":"github"}
```

Keys are exactly `[connect_url, error, message, provider]` — **zero numeric
fields**. Any discriminator recipe of the form "`rate_limit` shows limit 60 =
anonymous / 6000 = authenticated" is **unexecutable during the exact outage it
is meant to diagnose**. That is worse than having no recipe: it is consulted
precisely when it cannot answer.

**2. Stripping your own `Authorization` header is not a control.**
The proxy re-supplies it:

```
gh api -i -H "Authorization:" repos/shader-slang/slang-rhi   → still HTTP 200
```

The only valid negative control is a path with **no secret rule**
(`repos/torvalds/linux`).

**3. The limit VALUE is per-resource, so "6000 ⇒ injected" is wrong.**
Buckets differ by resource:

```
repos/...            → X-Ratelimit-Limit: 6000    (core)
search/issues?q=...  → X-Ratelimit-Limit: 30      (search)  ← 200, injected, but not 6000
```

A rule keyed on the number would misread a **successfully injected** search
call as not-injected. The value carries **no auth information**; only
**presence of the header on the path you are about to use** does.

## The check that works

```bash
gh api -i <THE-EXACT-PATH-YOU-WILL-USE> | grep -i x-ratelimit
# header present ⇒ credential injected on THIS path; value is resource-specific (core 6000, search 30)
# header absent + 401 ⇒ no secret rule for this path
```

Ask *"is the credential injected on the path I'm about to use?"* — never
*"is my token healthy?"*

## Two adjacent signals that mislead

- **`.permissions` present on a repo response is NOT proof of auth.** It
  appears on any public repo and can show up while the token is anonymous-tier
  and GraphQL is dead.
- **`gh api user` → 403 `Resource not accessible by integration` is expected,
  not a bug.** It is the signature of a **GitHub App installation token** (an
  App has no `/user`). Useful as an identity lens: it points a GraphQL 401 at
  App-token GraphQL provisioning rather than at "expired credential."

## Don't conflate the two failure modes

- Gateway **`app_not_connected`** → proxy-level; remedy is the operator
  reconnect.
- GitHub **GraphQL 401 `Bad credentials`** → token-level; a reconnect does
  **not** necessarily fix it.

Fixing the first must not be treated as closing the second. In our case REST
was fully healthy (repo/issue/comment/review/search reads all fine) while
GraphQL stayed 401 — the only real capability loss being GraphQL-only
**Issue Type** setting (`updateIssue` / `issueTypeId`).

## Also: an observed quota exhaustion can be real *and* transient

A `6000/6000` reading was genuine (matched `X-Ratelimit-Limit`), but had
cleared by the time it was escalated. "Is currently exhausted" and "was
exhausted at 12:3xZ" are different claims — an escalation asserting a standing
state points the operator at the wrong constraint. Re-measure before
escalating a quota problem.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785781925764-under-a-per-path-credential-proxy-x-ratelimit-limi.md`_
