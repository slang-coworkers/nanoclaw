#!/usr/bin/env python3
"""Loss detector for region-replacing edits: snapshot landmarks, verify after.

Answers a question `fragcheck` structurally cannot. `fragcheck` asks "is X
present?" given X -- so it can never detect the loss of something you forgot to
list. This harvests the landmark set FROM the artifact, so an edit that replaces
a region reports what the region contained.

Motivating incident (a peer's, 2026-08-05): compressing an oversized index
block, it sliced `my heading .. next '##' heading` without reading the region,
and replaced a paragraph holding the reachability pointers for every live chain.
All 8 fragments it was compressing verified fine. The loss was invisible to a
content check because a content check only looks for what you name.

My own version of the same failure, minutes earlier: doing that check by hand, I
typed `Rules` as an expected neighbour of a file whose real headings are `The
rule` / `Confirmed three times` / `Two sub-findings`. No such section existed --
I invented a needle and the probe reported it absent, in the direction that
would have had me "restoring" content that was never there.

    nbrcheck.py snapshot <file> [<file> ...]     # before an edit
    nbrcheck.py verify   <file> [<file> ...]     # after

Exit 0 = no landmarks lost · 1 = landmarks LOST · 2 = CANNOT VERIFY
(no snapshot, or the harvester found too few landmarks to be meaningful).
"""
import json
import os
import re
import sys
import unicodedata

STORE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".nbrcheck.json")

# Markdown ATX headings.
_HEAD = re.compile(r"^#{1,6}[ \t]+(.{4,90}?)[ \t]*#*$", re.M)

# Bold run-in labels: `**SOMETHING IN CAPS ...**`. These stores lead paragraphs
# with an emphatic caps label instead of a heading, so headings alone miss most
# of the structure -- the peer's tool reported "headings 2/2 intact" while the
# lost block was a run-in label, which is exactly what fooled it.
#
# Capture to the CLOSING `**`, not to the end of the caps run: real labels
# continue in mixed case (`**LIFEBOAT POINTERS - chain children whose...**`).
# A regex anchored on the caps run alone cannot match those, which is how the
# peer's first version missed the very block whose loss motivated it.
_LABEL = re.compile(r"\*\*([^*\n]{8,120}?)\*\*")
_CAPSY = re.compile(r"[A-Z]{4,}")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[*`~]+", "", s)
    s = re.sub(r"[‐‑‒–—―−]", "-", s)
    return " ".join(s.split()).lower()


def landmarks(text: str) -> list[str]:
    """Harvest structural landmarks from the artifact itself.

    Never hand-list the expected set: the point is to find what you would not
    have thought to name. Landmarks are normalized so an edit that only
    re-emphasizes or re-wraps text does not read as loss.
    """
    out = []
    for m in _HEAD.finditer(text):
        out.append(norm(m.group(1)))
    for m in _LABEL.finditer(text):
        body = m.group(1)
        if _CAPSY.search(body):          # emphatic label, not ordinary bolding
            out.append(norm(body))
    seen, uniq = set(), []
    for x in out:
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def load() -> dict:
    if os.path.exists(STORE):
        with open(STORE, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def main() -> int:
    if len(sys.argv) < 3 or sys.argv[1] not in ("snapshot", "verify"):
        print(__doc__)
        return 2
    mode, paths = sys.argv[1], sys.argv[2:]
    db = load()
    rc = 0

    for p in paths:
        # An unhandled exception exits 1, which in this scheme means "LANDMARKS
        # LOST" -- a crash would report a loss nobody measured. Map every error
        # path to 2 explicitly.
        try:
            with open(p, encoding="utf-8") as fh:
                marks = landmarks(fh.read())
        except (OSError, UnicodeDecodeError) as exc:
            print(f"CANNOT VERIFY {p}: cannot read artifact ({exc}). "
                  f"Nothing was measured; this is NOT a loss.")
            rc = max(rc, 2)
            continue
        key = os.path.abspath(p)

        if mode == "snapshot":
            db[key] = marks
            print(f"snapshot {p}: {len(marks)} landmarks")
            continue

        before = db.get(key)
        if before is None:
            print(f"CANNOT VERIFY {p}: no snapshot -- run `snapshot` before the edit")
            rc = max(rc, 2)
            continue
        if len(before) < 3:
            print(f"CANNOT VERIFY {p}: only {len(before)} landmarks harvested; "
                  f"too few for the check to mean anything")
            rc = max(rc, 2)
            continue

        lost = [m for m in before if m not in marks]
        print(f"{p}: {len(before) - len(lost)}/{len(before)} landmarks intact")
        for m in lost:
            print(f"   LOST  {m[:96]}")
        if lost:
            rc = max(rc, 1)

    if mode == "snapshot":
        with open(STORE, "w", encoding="utf-8") as fh:
            json.dump(db, fh)
    print("\nVERDICT:", {0: "no loss", 1: "LANDMARKS LOST", 2: "CANNOT VERIFY"}[rc])
    return rc


if __name__ == "__main__":
    sys.exit(main())
