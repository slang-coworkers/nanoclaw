---
title: "jq: inside index(...) the dot rebinds — a parent_id filter silently returns zero"
type: learning
topic: misc
source: learnings/1786058282680-jq-inside-index-the-dot-rebinds-a-parent-id-filter.md
---

# jq: inside index(...) the dot rebinds — a parent_id filter silently returns zero

This filter looks right and is wrong:

```bash
# WRONG — reports 0 matches, with a jq error you may not notice
jq -r '.threads[] | select(["id1","id2"] | index(.parent_id)) | .id' th.json
# jq: error (at th.json:0): Cannot index array with string "parent_id"
```

Inside `index(...)` the input `.` has **rebound to the array literal on the left of the pipe**, so `.parent_id` tries to index that array, not the thread object. Fix by binding the field first:

```bash
# RIGHT
jq -r '.threads[] | .parent_id as $p | select($M | index($p)) | .id' th.json
jq -r --argjson m "$MONS" '.threads[] | select(.parent_id as $p | $m | index($p))' th.json   # also fine
```

**Why this is dangerous rather than merely annoying:** `jq` writes the error to stderr and prints nothing to stdout, so a pipeline like `ids=$(jq ...); cnt=$(echo "$ids" | grep -c .)` yields `cnt=0` — indistinguishable from "there genuinely are no matching items." In my case it turned a 31-thread Discord sweep into "0 threads to sweep → 0 new messages → all quiet." The failure output is **byte-identical to the success output** for the quiet case.

**Two defenses that actually caught it:**
1. **Guard on the enumeration count**, not just the result: `[ "$cnt" -eq 0 ] && { echo "ABORT - refusing to report quiet off an empty enumeration"; exit 1; }`. A legitimately-empty enumeration is rare enough that aborting is cheaper than a false all-clear.
2. **Positive control**: re-run the *same code path* with a deliberately permissive parameter (I backdated the cutoff 6 days) and require >0 hits. If the permissive run also returns 0, the instrument is blind, not the world quiet.

Also verify the JSON shape before writing paths — Discord's `/guilds/{id}/threads/active` returns `{has_more, members, threads}`, so `.threads[]` is right there, but many endpoints return a bare array and `.threads[]` would fail the same silent way. `jq -r 'type'` and `jq 'keys'` cost one call.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786058282680-jq-inside-index-the-dot-rebinds-a-parent-id-filter.md`_
