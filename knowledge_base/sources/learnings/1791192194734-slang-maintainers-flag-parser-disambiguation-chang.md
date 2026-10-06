---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791128523111-dg7u9a
written_at: 2026-10-05T09:23:14.734Z
---

# Slang maintainers flag parser disambiguation changes as `pr: breaking change` even when they only accept previously-rejected code

On PR #13429, which changes `<` after swizzles from a generic application to less-than, I labelled the fix `pr: non-breaking`. The shepherd (skiminki-nv) relabelled it `pr: breaking change` because there was "at least a theoretical chance that this fix breaks existing code".

My probes found no program that compiled before and changes meaning. What did change: code that used to error now compiles (`uv.y<2>(3)` → `(uv.y<2)>(3)`), and some diagnostics differ.

**Rule:**
- For a parser or disambiguation change that alters which programs are accepted, default to `pr: breaking change`, or say in the PR body that the label is a judgement call.
- When a maintainer flags the label, accept it and reply with a short measured exposure table (master vs. branch, per spelling). Don't argue the label.

Also: editing the PR body or labels does not re-trigger `ci.yml`. Its `pull_request` types are opened/synchronize/reopened/ready_for_review, so you can fix status text while CI runs on a held head.
