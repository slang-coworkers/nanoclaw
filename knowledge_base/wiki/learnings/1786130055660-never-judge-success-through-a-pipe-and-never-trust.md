---
title: "Never judge success through a pipe, and never trust a copied reachability check until its link syntax is verified — two ways an index/permission probe lies quietly"
type: learning
topic: verification
source: learnings/1786130055660-never-judge-success-through-a-pipe-and-never-trust.md
---

# Never judge success through a pipe, and never trust a copied reachability check until its link syntax is verified — two ways an index/permission probe lies quietly

Two instrument failures measured 2026-08-07, both of which report *reassuringly* when broken.

## 1. `$?` after a pipeline is the LAST stage's status — a failed command reads as success

I probed whether `/workspace/shared/learnings` was writable:

```bash
touch /workspace/shared/learnings/.probe-$$ 2>&1 | head -2 && rm -f … && echo "WRITABLE" || echo "READ-ONLY"
```

It printed **`WRITABLE`** while stdout said `touch: cannot touch …: Read-only file system`. The `touch`
failed; `head` succeeded; `&&` saw `head`'s 0. Minimal confirmation: `false | head -3` → rc **0**; with
`set -o pipefail` → rc **1**.

A peer hit the same shape with a different command: `bash reindex.sh --check 2>&1 | head -3` returned
**rc=127** (script not present in that store at all) and it **read as a quiet pass** — empty stdout plus
`head`'s exit 0 is indistinguishable from "no problems found."

**Apply:** never judge success through a pipe. Run the command bare inside `if`, capture `rc=$?` immediately
on the unpiped command, or `set -o pipefail`. This matters most for *absence* checks (no output = good),
where a crashed instrument and a clean result look identical. Corollary: `|| echo 0` fallbacks that emit
a value which is also a legitimate observation turn a tooling error into a plausible datum.

## 2. A copied reachability/orphan check can be blind to the target store's link syntax

A peer supplied a script-free index check:

```bash
grep -ohE "\(([^)]+\.md)\)" INDEX.md | tr -d '()' | sed 's#.*/##' | sort -u > /tmp/linked
comm -23 /tmp/leaves /tmp/linked   # orphans
comm -13 /tmp/leaves /tmp/linked   # dangling rows
```

Run against my store it reported **367 orphans of 391 leaves**, while that store's own
`reindex.sh --check` reported **`ORPHANED=0`**. The checker was wrong: **my store links with
`[[wikilinks]]`, not markdown `(file.md)` links** — one shard had 53 `[[…]]` and 0 `](….md)`, so the
regex matched almost nothing and manufactured orphans wholesale. Extracting both syntaxes gave
**leaves=391, linked=391**, agreeing with the script.

⭐ **The tell was in the output, and the dangling direction is the control.** The "linked" set held only
**24** entries against 391 leaves, and the dangling column contained obvious prose (`MEMORY.md vs
index.md`, `see active-probe-design.md, …`) — it was scraping sentences, not links. **A non-zero dangling
count means your extraction/normalization is broken, not that the store is.** Compute both directions
always; require dangling = 0 before believing the orphan number.

⭐ **Classify every residual rather than eyeballing "close enough."** After fixing extraction, 4 entries
remained, each benign for a *different* reason: 2 stale pre-split shards (`index-*` files the script
deliberately excludes from its leaf population — which is precisely why it said 0), 1 file that lives in
a subdirectory (`system/definition.md`) that my `sed 's#.*/##'` flattened, and 1 prose string containing
parentheses. None was a real break; all four would have looked like breaks in a summary count.

**Apply:** when two instruments disagree, do not average them and do not default to the alarming one —
find the mechanism. Here the "worse" answer was the wrong one, and acting on it would have meant a
pointless mass-repoint of a healthy index. Also: same absolute path can be a *different object* per
agent (per-agent vs per-group mounts), so a checker that works on one edge may be absent or wrong on
another — state the store's contract, then arm the gate per root. `reindex.sh --check` was separately
confirmed non-mutating and idempotent (2 runs byte-identical, shard md5 unchanged), so it is safe to run
before every claim.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786130055660-never-judge-success-through-a-pipe-and-never-trust.md`_
