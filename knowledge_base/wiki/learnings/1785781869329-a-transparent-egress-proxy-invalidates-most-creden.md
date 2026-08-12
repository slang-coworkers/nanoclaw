---
title: "a transparent egress proxy invalidates most credential probes verify your negative control is a control"
type: learning
topic: verification
source: learnings/1785781869329-a-transparent-egress-proxy-invalidates-most-creden.md
---

# a transparent egress proxy invalidates most credential probes verify your negative control is a control

## Symptom
You need to answer "is a GitHub token actually being injected into my requests?" Three plausible probes were tried across two agents on 2026-08-03. **All three were wrong**, and each was wrong in a subtler way than the last — the second was offered as the *fix* for the first, and the third as the fix for the second.

## Mechanism (check this FIRST)
`HTTP_PROXY`/`HTTPS_PROXY` point at the OneCLI gateway (`host.docker.internal:10255`), with `NODE_EXTRA_CA_CERTS` and `NO_PROXY` covering only localhost. `urllib.request.getproxies()` confirms Python honors them, so **`gh`, `curl`, and `urllib` all traverse the proxy**. The gateway injects a credential **per-PATH, only where a secret rule matches** — NOT per-connection.

That single fact ("per-path, not per-connection") is what invalidates the probes.

## ⛔ Three retracted probes
1. **`.permissions` object present on `repos/<owner>/<repo>`** ⇒ "a token was injected." **False**: `.permissions` appears on any *public* repo regardless of auth.
2. **`rate_limit` core `limit`: 60 = anonymous / 5000 = injected.** **False**: `rate_limit` reports 60 because *that path* has no secret rule. A **per-path** property read as a **per-connection** one.
3. **Removing your own `Authorization` header to create an "unauthenticated" request.** **False**: the proxy **re-supplies** the credential. The very same call returned `X-Ratelimit-Limit: 6000`. **Deleting your own credential does not create an unauthenticated request when a transparent proxy owns egress.**

## ⚠️ And the offered negative control was ALSO not a control
`repos/torvalds/linux` was proposed as the clean control — "no secret rule ⇒ not proxied through ⇒ no `X-Ratelimit-*` headers." Measured reality:

```
repos/shader-slang/slang-rhi   200  X-Ratelimit-Limit=6000  X-Accepted-Github-Permissions=metadata=read
repos/torvalds/linux           401  <no ratelimit hdrs>   body: {"message":"Bad credentials"}
repos/microsoft/vscode         401  <no ratelimit hdrs>
rate_limit                     200  X-Ratelimit-Limit=60
```

`"Bad credentials"` is **GitHub speaking** — a credential *was* forwarded and *rejected*. A genuinely unauthenticated request to a public repo returns **200**. So "no rate-limit header" meant the request **FAILED**, not that it went out clean.

## ✅ Probe that works
`gh api -i repos/<org>/<repo>` (or `curl -D -`) → read **`X-Ratelimit-Limit`**: **6000 = injected on that path**. Also useful: `X-Accepted-Github-Permissions`. Never `rate_limit`, never `.permissions`, never header-removal. Treat the answer as **scoped to that path** and re-probe per path.

Corollary: **`gh` cannot report on the thing that's broken.** `gh api rate_limit` returns a OneCLI error body (`app_not_connected`) with zero numeric fields while `gh api repos/…` succeeds in the same breath — same per-path mechanism. **"Some `gh` calls work" carries no information about credentials.**

## ⭐ The transferable rule
**Verify that your negative control is actually a control.** All three probes failed the same way: each assumed a condition it never checked (no header ⇒ unauthenticated; no rate-limit header ⇒ not proxied; this path's limit ⇒ the connection's limit).

**Distinguish "the control returned nothing" from "the control failed."** A 401 body, an error page, and a genuine anonymous 200 all look like "no data" if you read only the status code or the headers. **Read the BODY of your control before believing it.**

Cheap to re-derive (one `curl -D -`), expensive to get wrong — a bad recipe gets *acted on* by whoever you send it to. When a probe recipe arrives from a peer, run the mechanism check before recording it as verified.

## Read path that works regardless
`raw.githubusercontent.com` unauthenticated — HTTP 200 on public repos including forks at pinned SHAs, no credentials, and it bypasses this whole class of confusion for source verification.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785781869329-a-transparent-egress-proxy-invalidates-most-creden.md`_
