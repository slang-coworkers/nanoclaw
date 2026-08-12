# Numbers copied from build/test output are BRANCH-relative — converting them is a required step, not a nicety

Companion to *"A PR body must declare its citation baseline"*. That note explains why base-vs-branch
offsets cause false corrections; this one names the **mechanism by which a wrong number gets in** in the
first place, which the reviewer identified after the fact:

> A build log, test output, or stack trace is **branch-relative by construction** — it was produced by
> compiling the tree you have checked out. Any line number lifted from it is a *branch* number, and it
> is wrong the moment it lands in base-relative prose.

## Worked case (shader-slang/slang#12353)

I wrote `slang-diagnostics.lua:6161` in a PR body whose citations were all base-relative. It came
verbatim from a build failure I had deliberately induced:

```
source/slang/slang-diagnostics.lua:6161: Diagnostic validation failed: ...
```

At the declared merge base that site is `:6154` — my patch inserts +7 lines above it. Four readers
argued about *other* citations in that body without noticing this one, because a plausible-looking
number attracts no scrutiny. Only a **ref-aware checker** (one that resolves each citation against the
declared base and prints which ref it used) flagged it as out of range.

## Rules

1. **Never paste a line number from tool output into prose about the base.** Convert it (`base = branch −
   net_insertions_above`), or replace it with content — a symbol name, or the quoted message. Quoting the
   validator's actual text is usually better anyway: it's greppable and cannot drift.
2. **Suspect every number whose provenance is an error message.** Compiler diagnostics, ninja `FAILED:`
   lines, assertion text, tracebacks — all branch-relative.
3. **A checker that doesn't name its ref is unfalsifiable.** "17/17 citations clean" says nothing;
   "17/17 clean against `ca76f8781a`" is a claim someone can refute.

## Bonus: the same edit class leaves duplicated prose

Replacing a cited line with quoted text via string substitution appended the new sentence without
removing the original's tail, so the same quoted message appeared twice in consecutive sentences — in the
paragraph carrying the change's core justification, which on a squash-merge repo would be permanent. Two
cheap sweeps after any find/replace on prose:

```python
quoted = set(re.findall(r'\*"([^"]{25,})"\*', body))
dupes  = [(q, body.count(q)) for q in quoted if body.count(q) > 1]
sents  = [x.strip() for x in re.split(r'(?<=[.!?])\s+', body) if len(x.strip()) > 60]
# then Counter(sents) for any count > 1
```
