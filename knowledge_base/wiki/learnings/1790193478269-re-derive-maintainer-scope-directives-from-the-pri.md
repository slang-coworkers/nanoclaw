---
title: "Re-derive maintainer scope directives from the primary GitHub comment — webhook bodies truncate, and never ADD scope you inferred"
type: learning
topic: agent-ops
source: learnings/1790193478269-re-derive-maintainer-scope-directives-from-the-pri.md
---

# Re-derive maintainer scope directives from the primary GitHub comment — webhook bodies truncate, and never ADD scope you inferred

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787225557722-ufwrdr
written_at: 2026-09-23T19:57:58.269Z
---

# Re-derive maintainer scope directives from the primary GitHub comment — webhook bodies truncate, and never ADD scope you inferred

# Re-derive maintainer scope directives from the primary comment; never inject inferred scope

**Context (slangpy#886, 2026-09-23).** A triage→fix chain shipped a *correct* fix that was then **closed unmerged** as a wasted cycle (#1182 — built, peer-reviewed APPROVE_WITH_NITS, CI-green, discarded), because the scope that reached the fixer was inverted from what the maintainer actually asked.

**What happened, exactly.** Maintainer @kaizhangNV's GitHub comment (issue #886, `issuecomment-5782606325`) read verbatim:
> "@nv-slang-bot, please open a PR to fix this problem. When create_device is called, let's add the slangpy module searching path by default. **And this should also fix the #1177.**"

Two failures compounded:
1. **The webhook `body` I received omitted the final clause** ("And this should also fix the #1177"). I relayed the truncated version verbatim, trusting the webhook payload as complete.
2. **I then ADDED a scope narrowing that was never in the directive** — "keep #886 scoped to create_slang_session; don't fold #1177 in unless the maintainer asks." That inference came from *prior* context (an earlier bot reply had called #1177 "related, not a duplicate" of #886). But the maintainer's #886 comment *explicitly requested the unified fix*, contradicting exactly the constraint I injected.

Net: the fixer built a sessions-only fix (#1182) that could not satisfy the maintainer's "also fix #1177" request. A parallel bot session shipped the correct unified fix (#1183, `Fixes #886` + `Fixes #1177`, "Supersedes #1182"), which the maintainer merged; #1182 was discarded. The inverted scope was even posted publicly on the issue (bot comment 5783707896: "the raw spy.Device() path (#1177) is intentionally not touched"), one comment below the maintainer's request — a visible contradiction.

**Rules (adopt):**
1. **A load-bearing maintainer scope directive is re-derived from the live GitHub comment before it reaches an implementer — never from the webhook `body` alone.** Webhook payloads can truncate or omit trailing clauses. One `github_get_issue` / comment fetch is cheap; a wasted fix cycle is not.
2. **Relay maintainer comments verbatim, including every "should also fix #N" / "this covers #M too" clause.** Paraphrase drops scope. If you quote, quote the whole operative sentence.
3. **Never ADD a scope constraint the maintainer did not state** — especially a *narrowing* ("keep scoped to X", "don't fold in #N"). If prior context suggests a narrowing, that is a question to surface, not an instruction to inject. Inferred scope that contradicts the actual directive is the most expensive kind of relay error because it looks authoritative downstream.
4. **The tier that narrows scope before dispatch owns re-reading the source.** In this chain both the orchestrator (origin of the inversion) and the triager (propagated without re-fetching) share this; the orchestrator's injection was primary.
5. **Surface cross-issue linkage** (#886 ↔ #1177 shared a root cause) so parallel bot sessions don't collide on the same fix — here #1182 and #1183 raced with no collision signal reaching either fixer.

**Tell:** if you find yourself writing "keep this scoped to…" or "don't fold in #N" in a dispatch, stop and confirm that constraint appears in the maintainer's own words — not in your model of the issue.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790193478269-re-derive-maintainer-scope-directives-from-the-pri.md`_
