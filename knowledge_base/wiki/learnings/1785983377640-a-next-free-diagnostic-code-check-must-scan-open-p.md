---
title: "A next-free diagnostic-code check must scan OPEN PRs, not just master"
type: learning
topic: misc
source: learnings/1785983377640-a-next-free-diagnostic-code-check-must-scan-open-p.md
---

# A next-free diagnostic-code check must scan OPEN PRs, not just master

## The trap

Picking the next free numeric ID (diagnostic code, opcode, stable name) by grepping `master` gives
a **correct but insufficient** answer. Codes are allocated by humans in parallel branches, so
master is the set of *already-landed* claims, not the set of all claims.

Concretely (slang#12367, 2026-08-06): I chose **55215**. It was genuinely free at
`origin/master` (`49584a089`) — codes ran contiguously through 55214, with a positive control
(55213 = 1 hit, so the grep was reading). But **open PR #12249 adds `55215,`** to
`source/slang/slang-diagnostics.lua`, with its own comment explaining the choice. Whoever lands
second ships a duplicate or renumbers under review.

## How to check properly

```bash
# 1. master (the landed claims)
git show origin/master:source/slang/slang-diagnostics.lua | grep -oE '552[0-9][0-9],' | sort -u | tail

# 2. the unlanded claims — sweep open PR heads
git ls-remote origin 'refs/pull/*/head' | awk '{print $2}' \
  | sed 's#refs/pull/\([0-9]*\)/head#\1#' | sort -n | tail -25 > /tmp/prs
for n in $(cat /tmp/prs); do
  git fetch -q origin "pull/$n/head:sweep-$n" 2>/dev/null || continue
  c=$(git show "sweep-$n:source/slang/slang-diagnostics.lua" 2>/dev/null \
      | grep -oE '552(1[5-9]|2[0-9]),' | sort -u | tr '\n' ' ')
  [ -n "$c" ] && echo "PR #$n claims: $c"
done
```

⚠ **Silence from that sweep is not success** — an empty result and a sweep that read nothing look
identical. Add a positive control proving the greps read real files:

```bash
git show "sweep-$n:source/slang/slang-diagnostics.lua" | grep -c '55213'   # expect 1 per ref
```

## Related, same session

An issue can also *cite* a code that does not exist at master — that is a tell for an unlanded
branch. slang issue #12192 referenced `E55215` for a `ConstantBuffer DescriptorHandle` problem;
the code was absent from master, which is what led to PR #12249.

## The general shape

This is *correct instrument, wrong population* — the same failure as grepping one directory level
for a transitive question, or counting a multi-pass `-dump-ir` for a single-pass state. Before
trusting an enumeration, ask **which population answers my question**, not just whether the query
ran. Record in the PR/commit *why* a non-obvious number was chosen, so the next allocator sees the
reasoning rather than an unexplained gap.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785983377640-a-next-free-diagnostic-code-check-must-scan-open-p.md`_
