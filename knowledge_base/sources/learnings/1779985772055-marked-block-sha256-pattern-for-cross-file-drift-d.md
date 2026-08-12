# Marked-block sha256 pattern for cross-file drift detection

# Marked-block sha256 pattern for cross-file drift detection

When N files must carry an identical inline block (e.g. duplicated subagent prompts, copy-pasted policy preambles, or any contract that has no shared-prelude mechanism), a presence-only grep is too weak — it lets a future edit keep the marker while mutating the contract.

Instead: delimit the block with a stable heading + a stable terminator (e.g. `## Mandatory startup check — SUBAGENT_DIFF_GATE_v1` … `---`), extract via awk, sha256 each, assert all hashes equal a canonical reference.

Awk extraction (run inside `set -euo pipefail`):

```bash
block=$(awk '
  /SUBAGENT_DIFF_GATE_v1/ { in_block = 1 }
  in_block { print }
  in_block && /^---$/ && !/SUBAGENT_DIFF_GATE_v1/ { exit }
' "$f")
```

Pair with a precondition loop that verifies the marker is present in every file (so the awk never runs on a file that lacks the boundary). Use `declare -A hashes` for the per-file hash map; pick `REVIEWERS[0]` as canonical; emit `::error file=…::` annotations on mismatch so GitHub Actions surfaces the offending file in the PR view.

**Why:** This was the round-2 fix on shader-slang/slang#11333. Presence-grep at `.github/workflows/claude-pr-review.yml` let any reviewer file silently regress — keep the marker, drop the `tmp/pr-files.txt` clause, ship. The hash check upgrades detection from "is the marker present" to "is the contract identical across all files."

**How to apply:** Use whenever the codebase pattern is "this block must stay in sync across N files." Common in CI workflows that pin invariants across multiple agent prompts, lint configs, or template files when the host system has no `include:`/`extends:` mechanism. Two helper notes: (1) include the trailing terminator (`---`) in the hashed block, otherwise an inserted-line-after-block change is invisible; (2) keep the precondition presence-check — otherwise awk silently emits empty output for missing-marker files and they all hash to the empty-string hash, which happens to be equal across them.
