#!/usr/bin/env python3
"""kb-health — standing efficiency/cost telemetry for the shared-learnings KB.

Answers one question on a schedule: **is the knowledge flywheel worth what it costs?**
Cost = tokens spent reading the KB. Value = evidence agents actually used it. Shape =
whether the fold is staying bounded or drifting back to append-only growth.

HOST script. Read-side metrics need every group's session transcripts under
data/v2-sessions/, which a container cannot see (each container only mounts its own
group's .claude-shared). Run it from the host, not from the fold task.

  python3 scripts/kb-health.py [--days 10] [--repo <path>] [--json-only]

Writes data/shared/.kb-health.json (history, newest last) and data/shared/KB-HEALTH.md
(digest with deltas). Both live at the data/shared ROOT, which the knowledge_base sync
does not copy (it copies wiki/, sources/, learnings/ only) — so telemetry never leaks
into the public mirror. data/shared is mounted read-only into containers, so the
orchestrator can read the digest at /workspace/shared/KB-HEALTH.md.

LANDMINE: Python's glob will NOT descend into dot-directories, so `**` silently skips
every `.claude-shared/`. The transcript pattern must spell it literally. Two of the
probes that produced this script's baseline returned a confident zero because of it.

The history file is the ONLY record of the trend and cannot be recomputed — old
transcripts age out of the scan window. So this script never replaces it on a degraded
run: a scan that matched zero transcripts refuses to append (an outage is not a quiet
day), a history that fails to parse is preserved beside itself rather than reset to `[]`,
and both outputs are written temp+fsync+rename so a crash mid-write cannot truncate it.

Exit codes: 0 = a sample was recorded, 1 = refused to record (degraded input or
unparseable history), 2 = misconfigured (no such directory).
"""
import argparse
import collections
import datetime
import glob
import json
import os
import re
import shutil
import sys
import tempfile
import time

CHARS_PER_TOKEN = 4  # rough; consistent across runs is what matters for trends
ATOM_WINDOW_DAYS = 14


def transcripts(sessions_dir, cutoff):
    # NOTE the literal `.claude-shared` — see LANDMINE above.
    pat = os.path.join(sessions_dir, "*/.claude-shared/projects/-workspace-agent/**/*.jsonl")
    out = []
    for p in glob.glob(pat, recursive=True):
        try:
            if os.path.getmtime(p) >= cutoff and os.path.getsize(p) > 0:
                out.append(p)
        except OSError:
            pass
    return out


def layer_of(path):
    if "/wiki/index.md" in path:
        return "index"
    if "/wiki/concepts/" in path:
        return "concept"
    if "/wiki/topics/" in path:
        return "topic"
    if "/wiki/learnings/" in path or "/shared/learnings/" in path or "/sources/learnings/" in path:
        return "atom"
    return "other"


# Citations the VALUE metric counts as evidence the KB was actually used.
CITE_RE = re.compile(r"\b1\d{12}-[a-z0-9-]{5,}\.md|wiki/concepts/[a-z0-9-]+\.md")

# Cheap per-line pre-filter, applied before the JSON parse because these transcripts run
# to hundreds of MB.
#
# It has ONE correctness obligation: it must admit every line CITE_RE could match. The
# previous filter did not. It required "/workspace/shared", "tool_use_id" or
# "append_learning", and an assistant citing `[x](wiki/concepts/y.md)` in prose carries
# none of the three — so the citation evidence was discarded before anything tried to
# parse it, and `sessions_citing` was structurally an undercount. Every CITE_RE
# alternative ends in ".md", so admitting any line containing ".md" is a proven superset;
# test_admits_is_a_superset_of_the_citation_regex pins that property.
def admits(line):
    return ("/workspace/shared" in line or "tool_use_id" in line
            or "append_learning" in line or ".md" in line)


def scan_reads(files):
    """Returns (reads_by_layer, chars_by_layer, per_page_reads, sessions_touching,
    sessions_citing, appends, sessions_appending)."""
    reads = collections.Counter()
    chars = collections.Counter()
    per_page = collections.Counter()
    touching, citing, appending = set(), set(), set()
    appends = 0

    for f in files:
        pend = {}
        try:
            fh = open(f, errors="replace")  # noqa: SIM115 — closed by `with fh:` below
        except OSError:
            continue
        with fh:
            for line in fh:
                if not admits(line):
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    # One malformed line in a multi-GB transcript is normal and
                    # uninteresting; logging each would drown the run.
                    continue
                msg = rec.get("message") or {}
                content = msg.get("content")
                if msg.get("role") == "assistant" and isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "text" and CITE_RE.search(b.get("text") or ""):
                            citing.add(f)
                if not isinstance(content, list):
                    continue
                for b in content:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use":
                        name = b.get("name", "")
                        inp = b.get("input") or {}
                        if name.endswith("append_learning"):
                            appends += 1
                            appending.add(f)
                        fp = str(inp.get("file_path", ""))
                        if "/workspace/shared" in fp:
                            touching.add(f)
                            if name == "Read":
                                lay = layer_of(fp)
                                reads[lay] += 1
                                pend[b.get("id")] = lay
                                if lay == "concept":
                                    per_page[os.path.basename(fp)] += 1
                        elif "/workspace/shared" in json.dumps(inp)[:2000]:
                            touching.add(f)
                    elif b.get("type") == "tool_result":
                        lay = pend.pop(b.get("tool_use_id"), None)
                        if lay:
                            c = b.get("content")
                            t = (" ".join(x.get("text", "") for x in c if isinstance(x, dict))
                                 if isinstance(c, list) else str(c))
                            chars[lay] += len(t)
    return reads, chars, per_page, touching, citing, appends, appending


def atom_stats(learn_dir, recent_n=400, threshold=0.6):
    files = [p for p in sorted(glob.glob(os.path.join(learn_dir, "*.md")))
             if re.match(r"^\d{13}-", os.path.basename(p))]
    def slug(p):
        return re.sub(r"^\d{13}-", "", os.path.basename(p))[:-3]
    def toks(s):
        return {w for w in re.split(r"[^a-z0-9]+", s.lower()) if len(w) > 3}
    slugs = [(p, slug(p), toks(slug(p))) for p in files]
    exact = collections.Counter(s for _, s, _ in slugs)
    dup_exact = sum(v - 1 for v in exact.values() if v > 1)
    recent = slugs[-recent_n:]
    near = 0
    for p1, _, t1 in recent:
        if not t1:
            continue
        for p2, _, t2 in slugs:
            if p2 == p1 or not t2:
                continue
            if len(t1 & t2) / len(t1 | t2) >= threshold:
                near += 1
                break
    # atoms/day over the last 14 CALENDAR days.
    #
    # The denominator is the fixed window, not the number of days that happened to
    # produce an atom. Dividing by active days answers "how many atoms on a day when
    # atoms were written?", which rises as the KB goes quieter: three atoms across three
    # active days out of fourteen reported 1.0/day instead of 0.2/day — a 4.7x
    # overstatement, largest exactly when activity has collapsed.
    days = collections.Counter()
    for p in files:
        ms = int(os.path.basename(p).split("-")[0])
        days[datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).date()] += 1
    today = datetime.datetime.now(datetime.timezone.utc).date()
    start = today - datetime.timedelta(days=ATOM_WINDOW_DAYS - 1)
    in_window = sum(v for d, v in days.items() if start <= d <= today)
    per_day = round(in_window / float(ATOM_WINDOW_DAYS), 1)
    return {
        "total": len(files),
        "per_day_14d": per_day,
        "atoms_in_14d": in_window,
        "exact_dup_slugs": dup_exact,
        "near_dup_recent": near,
        "near_dup_window": len(recent),
        "near_dup_pct": round(100.0 * near / max(1, len(recent)), 1),
    }


def _read_lossy(path):
    with open(path, errors="replace") as fh:
        return fh.read()


def shape_stats(shared, per_page):
    wiki = os.path.join(shared, "wiki")
    cdir = os.path.join(wiki, "concepts")
    pages = sorted(glob.glob(os.path.join(cdir, "*.md")))
    sizes = sorted(os.path.getsize(p) for p in pages) or [0]
    over = [os.path.basename(p) for p in pages if os.path.getsize(p) > 40_000]
    notldr = [os.path.basename(p) for p in pages
              if "## TL;DR" not in _read_lossy(p)]
    dead = [os.path.basename(p) for p in pages if per_page.get(os.path.basename(p), 0) == 0]
    idx = os.path.join(wiki, "index.md")
    mirrors = {}
    for name, d in (("learnings", "learnings"),
                    ("sources", "sources/learnings"),
                    ("wiki", "wiki/learnings")):
        mirrors[name] = len(glob.glob(os.path.join(shared, d, "*.md")))
    return {
        "index_bytes": os.path.getsize(idx) if os.path.exists(idx) else 0,
        "concept_pages": len(pages),
        "concept_bytes": sum(os.path.getsize(p) for p in pages),
        "concept_median_bytes": sizes[len(sizes) // 2],
        "concept_max_bytes": sizes[-1],
        "pages_over_cap": len(over),
        "pages_over_cap_names": over,
        "pages_missing_tldr": len(notldr),
        "pages_never_read": len(dead),
        "pages_never_read_names": dead,
        "mirrors": mirrors,
        "mirror_drift": max(mirrors.values()) - min(mirrors.values()),
    }


def write_atomic(path, text):
    """temp + fsync + rename, in the destination directory.

    Both outputs were written in place. `.kb-health.json` is append-only trend data that
    cannot be recomputed, and the dashboard reads it on every request — a crash or a full
    disk partway through `write()` left a truncated file that the next run then failed to
    parse, which (before the guard above) reset the history to empty.
    """
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".kb-health.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def fmt(n):
    return f"{n:,}"


def digest(cur, prev):
    def d(path):
        """Percent delta vs the previous run, or '' when there's no comparable prior."""
        c, p = cur, prev
        for k in path.split("."):
            c = (c or {}).get(k) if isinstance(c, dict) else None
            p = (p or {}).get(k) if isinstance(p, dict) else None
        if not isinstance(c, (int, float)):
            return ""
        if not isinstance(p, (int, float)) or p == 0:
            return ""
        delta = 100.0 * (c - p) / p
        if abs(delta) < 1:
            return "  (flat)"
        return f"  ({'+' if delta > 0 else ''}{delta:.0f}% vs prev)"

    c = cur
    tok = c["cost"]["tokens_total"]
    L = []
    L.append(f"# KB Health — {c['date']}  ({c['window_days']}d window)\n")
    L.append("## Cost — what the KB charges\n")
    L.append("```")
    L.append(f"read tokens      {tok/1e6:>8.2f} M   ({tok/max(1,c['window_days'])/1000:.0f} K/day){d('cost.tokens_total')}")
    for lay in ("index", "concept", "atom", "topic"):
        t = c["cost"]["tokens_by_layer"].get(lay, 0)
        share = 100.0 * t / max(1, tok)
        L.append(f"  {lay:<12} {t/1e6:>8.2f} M   ({share:4.1f}%)   {fmt(c['cost']['reads_by_layer'].get(lay,0))} reads")
    L.append("```\n")
    L.append("## Value — evidence it was used\n")
    L.append("```")
    v = c["value"]
    L.append(f"sessions touching KB   {fmt(v['sessions_touching'])} / {fmt(v['sessions_total'])}  ({v['pct_touching']}%){d('value.pct_touching')}")
    L.append(f"sessions citing KB     {fmt(v['sessions_citing'])} / {fmt(v['sessions_total'])}  ({v['pct_citing']}%){d('value.pct_citing')}")
    L.append(f"append_learning calls  {fmt(v['appends'])}   write:read = 1:{v['read_write_ratio']}")
    L.append(f"tokens per citing session  {v['tokens_per_citing_session']/1000:.0f} K")
    L.append("```\n")
    L.append("## Shape — is the fold staying bounded?\n")
    L.append("```")
    s = c["shape"]
    a = c["atoms"]
    L.append(f"atoms                  {fmt(a['total'])}   (+{a['per_day_14d']}/day){d('atoms.total')}")
    L.append(f"index.md               {fmt(s['index_bytes'])} B      <- must stay O(concepts), not O(atoms)")
    L.append(f"concept pages          {s['concept_pages']}   total {s['concept_bytes']/1e6:.2f} MB   median {s['concept_median_bytes']//1024} KB   max {s['concept_max_bytes']//1024} KB{d('shape.concept_bytes')}")
    L.append(f"pages over 40 KB cap   {s['pages_over_cap']}      <- target 0{d('shape.pages_over_cap')}")
    L.append(f"pages missing TL;DR    {s['pages_missing_tldr']}      <- target 0{d('shape.pages_missing_tldr')}")
    L.append(f"pages never read       {s['pages_never_read']} / {s['concept_pages']}")
    L.append(f"near-duplicate atoms   {a['near_dup_pct']}% of last {a['near_dup_window']}   ({a['exact_dup_slugs']} exact-slug collisions)")
    m = s["mirrors"]
    L.append(f"mirror drift           learnings {m['learnings']} / sources {m['sources']} / wiki {m['wiki']}   (drift {s['mirror_drift']})")
    L.append("```\n")
    L.append("**Read this as a ratio, not a level.** Rising cost is fine if value rises with it.")
    L.append("The failure mode to catch is `concept_bytes` growing faster than `atoms` — that means")
    L.append("the fold is inventorying rather than synthesizing, and the fix is more supersession")
    L.append("and more splitting, not a bigger page.\n")
    if s["pages_over_cap"]:
        L.append(f"> Over cap: {', '.join(s['pages_over_cap_names'][:6])}"
                 + (" …" if len(s["pages_over_cap_names"]) > 6 else ""))
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=10)
    ap.add_argument("--repo", default=os.path.expanduser("~/slang-coworkers-prod/nanoclaw"))
    ap.add_argument("--json-only", action="store_true")
    args = ap.parse_args()

    shared = os.path.join(args.repo, "data", "shared")
    sessions = os.path.join(args.repo, "data", "v2-sessions")
    if not os.path.isdir(shared):
        print(f"no such dir: {shared}", file=sys.stderr)
        return 2

    cutoff = time.time() - args.days * 86400
    files = transcripts(sessions, cutoff)
    if not files:
        # REFUSE to record. Zero transcripts is overwhelmingly a broken glob, an unmounted
        # sessions dir, or a wrong --repo — not a fortnight of silence. The old code warned
        # and then appended a full sample of zeros, so a scan that saw nothing became a
        # datapoint asserting the KB went unused, permanently, in the one file that cannot
        # be recomputed.
        print("REFUSING to record: 0 transcripts matched under "
              f"{sessions} — check --repo and the .claude-shared glob (see LANDMINE). "
              "No sample appended; existing history untouched.", file=sys.stderr)
        return 1

    reads, chars, per_page, touching, citing, appends, appending = scan_reads(files)
    tokens_by_layer = {k: v // CHARS_PER_TOKEN for k, v in chars.items()}
    tokens_total = sum(tokens_by_layer.values())
    reads_total = sum(reads.values())

    cur = {
        "date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "window_days": args.days,
        "cost": {
            "reads_total": reads_total,
            "reads_by_layer": dict(reads),
            "tokens_total": tokens_total,
            "tokens_by_layer": tokens_by_layer,
            "avg_chars_per_read": (sum(chars.values()) // reads_total) if reads_total else 0,
        },
        "value": {
            "sessions_total": len(files),
            "sessions_touching": len(touching),
            "sessions_citing": len(citing),
            "pct_touching": round(100.0 * len(touching) / max(1, len(files)), 1),
            "pct_citing": round(100.0 * len(citing) / max(1, len(files)), 1),
            "appends": appends,
            "sessions_appending": len(appending),
            "read_write_ratio": round(reads_total / max(1, appends), 1),
            "tokens_per_citing_session": tokens_total // max(1, len(citing)),
        },
        "atoms": atom_stats(os.path.join(shared, "learnings")),
        "shape": shape_stats(shared, per_page),
        "top_pages": [{"page": p, "reads": n,
                       "bytes": os.path.getsize(os.path.join(shared, "wiki/concepts", p))
                       if os.path.exists(os.path.join(shared, "wiki/concepts", p)) else 0}
                      for p, n in per_page.most_common(15)],
    }

    hist_path = os.path.join(shared, ".kb-health.json")
    hist = []
    if os.path.exists(hist_path):
        try:
            with open(hist_path, encoding="utf-8") as fh:
                hist = json.load(fh)
            if not isinstance(hist, list):
                # TRY004 wants TypeError. This is not argument validation — it is
                # "the file on disk is corrupt", and it must be caught below with
                # the JSONDecodeError that means the same thing.
                raise ValueError(  # noqa: TRY004
                    f"history is {type(hist).__name__}, expected a list")
        except (OSError, ValueError) as e:
            # PRESERVE, do not reset. `hist = []` silently threw away the entire trend and
            # the very next write replaced the file with a single fresh sample — one bad
            # read and the history was gone with nothing to inspect. Move it aside and
            # stop; a human should see why it corrupted, and atomic writes below mean it
            # should not happen again.
            keep = f"{hist_path}.corrupt.{datetime.datetime.now(datetime.timezone.utc):%Y%m%dT%H%M%SZ}"
            try:
                shutil.copy2(hist_path, keep)
                where = keep
            except OSError as ce:
                where = f"<could not copy: {ce}>"
            print(f"REFUSING to record: {hist_path} did not parse ({type(e).__name__}: {e}). "
                  f"Preserved at {where}. The trend cannot be recomputed from aged-out "
                  "transcripts, so nothing was overwritten — inspect, repair or remove the "
                  "original, then re-run.", file=sys.stderr)
            return 1

    # IDEMPOTENT PER DAY. Appending unconditionally made a re-run record the same date
    # twice, and — worse — made `prev` this morning's run of *itself*, so the digest
    # diffed a sample against its own near-identical predecessor and reported a day of
    # flat zeros. Replacing today's entry keeps a retry harmless and keeps `prev` the
    # previous DISTINCT day.
    hist = [h for h in hist if not (isinstance(h, dict) and h.get("date") == cur["date"])]
    prev = hist[-1] if hist else None
    hist.append(cur)
    hist = hist[-90:]  # ~3 months of daily runs

    # BUILD AND VALIDATE BOTH DOCUMENTS BEFORE EITHER REPLACE. These are two files that
    # have to agree: the history is the only record of the trend and cannot be
    # recomputed, and the digest is what a human reads. Replacing the history first and
    # then failing to build the digest left a recorded sample with no digest describing
    # it, and nothing said so. Anything that can raise happens here, while both targets
    # still hold their previous contents.
    hist_json = json.dumps(hist, indent=1)
    json.loads(hist_json)  # round-trip: refuse to replace the trend with something unreadable
    text = digest(cur, prev)
    if not text.strip():
        print("REFUSING to record: the digest rendered empty; history left untouched.", file=sys.stderr)
        return 1

    # Two replaces remain two syscalls — POSIX offers nothing better — but both inputs
    # are now known-good, so the only surviving window is a crash between them. The
    # sample carries `generated_at` and the digest carries the same date, so a torn pair
    # is detectable rather than silent.
    write_atomic(hist_path, hist_json)
    write_atomic(os.path.join(shared, "KB-HEALTH.md"), text + "\n")
    if not args.json_only:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
