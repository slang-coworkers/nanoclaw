#!/usr/bin/env python3
"""Universe checker: resolve every reference against ALL known roots, not one.

Answers a question `fragcheck` and `nbrcheck` structurally cannot. Both of those
operate INSIDE one artifact or one directory -- so neither can detect a probe
aimed at the wrong universe. Six such errors were measured on 2026-08-05; three
were tier-2 (wrong universe entirely), and tier-2 is invisible to every guard
that widens or re-patterns a search within a single root:

  tier 1  wrong scope WITHIN a universe   -> caught by widening the set
          (#if 0 line-range read; index-* excluded from the denominator;
           `41062` vs comma-formatted `41,062`)
  tier 2  wrong universe ENTIRELY         -> invisible to widening
          (a `-1` from the wrong index file; relative names resolved against
           root A while rows named root B; "no path to a peer's tree exists"
           written while 6 peer roots were mounted read-only)

The tier-2 fix is structural: never resolve a reference against ONE root. This
tool takes the reference set and reports, per target, WHICH root it resolves in
-- so "missing" can never be reported when the target simply lives elsewhere.

Controls run unconditionally, per fragcheck's design rule: a planted absent
target MUST report missing and a known-present target MUST resolve, or the run
exits 2 (CANNOT VERIFY) rather than certifying anything.

Exit 0 = every target resolved in some root + controls sound
     1 = real unresolved target(s)
     2 = CANNOT VERIFY (broken probe / no roots / controls did not fire)
"""

import argparse
import os
import re
import sys

# Every root this container can see. Discovered 2026-08-05; `--root` adds more.
# Order is report order, not precedence -- a target resolving in several roots is
# itself a finding (ambiguity), so we never stop at the first hit.
DEFAULT_ROOTS = [
    "/home/node/.claude/projects/-workspace-agent/memory",   # live lessons store (rw)
    "/workspace/agent/memory",                               # OKF store (rw)
    "/workspace/shared/learnings",                           # cross-group (rw for Main)
    "/workspace/shared/wiki",
]
PEER_GLOB_PARENT = "/workspace/extra/ephemeral/prod-groups"  # 6 peer stores (ro)

WIKILINK = re.compile(r"\[\[([A-Za-z0-9_.-]+)\]\]")
ABSPATH = re.compile(r"(/(?:home|workspace)/[A-Za-z0-9_./-]+\.md)")
NAMEFIELD = re.compile(r"^name:\s*\"?([^\"\n]+)\"?", re.MULTILINE)

# Slug index, built lazily per root: a `[[link]]` may address a memory's `name:`
# field rather than its filename. Measured 2026-08-05 in this store: 714 of 722
# files carry `name:`, and 138 differ from the filename -- 52 are the mechanical
# hyphen-for-underscore variant, 86 are free-text titles. Three live links resolve
# ONLY by slug. A filename-only resolver is therefore the RIGHT universe with the
# WRONG key -- a third tier-2 variant (peer-measured: 37 "broken" links that were
# all fine), distinct from wrong-root and wrong-haystack.
_SLUG_CACHE = {}


def slug_index(root):
    """Map every `name:` slug in `root` to its filename. Cached per root."""
    if root in _SLUG_CACHE:
        return _SLUG_CACHE[root]
    idx = {}
    try:
        names = [f for f in os.listdir(root) if f.endswith(".md")]
    except OSError:
        names = []
    for fn in names:
        try:
            with open(os.path.join(root, fn), encoding="utf-8", errors="replace") as fh:
                head = fh.read(2048)
        except OSError:
            continue
        m = NAMEFIELD.search(head)
        if m:
            idx.setdefault(m.group(1).strip(), fn)
    _SLUG_CACHE[root] = idx
    return idx


def discover_roots(extra):
    roots = []
    for r in DEFAULT_ROOTS:
        if os.path.isdir(r):
            roots.append(r)
    if os.path.isdir(PEER_GLOB_PARENT):
        for name in sorted(os.listdir(PEER_GLOB_PARENT)):
            cand = os.path.join(PEER_GLOB_PARENT, name, "memory")
            if os.path.isdir(cand):
                roots.append(cand)
    for r in extra or []:
        if os.path.isdir(r) and r not in roots:
            roots.append(r)
    return roots


def resolve(target, roots):
    """Return every root in which `target` exists.

    An absolute target is checked literally FIRST, then -- crucially -- retried by
    BASENAME across every root. Without that retry this tool reproduces the very
    bug it exists to catch: the six rows that motivated it name
    `/workspace/agent/memory/triage-12285.md`, which does not exist at that literal
    path but does exist under a peer root. Reporting those as "missing" would be a
    single-root verdict wearing a multi-root tool's output.
    """
    if target.startswith("/"):
        if os.path.exists(target):
            return ["<absolute>"]
        base = os.path.basename(target)
        return [r for r in roots if os.path.exists(os.path.join(r, base))]
    hits = []
    for r in roots:
        if os.path.exists(os.path.join(r, target)) or os.path.exists(
            os.path.join(r, target + ".md")
        ):
            hits.append(r)
            continue
        # Cheap normalizer BEFORE the slug index. Order matters for a necessity
        # claim, not just for a hit: a disjunctive resolver that returns on the
        # first success reports WHICH branch fired, never which branch was
        # NECESSARY. Measured 2026-08-05 -- all 3 links this tool called
        # "slug-only" resolve by hyphen->underscore variant, so the slug index was
        # sufficient but not necessary for any of them. Establishing necessity
        # requires running the cheaper branches and seeing them FAIL.
        variant = target.replace("-", "_")
        if variant != target and os.path.exists(os.path.join(r, variant + ".md")):
            hits.append(r + " (via filename variant)")
            continue
        # Right universe, wrong key: only now is the slug index load-bearing.
        if target in slug_index(r):
            hits.append(r + " (via slug ONLY)")
    return hits


def harvest(paths):
    """Pull wikilink names and absolute .md paths out of the given files."""
    names, abspaths = set(), set()
    for p in paths:
        try:
            with open(p, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        except OSError:
            continue
        names.update(WIKILINK.findall(text))
        abspaths.update(ABSPATH.findall(text))
    return names, abspaths


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", help="files to harvest references from")
    ap.add_argument("--target", action="append", help="check one target explicitly")
    ap.add_argument("--root", action="append", help="additional root to search")
    ap.add_argument("--quiet-resolved", action="store_true")
    args = ap.parse_args()

    roots = discover_roots(args.root)
    print(f"ROOTS ({len(roots)}):")
    for r in roots:
        writable = "rw" if os.access(r, os.W_OK) else "ro"
        n = len([f for f in os.listdir(r) if f.endswith(".md")])
        print(f"  [{writable}] {r}  ({n} .md)")
    print()

    if len(roots) < 2:
        print("CANNOT VERIFY: fewer than 2 roots discovered -- this tool exists to")
        print("compare universes, and with one universe it degenerates into the")
        print("single-root check whose failure mode it was built to catch.")
        return 2

    targets = set(args.target or [])
    if args.files:
        names, abspaths = harvest(args.files)
        targets |= names | abspaths

    # --- CONTROLS, unconditional ---
    ctl_absent = "zz_rootcheck_control_definitely_absent_xyzzy"
    if resolve(ctl_absent, roots):
        print("CANNOT VERIFY: must-miss control RESOLVED. Probe is broken.")
        return 2
    ctl_present = None
    for r in roots:
        mds = [f[:-3] for f in os.listdir(r) if f.endswith(".md")]
        if mds:
            ctl_present = mds[0]
            break
    if ctl_present is None or not resolve(ctl_present, roots):
        print("CANNOT VERIFY: must-hit control did not resolve. Probe is broken.")
        return 2
    print(f"controls OK (must-miss absent; must-hit '{ctl_present}' resolved)\n")

    if not targets:
        print("CANNOT VERIFY: no targets given (pass files or --target).")
        return 2

    unresolved, cross_root, via_slug, ambiguous, resolved = [], [], [], [], []
    for t in sorted(targets):
        hits = resolve(t, roots)
        if not hits:
            unresolved.append(t)
        elif len(hits) > 1:
            ambiguous.append((t, hits))
        else:
            hit = hits[0]
            base = hit.replace(" (via slug ONLY)", "").replace(" (via filename variant)", "")
            # Three distinct outcomes, deliberately NOT collapsed: a slug hit in the
            # primary root is the RIGHT root with a DIFFERENT KEY, which is a separate
            # finding from a hit in another root. Reporting it as "different root"
            # would be the same confident-about-a-neighbouring-question error the tool
            # exists to catch.
            if " (via slug ONLY)" in hit and base == roots[0]:
                via_slug.append((t, base))
            elif " (via filename variant)" in hit and base == roots[0]:
                resolved.append(t)
            elif base not in (roots[0], "<absolute>"):
                cross_root.append((t, hit))
            else:
                resolved.append(t)

    print(f"targets: {len(targets)}   resolved-in-primary: {len(resolved)}")
    if cross_root:
        print(f"\n⚠ RESOLVES IN A DIFFERENT ROOT ({len(cross_root)}) -- a single-root")
        print("  check would have called every one of these MISSING:")
        for t, r in cross_root:
            print(f"    {t}\n        -> {r}")
    if via_slug:
        print(f"\n⚠ RESOLVES BY `name:` SLUG, NOT FILENAME ({len(via_slug)}) -- right")
        print("  root, different key. A filename-only resolver calls these MISSING:")
        for t, r in via_slug:
            print(f"    {t}")
    if ambiguous:
        print(f"\n⚠ AMBIGUOUS -- same name in {len(ambiguous)} multiple roots:")
        for t, hits in ambiguous:
            print(f"    {t}  in {len(hits)} roots: {', '.join(hits)}")
    if unresolved:
        print(f"\n✗ UNRESOLVED IN ANY ROOT ({len(unresolved)}):")
        for t in unresolved:
            print(f"    {t}")
    if not args.quiet_resolved and resolved:
        print(f"\n✓ {len(resolved)} resolved in primary root")

    return 1 if unresolved else 0


if __name__ == "__main__":
    sys.exit(main())
