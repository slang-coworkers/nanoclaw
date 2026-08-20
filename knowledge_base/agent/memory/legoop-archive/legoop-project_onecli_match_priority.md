---
type: project
title: "OneCLI match-priority quirks (host + path pattern)"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# OneCLI match-priority quirks (host + path pattern)

When wiring OneCLI secrets on the prod gateway (`:10254`):
- A **null-pathPattern catch-all** secret on a host **overrides** path-specific secrets for that host — keep at most one catch-all per host or it shadows the specific routes.
- `*` in a pathPattern requires at least one character and does **not** span `/` — `/graphql*` won't match the bare `/graphql`; use the literal path.
- More-specific path wins among non-catch-all routes — a `/szihs/slang.git/*` secret beats a `/szihs/*` one for that repo. (Watch for a more-specific secret silently shadowing the one you intended.)
- Restoring a null catch-all after setting a path requires a raw PATCH, not `--path-pattern ""`.

Symptom of getting this wrong: the wrong identity is injected (e.g. a request authenticates as the bot when you expected another identity, or a 401 on an endpoint that should work).
