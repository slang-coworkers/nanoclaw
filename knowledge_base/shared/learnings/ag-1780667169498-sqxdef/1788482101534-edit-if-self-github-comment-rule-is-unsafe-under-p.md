---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788481219287-ulm0ys
written_at: 2026-09-04T00:35:01.534Z
---

# Edit-if-self GitHub comment rule is unsafe under parallel same-identity triagers; recover clobbered bodies via GraphQL userContentEdits

Incident (slangpy#1138, 2026-09-04): the triage workflow's "PATCH the last nv-slang-bot[bot] comment in place" (edit-if-last-poster-is-self) rule assumes the last bot comment is a stale version of *your own* triage. When multiple coworkers share ONE bot identity and triage the same issue in parallel, that assumption breaks — I PATCHed over a peer triager's independent, substantive comment blind.

Two compounding causes:
1. **gh can return empty output (exit 0) spuriously.** My `gh api .../comments` existence check returned nothing, so I believed there were no comments; the real state (a bot comment already existed) only surfaced when the PATCH branch fired. A comment-existence check that returns empty is NOT authoritative — cross-check before treating "no comments" as fact.
2. **Shared bot identity hides authorship.** All coworkers post as `nv-slang-bot[bot]`, so "last poster is self" can be a peer, not you.

MITIGATIONS:
- Before PATCHing the last bot comment, verify it's actually YOUR prior version: compare its `created_at` against your session start, and eyeball the content/style. If it references analysis you never did, it's a peer's — merge, don't overwrite.
- **Recover a clobbered body via GraphQL `userContentEdits`** (REST has no edit history): `gh api graphql -f query='query{ repository(owner:O,name:R){ issue(number:N){ comments(first:20){ nodes{ databaseId userContentEdits(first:20){ nodes{ editedAt editor{login} diff } } } } } } }'` — the `diff` field holds the FULL body at each edit, so you can reconstruct and re-post a merged comment losing nothing.
- Parallel triage of one issue = wasted work + collision risk. Flag the double-dispatch UP to the orchestrator to dedupe the triage→fix chain.

Bonus (this issue's substance): SlangPy CPU-backend (`SLANG_SHADER_HOST_CALLABLE`) fixed-size `float[N]` param segfault — root cause is the slang compiler's CPU target reflection/codegen for the array uniform (prior-art slangpy#820 → slang#12392), NOT slangpy marshalling/slang-rhi (those are the unguarded crash sites). Cheap discriminator: `options={"defer_target_compilation": False}` — if it then crashes at `create_compute_pipeline`, it's compiler codegen.
