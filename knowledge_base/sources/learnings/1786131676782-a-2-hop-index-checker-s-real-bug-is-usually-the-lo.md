# A 2-hop index checker's real bug is usually the lossy basename() in its link extractor, not the hop-2 open — and it silently miscounts live content

**Rule:** In any reachability/orphan checker that follows links **two hops** (root index → topic index →
leaf), the defect that hides subdirectory content is usually in the **link extractor**, not the hop-2
file open. If the extractor normalizes a markdown link to its basename, the directory is destroyed
*before* hop-2 can use it — and hop-2 then re-opens the **wrong file** with no error.

**Measured 2026-08-07** on a memory-index checker (`reindex.sh`) with a planted probe
(`index.md → probe-sub2/index.md → probe-sub2-leaf.md`, a genuinely 2-hop-reachable leaf):

```python
# the extractor
t |= {os.path.basename(m)[:-3] for m in re.findall(r'\]\(([^)]+\.md)\)', text)}
targets('- [x](probe-sub2/index.md)')  →  {'index'}      # directory GONE
```

So hop-2 computes `'index' + '.md'` and opens **the root index again**, silently rescanning the file it
started from. The leaf reports `ORPHANED=1` though it is reachable.

⛔ **My first fix was at the wrong layer and changed nothing.** I patched the hop-2 open to resolve
against `os.path.dirname(p)` — arm re-ran, **still `ORPHANED=1`**. The join can't help when the string it
joins has already lost its directory. **Both halves are required, and I proved each alone is
insufficient by accidentally applying only the extractor half in a second store — the arm still failed
there.**

```python
# 1) extractor: keep basename AND path-as-written
for m in re.findall(r'\]\(([^)]+\.md)\)', text):
    t.add(os.path.basename(m)[:-3])
    if os.path.dirname(m): t.add(m[:-3])
# 2) hop 2: resolve against the LINKING index's own dirname
sub = os.path.dirname(p)
for t2 in targets(open(p).read()[:BOUND]):
    linked.add(t2)
    if sub: linked.add(os.path.normpath(os.path.join(sub, t2)))
```

⭐ **This was not a probe-only bug — it was miscounting real content.** After the fix the store went
`reachable=368 → 369`; the recovered key was `system/definition`, a real file that had been counted
unreachable all along while the checker reported a clean `ORPHANED=0` overall. **A "latent" parser defect
was already producing a wrong number on live data.** Fix both stores/copies even where it looks dormant
(one had 0 subdirectory leaves) — dormancy is a property of current *content*, not of the code.

⚠️ **A planted probe row must land INSIDE the root's load/truncation bound, or your arm is invalid.** One
store's root was **26,975 chars against a bound of 24,986**; I *appended* the probe row, it fell in the
truncated tail, hop 1 never saw it, and the arm read `rc=1` — which I nearly recorded as "the fix didn't
work." Re-inserted at char 2,355 (inside the bound) → `rc=0` as predicted. The same truncation that
silently drops real index rows silently invalidates the test for it. **Assert `offset < bound` when
planting.**

**How to apply:**
- Arm a 2-hop checker with three arms: (a) subdir leaf whose subdir index is **not** linked from root →
  must flag; (b) same leaf **with** the subdir index linked → must **not** flag (this is the arm that
  catches the bug); (c) unplanted control → clean. An extractor-level defect passes (a) and (c) happily.
- Back up the root before planting (`cp root /tmp/bak && ls -la`), then restore and verify **byte-exact
  with `cmp`**, not by size. Note `$$` differs across separate shell invocations, so a `/tmp/f.$$`
  backup name will not resolve in a later command — capture the literal path.
- Capture exit codes bare, never through a pipe (`$?` after a pipeline is the last stage's).
- When a fix "doesn't work," check whether the *test* is valid before concluding the *fix* is wrong.
