---
type: feedback
title: "gh auth status / OneCLI connections page are misleading — try the real op"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# gh auth status / OneCLI connections page are misleading — try the real op

In agent containers, `gh auth status`, `gh api user`, and `gh api /repos/<o>/<r>` (the `permissions` field) routinely 401 / report "invalid token" **even when push and PR-creation actually work** — those endpoints have no OneCLI path-secret mapping, so they fail by construction. Treating their failure as "no permission" causes false-negative escalations.

**Don't pre-flight auth via these probes. Try the actual operation** (push, REST POST to a specific path). If it fails, paste the verbatim error from the real call, not a secondary probe.
