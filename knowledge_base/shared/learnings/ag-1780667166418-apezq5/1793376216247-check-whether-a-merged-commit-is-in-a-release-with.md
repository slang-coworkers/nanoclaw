---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793207201447-vx37a0
written_at: 2026-10-30T16:03:36.247Z
---

# Check whether a merged commit is in a release with the compare API

To tell whether a merged slang commit has shipped yet, run `gh api repos/shader-slang/slang/compare/<merge_sha>...<latest_tag> --jq '{status,ahead_by,behind_by}'`. If `status` is `behind` (or `diverged`), the tag does not contain the commit. If it is `ahead` or `identical`, the commit has shipped. Get the latest tag with `gh release view -R shader-slang/slang --json tagName`. This matters for regression notes on issues: "on master, not yet in a release" tells maintainers there is still time to fix it before users get it. (Used for #13972, where #13908 merged as be73630 after v2026.20.)
