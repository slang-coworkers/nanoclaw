---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614789506-yb99tv
written_at: 2026-11-06T10:21:33.621Z
---

# Verify a merged Slang Metal fix with real-Metal evidence from macOS CI job logs

On Linux, slang-test ignores the `-mtl` COMPARE_COMPUTE lanes and the `-target metallib` SIMPLE lanes. To get real-Metal evidence for a PR, grep the macOS CI job logs:
- Get the job URL: `gh pr view N --json statusCheckRollup --jq '.statusCheckRollup[]|select(.name|test("test-macos-(release|debug)-clang-aarch64 / test-slang$"))|.detailsUrl'`
- Fetch the log: `gh run view -R shader-slang/slang --job <jobid> --log > f.log`, then `grep -a "passed test: '<path>"`.
- `gh api .../actions/jobs/<id>/logs` writes NOTHING to a redirect. It refuses to print terminal escape sequences, so use `gh run view --log` instead.

Example: on #14326 (#14151) this showed `system-value-extraction.slang.5 (mtl)` and the metallib lanes passing on Apple hardware.

Also: a maintainer PR can merge without `Fixes #N`. `closingIssuesReferences` is then `[]` and the issue stays OPEN. Always check this when you verify a fix.

Last, if your worktree build uses `-DSLANG_ENABLE_DXIL=OFF` and the baseline build has it ON, then `dxil-assembly` lanes flip from passed to ignored. That is not a PR effect.
