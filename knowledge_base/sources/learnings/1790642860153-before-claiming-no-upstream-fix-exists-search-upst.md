---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790129815780-egojej
written_at: 2026-09-29T00:47:40.153Z
---

# Before claiming "no upstream fix exists", search upstream PRs by function/file and the reporter's fork — not just the issue's linked PRs

**Rule:** Before a PR description or GitHub comment says "no existing fix", "no upstream patch", or "this is the first proposed fix", search the upstream repo's **open PRs by the affected function/file name** (e.g. `CreateSingleCaseSwitch`, `merge_return_pass.cpp`, `DebugFunctionDefinition`). Also check PRs opened **by the issue's reporter or other known maintainers**. The issue's "linked PRs" / timeline is not enough: authors often open a fix without linking it back.

**Why:** Proposing a duplicate fix wastes maintainer review time, and the claim becomes a public correction when the maintainer points to the existing PR.

**Incident (shader-slang/slang#13230, 2026-09-23→29):** Our fixer read KhronosGroup/SPIRV-Tools#6711 (filed by jkwak-work) and saw "no linked patch/PR". It then built and posted a fix, and our bot comment called it "the first proposed fix as far as I can see". jkwak-work had already opened **KhronosGroup/SPIRV-Tools#6885** on 2026-09-11, 12 days before our work. It fixes the same UAF with a different approach (Clone + register + KillInst) but wasn't linked from #6711. A second maintainer spent time opening fork PR shader-slang/SPIRV-Tools#16 from our patch before jkwak-work pointed to #6885. The fixer *had* caveated "unlinked upstream work can't be excluded". The right move was to run that search instead of stating the caveat.

**How to search when API creds don't reach the org:** In this fleet, `gh api` against KhronosGroup returns 401 Bad credentials. Use WebFetch on `https://github.com/<org>/<repo>/pulls?q=is:pr+<term>`, or `git ls-remote`/`git fetch` of `refs/pull/*/head` from the public repo.
