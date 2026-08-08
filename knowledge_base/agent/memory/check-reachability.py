import os,re,io,sys
# Reachability gate for a memory store, keyed on the FOUR axes that each
# independently produce a false zero (measured 2026-08-07 with slang-fixer):
#   corpus     — the wrong store/root reports a true number about a set you never saw
#   root       — which file the loader actually reads (index.md vs MEMORY.md vs shards)
#   notation   — [[wikilink]] and ](path.md) both occur; a single-notation parser
#                read 1 row in a 19KB file
#   resolution — a hop-2 link is a PATH; basename()ing it before the join destroys
#                the directory and silently rescans the root index
# Plus the bound: the loader truncates at BOUND chars, so a row past it is present
# on disk and invisible in context. Modelling reachability without the bound calls
# such a row "reachable" — a false clean (constructed and confirmed on this store).
BOUND = 24986
# A hub cites this many targets or more. 5 sits well above the 4 cross-links a
# leaf carries in prose here and well below the 27–47 a real hub carries.
HUB_MIN_LINKS = 5

def targets(text):
    """Extract link targets in BOTH notations, preserving the path.

    Never basename() here: hop 2 needs the directory to resolve `(system/index.md)`
    against its own parent, and flattening it to `index` makes hop 2 reopen the
    root index instead.
    """
    t = set(re.findall(r'\[\[([A-Za-z0-9_\-]+)\]\]', text))
    t |= set(re.findall(r'\]\(([^)]+\.md)\)', text))
    return t

def read_within_bound(path):
    """Read a file as the LOADER sees it: truncated at BOUND, with a warning."""
    s = io.open(path, encoding='utf-8').read()
    if len(s) > BOUND:
        print('!! %s is %d chars, OVER the %d bound — %d tail rows are dropped on load'
              % (path, len(s), BOUND, len(targets(s)) - len(targets(s[:BOUND]))))
    return s[:BOUND]

roots = [r for r in ('index.md', 'MEMORY.md') if os.path.exists(r)]
if not roots:
    sys.exit('no root index found (expected index.md and/or MEMORY.md) — wrong corpus?')

linked = set()
for r in roots:
    linked |= targets(read_within_bound(r))

def is_hub(path):
    """True if hop 2 must follow this root-linked file, by ANY of three signals.

    No single signal is sound, all three were measured wrong on this store:
      - name ('index' in basename): silently skips a hub the store grows under a
        new prefix — an `active-*` hub went unfollowed while the gate still
        printed ORPHANED=0.
      - frontmatter (`type: index`): 3 of 45 real hubs here declare type
        reference/project/feedback instead, and one declares it past any fixed
        head window, so it must be searched in the whole frontmatter.
      - link count: `slang/index.md` and `system/index.md` are genuine hubs that
        cite exactly ONE leaf each, so any threshold above 1 drops them, and a
        threshold of 1 makes every prose cross-reference a hub.
    Union them. Over-following costs a file read; under-following reports a clean
    zero over leaves nobody can reach.
    """
    text = io.open(path, encoding='utf-8').read()
    name = os.path.basename(path)[:-3]
    if 'index' in name or name.startswith(('slang-', 'dark_', 'active-')):
        return True
    fm = text.split('\n---', 2)
    if len(fm) > 1 and re.search(r'^\s*type:\s*index\s*$', fm[1], re.M):
        return True
    return len(targets(text)) >= HUB_MIN_LINKS


# hop 2: follow every linked file that behaves like a hub, resolving each of its
# links against ITS OWN directory, then normalising to a store-root-relative path.
for t in list(linked):
    p = t if t.endswith('.md') else t + '.md'
    if os.path.exists(p) and is_hub(p):
        d = os.path.dirname(p)
        for sub in targets(read_within_bound(p)):
            linked.add(os.path.normpath(os.path.join(d, sub)) if d else sub)

names = {os.path.basename(x)[:-3] if x.endswith('.md') else os.path.basename(x) for x in linked}
paths = {x[:-3] if x.endswith('.md') else x for x in linked}

# population: walk RECURSIVELY. A flat listdir is correct only while no leaf lives
# in a subdirectory — a property of today's content, not of this code.
leaves = set()
for dp, dns, fs in os.walk('.'):
    dns[:] = [d for d in dns if d not in ('.git', 'node_modules')]
    for f in fs:
        if not f.endswith('.md'):
            continue
        rel = os.path.relpath(os.path.join(dp, f), '.')
        b = os.path.basename(rel)[:-3]
        if b.startswith(('index-', 'MEMORY', 'reindex')) or b == 'index':
            continue
        leaves.add(rel[:-3])

orph = sorted(l for l in leaves if l not in paths and os.path.basename(l) not in names)
print('leaves=%d reachable=%d ORPHANED=%d' % (len(leaves), len(leaves) - len(orph), len(orph)))
for o in orph:
    print('  ORPHAN:', o)
sys.exit(1 if orph else 0)
