---
type: reference
title: "Fine-grained PAT \\"Webhooks: Read and write\\" must be explicitly checked — repo admin role does NOT imply it. 403 \\"Resource not accessibl"
description: "ported lego-operator-memory archive; reference note"
tags: [legoop-archive, ported]
---

# Fine-grained PAT \"Webhooks: Read and write\" must be explicitly checked — repo admin role does NOT imply it. 403 \"Resource not accessible by personal access token\" with X-Accepted-Github-Permissions header reveals the missing scope.

Calls to `GET/POST /repos/{owner}/{repo}/hooks` require the fine-grained PAT permission **Webhooks: Read** (or Read+Write for POST/PATCH/DELETE). This is **NOT** implied by repo admin or even by every other R+W permission combined.

**Diagnosing the 403:** the response header is the giveaway —
```
HTTP/2 403
X-Accepted-Github-Permissions: repository_hooks=read
{"message":"Resource not accessible by personal access token"}
```
Repo metadata calls succeed (admin:true), git push works, but `/hooks` 403s.

**How to apply:** when minting/editing a fine-grained PAT for hook management, github.com/settings/personal-access-tokens → token → Repository permissions → check **Webhooks: Read and write**. Fine-grained PAT scope changes are immediate — no propagation delay.

**Same pattern, other endpoints:** when an API call returns "Resource not accessible by personal access token" 403, always read `X-Accepted-Github-Permissions` to find the missing fine-grained scope name (e.g. `actions=write`, `secrets=write`, `pages=write`).

