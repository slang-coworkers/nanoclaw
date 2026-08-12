# A fix to your local artifact is NOT a fix to the published copy — a gate-blocked delivery is an outstanding action

## The failure

On slang PR #12378 a reviewer reported the same stale figure (`742/742`) in the PR body for **eight
consecutive review rounds**. Each round I found it, fixed it locally, and reported it fixed. Each round
they re-read the posted body and found it still there.

**Both of us were right.** `grep -c '742/742'` on my local artifact returned **0**. The posted body was
byte-identical to a version from eight rounds earlier. The corrections were real and *never delivered*.

## Mechanism — why this is so easy to miss

A PreToolUse gate (`critique-gate`) denied my `gh` body-update call. The loop that followed:

1. Reviewer reports finding → 2. I edit the local artifact → 3. I run the `gh` call → 4. **gate denies**
→ 5. I satisfy the gate (fix the flagged item, re-run critique) → 6. **I never return to step 3.**

Step 5 *feels like completing the work* — it is substantive, it takes effort, and it ends with an
approve. But the delivery never happened. **From a reader's side, "corrected but undelivered" is
completely indistinguishable from "never corrected."**

## Rules

- ⭐ **Verify the PUBLISHED copy, never your local file.** Re-fetch the remote artifact and `diff` it
  against your local one. `grep` on your working copy answers a question nobody asked.
- ⭐⭐ **A gate-denied side-effecting call is an OUTSTANDING ACTION, not a completed one.** When a hook
  blocks a delivery, write down the retry. The edit that satisfies the gate is not the delivery.
- **Diff content, never reconcile by count.** One body legitimately had three different correct
  lengths: 22,220 bytes / 22,093 Unicode chars (127 bytes multibyte overhead) / 22,092 reported by the
  API (chars minus trailing newline). A length mismatch is not evidence of a content mismatch, and I
  nearly chased a phantom diff between three right numbers.
- **When a reviewer's report contradicts your local measurement, suspect the delivery path** — not
  their reading, and not your file. Two honest measurements of two different objects.

## Verification that discharges it

```bash
gh api repos/O/R/issues/<n> --jq '.body' > /tmp/live.txt   # PR bodies are served here too
tr -d '\r' < /tmp/live.txt | sed -e '$ { /^$/d }' > /tmp/live-norm.txt
diff /tmp/live-norm.txt ./local-body.md && echo "PUBLISHED == LOCAL"
```

Strip CR (GitHub returns CRLF) and the trailing newline `jq -r` adds, then diff.
