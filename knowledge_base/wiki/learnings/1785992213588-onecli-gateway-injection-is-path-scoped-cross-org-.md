---
title: "OneCLI gateway injection is PATH-SCOPED — cross-org GitHub reads 401, and curl -sf hides it as empty output"
type: learning
topic: agent-ops
source: learnings/1785992213588-onecli-gateway-injection-is-path-scoped-cross-org-.md
---

# OneCLI gateway injection is PATH-SCOPED — cross-org GitHub reads 401, and curl -sf hides it as empty output

## The rule

The OneCLI gateway injects credentials **per-path**. On a shader-slang-scoped agent,
`api.github.com/repos/shader-slang/*` returns **200**, but `api.github.com/repos/microsoft/*` (any other
org) returns **401 Bad Credentials**. Keeping the proxy env intact is necessary but NOT sufficient — the
credential simply has no rule for the foreign path.

## Why it bites (the real defect)

`curl -sf` suppresses the error body on HTTP failure, so a 401 arrives as **empty stdout**, which is
byte-identical to a legitimate "this object does not exist upstream." Measured 2026-08-06 while
root-causing a submodule-pin CI failure: three consecutive `curl -sf .../microsoft/mimalloc...` calls
returned nothing, and the tempting conclusion was *"the pinned commit was force-pushed away upstream"* —
a claim the data did not support at all.

## The check, and the workaround

Always run a **positive control** before reading empty as absence:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "User-Agent: curl/8.0" \
  "https://api.github.com/repos/microsoft/mimalloc"      # -> 401
curl -s -o /dev/null -w '%{http_code}\n' -H "User-Agent: curl/8.0" \
  "https://api.github.com/repos/shader-slang/slang"      # -> 200  (control)
```

Drop `-f` and print `%{http_code}` whenever a fetch returns nothing you can explain.

**Workaround that works over the same proxy:** the git wire protocol is not path-gated the way the API
is. `git ls-remote --heads/--tags/--symref <url>` and a `--filter=blob:none` scratch clone both succeed
against foreign orgs, which is enough for ref existence, default-branch resolution, and
`git merge-base --is-ancestor` reachability tests.

Also known-403 on this scope: `/repos/{o}/{r}/branches/{b}/protection` (so "is this check required?" must
be answered from merge evidence, not the required-contexts list).

Related: never `unset HTTP_PROXY` to "fix" a 403 — that strips the injected token entirely (6000/hr →
60/hr).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785992213588-onecli-gateway-injection-is-path-scoped-cross-org-.md`_
