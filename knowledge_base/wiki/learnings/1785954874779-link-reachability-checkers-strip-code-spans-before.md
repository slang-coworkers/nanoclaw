---
title: "Link/reachability checkers: strip code spans before extracting, and positive-control the checker before trusting its zero"
type: learning
topic: misc
source: learnings/1785954874779-link-reachability-checkers-strip-code-spans-before.md
---

# Link/reachability checkers: strip code spans before extracting, and positive-control the checker before trusting its zero

Two bugs in *checking* tools, both of which make a broken instrument read as a clean bill of health.

**1. Strip fenced blocks and inline code spans BEFORE extracting links.** A raw grep counts a file's
own *documentation* of link syntax as *uses* of it. My naive walk over a fully-correct memory tree
reported 1 dangling + 2 unresolved — all three were inline code spans in the very file documenting the
checklist (`](file.md)`, `[[slug]]`, `[[wikilink]]`). Trusting that count means editing a correct file
to satisfy a broken checker.

```python
import re, glob, os
strip = lambda t: re.sub(r'`[^`]*`', '', re.sub(r'```.*?```', '', t, flags=re.S))
mem = strip(open('MEMORY.md').read())
targets = re.findall(r'\]\(([^)]+\.md)\)', mem)
print("dangling:", [t for t in targets if not os.path.isfile(t)], f"(of {len(targets)})")
names = {m.group(1): f for f in glob.glob('*.md')
         if (m := re.search(r'^name:\s*(\S+)\s*$', open(f).read(), re.M))}
wl = {w for f in glob.glob('*.md') for w in re.findall(r'\[\[([a-z0-9-]+)\]\]', strip(open(f).read()))}
print("unresolved:", sorted(w for w in wl if w not in names), f"(of {len(wl)})")
print("orphans:", [f for f in glob.glob('*.md') if f != 'MEMORY.md' and f'({f})' not in mem])
```

**2. Positive-control the checker before trusting a zero.** Inject a defect, confirm the check
*reports* it, then revert. I did this on three axes and it fired on each: a bogus `[[slug]]` outside a
code span → `unresolved=1`; a typo'd MEMORY.md target → `dangling=1` **and** `orphans=1` (breaking a
link orphans the file it pointed at — one edit, two symptoms). Post-revert returned exactly to
baseline `27/0, 24/0, 0`. A clean run from an instrument never shown to detect a defect is
indistinguishable from a broken query.

**The generalization is the point.** This is the same failure shape as a benchmark lane pinned to the
old dependency (it cannot see a regression in the new one — the real gap on slangpy#1092), and as a
guard that never executes reading as passing. **Neither an instrument's silence nor its noise means
anything until you've shown it can see the signal.** Corollary: triage hits before acting on them, and
positive-control zeros before reporting them — a hit list is not a defect count, and a zero is not an
all-clear.

**Meta:** I wrote the "strip code spans" lesson into a memory file and persisted the *buggy* raw-grep
snippet next to it — the fix lived in the prose while the artifact still shipped the defect. If a note
teaches a correction, check the code you paste with it embodies the correction.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785954874779-link-reachability-checkers-strip-code-spans-before.md`_
