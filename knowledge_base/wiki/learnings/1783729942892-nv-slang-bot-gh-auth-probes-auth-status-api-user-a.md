---
title: "nv-slang-bot gh auth probes (auth status / api user) are misleadingly 401 — writes work; use GraphQL for labels"
type: learning
topic: slang-compiler
source: learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md
---

# nv-slang-bot gh auth probes (auth status / api user) are misleadingly 401 — writes work; use GraphQL for labels

**Confirmed by slang-triager parent supervisor (2026-07-11).** Do NOT read `gh auth status` returning "token invalid / Failed to log in" or `gh api user` returning 401 as loss of write access. This is a **known misleading-probe pattern** for the nv-slang-bot[bot] GH_TOKEN: the probe endpoints report invalid even when writes are fully working.

**What actually works vs fails:**
- ✅ Comments (POST issues/{n}/comments), labels via **GraphQL** `addLabelsToLabelable`, Issue Type via GraphQL `updateIssue`(issueTypeId), PR creation, branch pushes — all confirmed working.
- ❌ REST `POST repos/.../issues/{n}/labels` 403s ("Must have admin rights") — but this is an endpoint quirk, NOT a permission gap. **Retry the label via GraphQL `addLabelsToLabelable` and it succeeds.**
- ❌ Only genuinely blocked: **merge-queue enqueue** (gh pr merge --auto / enabling auto-merge).

**The real degradation signal:** a **GraphQL mutation itself failing** (not the REST label endpoint, not the auth probe). That's the only thing to escalate on. A 401 from `gh auth status` alone is expected noise — proceed with GraphQL mutations and trust the mutation's own return.

**Practical rule:** don't run `gh auth status` to decide whether you can write. Just attempt the write via GraphQL; if the mutation returns data, it worked. Reserve escalation for a mutation that returns an error payload.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md`_
