#!/usr/bin/env python3
"""task-hygiene.py — deterministic GC + cap for per-chain re-chase / watch tasks.

The orchestrator parks a GitHub issue/PR chain by scheduling a one-shot
"re-chase" (`ncl tasks create --process-after …`); when it fires, the chain is
re-examined and, if still parked, schedules the next one. Two leaks follow
(measured 2026-10-15: ~110 live one-shots on the orchestrator, many targeting
closed issues, chains on their 4th/7th/15th re-chase):

  1. nothing cancels a re-chase or a per-issue watch once its target closes;
  2. nothing bounds how many times a chain re-chases itself.

This script closes both, with zero model tokens, as the pre-task gate of the
orchestrator's hourly `task-hygiene` task (see SKILL.md → *Re-chase one-shots*):

  A. CLOSED  — a live re-chase/re-check/watch task whose targets are ALL closed
               or merged on GitHub is cancelled (`ncl tasks cancel --id`).
  B. CAP     — every re-chase one-shot of a chain gets a durable ordinal; one
               whose ordinal exceeds MAX_RECHASES is cancelled and the chain is
               PARKED. Parked chains are listed in ONE weekly digest (the gate
               wakes the agent once a week to deliver it) and always in
               /workspace/agent/reports/parked-chains.md.

Only tasks matching the ALLOW pattern are ever considered (an explicit
allow-list of re-chase / re-check / per-issue watch shapes — never a deny-list
of core jobs); CORE_GUARD is a second, independent belt that vetoes anything
that looks like a core recurring job even if it slipped through ALLOW.

Target extraction (`parse_refs`): a structured reference is preferred — the
canonical thread id `gh-issue-<owner>/<repo>-<n>` / `gh-pr-<owner>/<repo>-<n>`,
`<owner>/<repo>#<n>`, or a github.com issue/pull URL. The FIRST structured ref
is the chain key. Bare `#<n>` refs are resolved against the chain's repo only
when the prompt names no other known repo; otherwise the task is ambiguous and
kept. A task with no resolvable target is kept and reported as `unresolved`.
A task referencing several items is cancelled only when ALL are closed. Any
GitHub lookup failure leaves the task alone.

Per-chain re-chase count — durable, two sources, max wins:
  * the declared ordinal: the name `rechase-<repo>-<n>-r<k>` (or `-r<k>` /
    "(r<k>/N)" / "<k>th re-chase" in the prompt) — what new re-chases carry;
  * the gate's state file (STATE_PATH): every re-chase series the gate has
    seen is assigned an ordinal on first sight (declared, else chain max + 1),
    so renaming a task cannot reset the count.

Modes:
  --gate          (default) act, write state + report, print gate JSON last.
  --dry-run       plan only: no cancels, no state/report writes.
  next <ref>      before scheduling a re-chase: print the chain's next name,
                  prompt prefix and whether the cap allows it (exit 3 = cap
                  reached; the chain is parked and joins the weekly digest).
  unpark <ref>    operator reset: forget a chain's count and parked entry.
"""

from __future__ import annotations

import contextlib
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time

MAX_RECHASES = int(os.environ.get("TASK_HYGIENE_MAX_RECHASES", "3"))
DIGEST_EVERY_DAYS = 7
GATE_BUDGET_S = float(os.environ.get("TASK_HYGIENE_BUDGET_S", "240"))
GH_BATCH = 40

AGENT = os.environ.get("TASK_HYGIENE_AGENT_DIR", "/workspace/agent")
STATE_PATH = os.path.join(AGENT, ".task-hygiene", "state.json")
REPORT_PATH = os.path.join(AGENT, "reports", "parked-chains.md")

DEFAULT_OWNER = "shader-slang"
DEFAULT_REPO = "shader-slang/slang"
# Bare-ref repo hints; longest first so "slang-rhi" is not read as "slang".
REPO_HINTS = (
    ("slang-vscode-extension", "shader-slang/slang-vscode-extension"),
    ("slang-rhi", "shader-slang/slang-rhi"),
    ("slangpy", "shader-slang/slangpy"),
)

# --- What may be touched -------------------------------------------------------
# Name slug (series id minus its `-<4hex>` suffix) of a re-chase/re-check one-shot.
RECHASE_NAME = re.compile(r"^re-?(?:chase|check)(?:[-_]|\d|$)", re.IGNORECASE)
# Name slug of a per-issue watch: `watch-13261-dep`, `i13435-maintainer-gate`, `pr12200-…`.
WATCH_NAME = re.compile(r"^(?:watch[-_]?\d|watch[-_][a-z0-9-]*\d{3,6}|(?:i|issue|pr)[-_]?\d{3,6}(?:[-_]|$))", re.IGNORECASE)
# A prompt that OPENS with "Re-chase"/"Re-check" (optionally bracketed/bolded).
RECHASE_PROMPT = re.compile(r"^[\s\[(*_>#-]*re-?(?:chase|check)\b", re.IGNORECASE)
# Second belt: anything shaped like a core recurring job is never touched.
CORE_GUARD = re.compile(
    r"supervise|okf|synthesis|worktree|nightly|kb[-_]?sync|release|heartbeat|watchdog|"
    r"hygiene|memory|report|digest|babysit|scan",
    re.IGNORECASE,
)

# --- Reference grammar ---------------------------------------------------------
_SEG = r"[A-Za-z0-9_.-]+"
THREAD_REF = re.compile(rf"\bgh-(?:issue|pr)-({_SEG})/({_SEG}?)-(\d+)\b")
URL_REF = re.compile(rf"github\.com/({_SEG})/({_SEG})/(?:issues|pull)/(\d+)\b")
SLASH_REF = re.compile(rf"(?<![\w/.-])({_SEG})/({_SEG})#(\d+)\b")
BARE_REF = re.compile(r"(?<![\w/.#-])#(\d{3,6})\b")
NAME_NUM = re.compile(r"(?<!\d)(\d{3,6})(?!\d)")
ORDINAL_PATTERNS = (
    re.compile(r"(?:^|[-_])r(\d{1,3})(?:[-_]|$)", re.IGNORECASE),               # name: rechase-…-r4
    re.compile(r"\(r(\d{1,3})(?:/\d+)?\)", re.IGNORECASE),                        # prompt: (r4/3)
    re.compile(r"\b(\d{1,3})(?:st|nd|rd|th)\s+re-?(?:chase|check)", re.IGNORECASE),  # prompt: 4th re-chase
    re.compile(r"\bre-?(?:chase|check)\s*(?:no\.?\s*|number\s*|#)(\d{1,2})\b", re.IGNORECASE),  # re-chase #4
)


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str | None) -> dt.datetime | None:
    if not s:
        return None
    try:
        t = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def slug_of(series_id: str) -> str:
    """The name half of a series id (`makeTaskId` appends `-<4hex>`)."""
    return re.sub(r"-[0-9a-f]{4}$", "", series_id or "")


def norm(owner: str, repo: str, num: str | int) -> str:
    return f"{owner.lower()}/{repo.lower()}#{int(num)}"


def chain_thread(ref: str) -> str:
    repo, num = ref.split("#")
    return f"gh-issue-{repo}-{num}"


def _hinted_repos(text: str) -> set[str]:
    low = text.lower()
    found = set()
    for token, repo in REPO_HINTS:
        if re.search(rf"(?<![\w-]){re.escape(token)}(?![\w-])", low):
            found.add(repo)
    return found


def parse_refs(prompt: str, name: str = "") -> tuple[list[str], str | None]:
    """Ordered, de-duplicated `owner/repo#n` targets of a task, and an error.

    Returns (refs, None) on success, ([], reason) when the target cannot be
    resolved safely. refs[0] is the chain key.
    """
    text = prompt or ""
    spans: list[tuple[int, str]] = []
    masked = text
    for pat in (THREAD_REF, URL_REF, SLASH_REF):
        for m in pat.finditer(masked):
            spans.append((m.start(), norm(m.group(1), m.group(2), m.group(3))))
        masked = pat.sub(lambda m: " " * len(m.group(0)), masked)
    spans.sort()
    refs: list[str] = []
    for _, r in spans:
        if r not in refs:
            refs.append(r)

    bare = [m.group(1) for m in BARE_REF.finditer(masked)]
    hinted = _hinted_repos(masked)
    if refs:
        if bare:
            base = refs[0].split("#")[0]
            if hinted - {base}:
                return [], "ambiguous: bare #refs alongside another repo name"
            for n in bare:
                r = f"{base}#{int(n)}"
                if r not in refs:
                    refs.append(r)
        return refs, None

    # Fallback — no structured ref anywhere: bare refs (or the name's number)
    # against the one repo the text names, else the default repo.
    if len(hinted) > 1:
        return [], "ambiguous: several repos named, no structured ref"
    base = next(iter(hinted)) if hinted else DEFAULT_REPO
    nums = bare
    if not nums:
        slug = slug_of(name)
        slug_hint = _hinted_repos(slug.replace("_", "-"))
        if slug_hint and not hinted:
            base = next(iter(slug_hint))
        nums = NAME_NUM.findall(slug)[:1]
    if not nums:
        return [], "no target reference"
    out: list[str] = []
    for n in nums:
        r = f"{base}#{int(n)}"
        if r not in out:
            out.append(r)
    return out, None


def declared_ordinal(name: str, prompt: str) -> int | None:
    best = None
    slug = slug_of(name)
    for i, pat in enumerate(ORDINAL_PATTERNS):
        hay = slug if i == 0 else (prompt or "")
        for m in pat.finditer(hay):
            k = int(m.group(1))
            if 0 < k < 1000:
                best = k if best is None else max(best, k)
    return best


def task_kind(task: dict) -> str | None:
    """'rechase' | 'watch' | None (never touched). Allow-pattern, then core belt."""
    series = task.get("series_id") or ""
    slug = slug_of(series)
    prompt = task.get("prompt") or ""
    if CORE_GUARD.search(slug):
        return None
    if RECHASE_NAME.search(slug) or RECHASE_PROMPT.search(prompt):
        kind = "rechase" if not task.get("recurrence") else "watch"
    elif WATCH_NAME.search(slug):
        kind = "watch"
    else:
        return None
    # The prompt head must not be a core job either (a re-check that opens by
    # naming the supervisor tick, say) — belt on the first line.
    first_line = prompt.strip().split("\n", 1)[0][:160]
    if CORE_GUARD.search(first_line) and not (THREAD_REF.search(first_line) or SLASH_REF.search(first_line)):
        return None
    return kind


def is_closed(state: str | None) -> bool | None:
    if not state:
        return None
    s = state.upper()
    if s == "OPEN":
        return False
    if s in ("CLOSED", "MERGED"):
        return True
    return None


# --- State ---------------------------------------------------------------------

def empty_state() -> dict:
    return {"version": 1, "chains": {}, "ordinals": {}, "parked": {}, "prompts": {}, "last_digest_at": None}


def load_state(path: str | None = None) -> dict:
    path = path or STATE_PATH
    try:
        with open(path) as f:
            st = json.load(f)
    except (OSError, ValueError):
        return empty_state()
    base = empty_state()
    if isinstance(st, dict):
        base.update({k: v for k, v in st.items() if k in base})
    return base


def save_state(st: dict, path: str | None = None) -> None:
    path = path or STATE_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp.{os.getpid()}"
    with open(tmp, "w") as f:
        json.dump(st, f, indent=1, sort_keys=True)
    os.replace(tmp, path)


@contextlib.contextmanager
def state_lock(path: str | None = None):
    path = path or STATE_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        import fcntl
    except ImportError:  # pragma: no cover — non-POSIX
        yield
        return
    with open(path + ".lock", "w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)


def assign_ordinal(st: dict, chain: str, series: str, declared: int | None) -> int:
    """Durable per-series ordinal: assigned once, on first sight."""
    ords = st.setdefault("ordinals", {})
    ch = st.setdefault("chains", {}).setdefault(chain, {"max_ordinal": 0, "series": []})
    if series in ords:
        k = int(ords[series])
        if declared and declared > k:  # a later-declared higher ordinal still counts
            k = declared
            ords[series] = k
    else:
        k = declared if declared else int(ch.get("max_ordinal", 0)) + 1
        ords[series] = k
        ch.setdefault("series", []).append(series)
    ch["max_ordinal"] = max(int(ch.get("max_ordinal", 0)), k)
    return k


# --- Planning (pure) -------------------------------------------------------------

def plan(tasks: list[dict], gh_states: dict[str, str | None], st: dict, now: dt.datetime,
         cap: int = MAX_RECHASES) -> dict:
    """Decide every action. `tasks` carry FULL prompts; `gh_states` maps
    `owner/repo#n` → OPEN|CLOSED|MERGED|None. Mutates `st` (ordinals, parked)."""
    cancel: list[dict] = []
    keep: list[dict] = []
    unresolved: list[dict] = []
    parked = st.setdefault("parked", {})
    closed_chains: set[str] = set()

    for t in tasks:
        kind = task_kind(t)
        if kind is None:
            continue
        series = t["series_id"]
        refs, err = parse_refs(t.get("prompt") or "", series)
        row = {"series_id": series, "kind": kind, "refs": refs,
               "prompt_head": (t.get("prompt") or "").strip().split("\n", 1)[0][:140]}
        if err:
            unresolved.append({**row, "reason": err})
            continue
        states = {r: gh_states.get(r) for r in refs}
        closed = [is_closed(s) for s in states.values()]
        row["states"] = states
        if all(c is True for c in closed):
            cancel.append({**row, "reason": "closed", "why": ", ".join(f"{r} {s}" for r, s in states.items())})
            closed_chains.add(refs[0])
            continue
        if any(c is None for c in closed) and not any(c is False for c in closed):
            unresolved.append({**row, "reason": "github state unknown"})
            continue
        chain = refs[0]
        if kind == "rechase":
            k = assign_ordinal(st, chain, series, declared_ordinal(series, t.get("prompt") or ""))
            row["ordinal"] = k
            base = int(st["chains"][chain].get("base", 0))
            if k - base > cap:
                cancel.append({**row, "reason": "cap", "why": f"re-chase #{k - base} > cap {cap}"})
                entry = parked.get(chain) or {"parked_at": iso(now)}
                entry.update({"thread_id": chain_thread(chain), "count": k - base, "last_series": series,
                              "prompt_head": row["prompt_head"], "refs": refs})
                parked[chain] = entry
                continue
        keep.append(row)

    # Parked chains whose target has since closed leave the digest.
    unparked = []
    for chain, entry in list(parked.items()):
        refs = entry.get("refs") or [chain]
        if refs and all(is_closed(gh_states.get(r)) is True for r in refs):
            unparked.append(chain)
            del parked[chain]
            closed_chains.add(chain)
    # A closed chain's count is no longer needed; keep the state file bounded.
    for chain in closed_chains:
        if chain in parked:
            continue
        rec = st.get("chains", {}).pop(chain, None) or {}
        for sid in rec.get("series", []):
            st.get("ordinals", {}).pop(sid, None)

    last = parse_iso(st.get("last_digest_at"))
    digest_due = bool(parked) and (last is None or (now - last).days >= DIGEST_EVERY_DAYS)
    digest = sorted(({"chain": c, **e} for c, e in parked.items()), key=lambda e: e.get("parked_at") or "")
    return {"cancel": cancel, "keep": keep, "unresolved": unresolved, "unparked": unparked,
            "parked": digest, "digest_due": digest_due}


def next_rechase(chain_ref: str, st: dict, live_tasks: list[dict], cap: int = MAX_RECHASES) -> dict:
    """What the orchestrator should name its next re-chase — or that it must not."""
    refs, err = parse_refs(chain_ref)
    if err or not refs:
        raise ValueError(f"cannot parse chain ref {chain_ref!r}: {err}")
    chain = refs[0]
    rec = st.get("chains", {}).get(chain) or {}
    count = int(rec.get("max_ordinal", 0))
    base = int(rec.get("base", 0))
    for t in live_tasks:
        if task_kind(t) != "rechase":
            continue
        trefs, terr = parse_refs(t.get("prompt") or "", t.get("series_id") or "")
        if terr or not trefs or trefs[0] != chain:
            continue
        sid = t.get("series_id") or ""
        k = st.get("ordinals", {}).get(sid) or declared_ordinal(sid, t.get("prompt") or "") or count + 1
        count = max(count, int(k))
    nxt = count + 1
    used = count - base
    repo, num = chain.split("#")
    short = repo.split("/", 1)[1]
    return {
        "chain": chain,
        "thread_id": chain_thread(chain),
        "count": used,
        "next_ordinal": nxt,
        "cap": cap,
        "allowed": used + 1 <= cap,
        "parked": chain in st.get("parked", {}),
        "name": f"rechase-{short}-{num}-r{nxt}",
        "prompt_prefix": f"Re-chase {chain_thread(chain)} (r{nxt}):",
    }


def render_report(parked: list[dict], now: dt.datetime, cap: int) -> str:
    lines = [f"# Parked chains — re-chase cap ({cap}) reached",
             "",
             (f"_Generated {iso(now)} by supervise-issues/scripts/task-hygiene.py. "
              "These chains stopped scheduling their own re-chase; a human decides: close, hand off, "
              "or `task-hygiene.py unpark <ref>` to allow another round._"),
             ""]
    if not parked:
        lines.append("None.")
    else:
        lines += ["| chain | re-chases | parked since | last re-chase |", "|---|---|---|---|"]
        for e in parked:
            head = (e.get("prompt_head") or "").replace("|", "\\|")
            lines.append(f"| `{e['thread_id']}` | {e.get('count')} | {e.get('parked_at')} | {head} |")
    return "\n".join(lines) + "\n"


# --- IO (ncl + gh) -----------------------------------------------------------------

def _ncl(args: list[str], timeout: float = 40) -> dict:
    out = subprocess.run(["ncl", *args, "--json"], capture_output=True, text=True, timeout=timeout, check=False)
    payload = json.loads(out.stdout or "{}")
    if payload.get("ok") is not True:
        raise RuntimeError(f"ncl {' '.join(args)}: {payload.get('error') or out.stderr.strip()[:200]}")
    return payload


class Io:
    def list_tasks(self) -> list[dict]:
        data = _ncl(["tasks", "list"]).get("data")
        if not isinstance(data, list):
            raise TypeError("ncl tasks list: no data list")
        return data

    def get_prompt(self, series_id: str) -> str:
        return (_ncl(["tasks", "get", "--id", series_id]).get("data") or {}).get("prompt") or ""

    def cancel(self, series_id: str) -> None:
        _ncl(["tasks", "cancel", "--id", series_id])

    def gh_states(self, refs: list[str]) -> dict[str, str | None]:
        out: dict[str, str | None] = {}
        refs = sorted(set(refs))
        for i in range(0, len(refs), GH_BATCH):
            batch = refs[i:i + GH_BATCH]
            parts = []
            for j, r in enumerate(batch):
                repo, num = r.split("#")
                owner, name = repo.split("/", 1)
                parts.append(f'q{j}: repository(owner:{json.dumps(owner)}, name:{json.dumps(name)}) '
                             f'{{ issueOrPullRequest(number:{int(num)}) {{ __typename '
                             f'... on Issue {{ state }} ... on PullRequest {{ state }} }} }}')
            res = subprocess.run(["gh", "api", "graphql", "-f", "query={" + " ".join(parts) + "}"],
                                 capture_output=True, text=True, timeout=40, check=False)
            try:
                data = (json.loads(res.stdout or "{}") or {}).get("data") or {}
            except ValueError:
                data = {}
            for j, r in enumerate(batch):
                node = ((data.get(f"q{j}") or {}).get("issueOrPullRequest")) or {}
                out[r] = node.get("state")
        return out


def hydrate_prompts(tasks: list[dict], st: dict, io: Io, deadline: float) -> tuple[list[dict], int]:
    """`ncl tasks list` truncates prompts at 120 chars; fetch full prompts for
    allow-listed tasks (cached by series id + listed prefix). Returns the tasks
    whose full prompt is known and the count deferred to the next fire."""
    cache = st.setdefault("prompts", {})
    live = {t.get("series_id") for t in tasks}
    for sid in list(cache):
        if sid not in live:
            del cache[sid]
    ready, deferred = [], 0
    for t in tasks:
        if task_kind(t) is None:
            continue
        sid = t["series_id"]
        listed = t.get("prompt") or ""
        if not listed.endswith("..."):
            ready.append(t)
            continue
        hit = cache.get(sid)
        if hit and hit.get("prefix") == listed:
            ready.append({**t, "prompt": hit["prompt"]})
            continue
        if time.monotonic() > deadline:
            deferred += 1
            continue
        try:
            full = io.get_prompt(sid)
        except Exception:  # noqa: BLE001 — a failed fetch defers, never guesses
            deferred += 1
            continue
        cache[sid] = {"prefix": listed, "prompt": full}
        ready.append({**t, "prompt": full})
    return ready, deferred


def run_once(io: Io, st: dict, now: dt.datetime, dry: bool = False, cap: int = MAX_RECHASES,
             budget_s: float = GATE_BUDGET_S) -> dict:
    deadline = time.monotonic() + budget_s
    tasks = io.list_tasks()
    ready, deferred = hydrate_prompts(tasks, st, io, deadline)
    refs: set[str] = set()
    for t in ready:
        r, err = parse_refs(t.get("prompt") or "", t["series_id"])
        if not err:
            refs.update(r)
    for e in st.get("parked", {}).values():
        refs.update(e.get("refs") or [])
    gh = io.gh_states(sorted(refs)) if refs else {}
    p = plan(ready, gh, st, now, cap)
    cancelled, errors = [], []
    if not dry:
        for c in p["cancel"]:
            try:
                io.cancel(c["series_id"])
                cancelled.append(c)
            except Exception as e:  # noqa: BLE001
                errors.append(f"cancel {c['series_id']}: {e}")
        if p["digest_due"]:
            st["last_digest_at"] = iso(now)
    return {**p, "cancelled": cancelled, "errors": errors, "deferred": deferred,
            "considered": len(ready)}


def write_outputs(result: dict, st: dict, now: dt.datetime, cap: int) -> None:
    save_state(st)
    d = os.path.dirname(STATE_PATH)
    rep = {"at": iso(now), "cap": cap,
           "cancelled": [{k: c[k] for k in ("series_id", "reason", "why")} for c in result["cancelled"]],
           "unresolved": [{k: u.get(k) for k in ("series_id", "reason", "prompt_head")} for u in result["unresolved"]],
           "kept": len(result["keep"]), "deferred": result["deferred"], "parked": len(result["parked"]),
           "errors": result["errors"]}
    with open(os.path.join(d, "last-run.json"), "w") as f:
        json.dump(rep, f, indent=1)
    with open(os.path.join(d, "history.log"), "a") as f:
        f.writelines(f"{iso(now)} cancel {c['series_id']} reason={c['reason']} ({c['why']})\n" for c in result["cancelled"])
        f.write(f"{iso(now)} run cancelled={len(result['cancelled'])} kept={len(result['keep'])} "
                f"unresolved={len(result['unresolved'])} deferred={result['deferred']} "
                f"parked={len(result['parked'])} errors={len(result['errors'])}\n")
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        f.write(render_report(result["parked"], now, cap))


def gate_json(result: dict) -> dict:
    wake = bool(result["errors"]) or result["digest_due"]
    return {"wakeAgent": wake, "data": {
        "cancelled": [f"{c['series_id']} ({c['reason']}: {c['why']})" for c in result["cancelled"]],
        "errors": result["errors"],
        "unresolved": len(result["unresolved"]),
        "deferred": result["deferred"],
        "digest_due": result["digest_due"],
        "digest": result["parked"] if result["digest_due"] else [],
        "report": REPORT_PATH,
    }}


def main(argv: list[str]) -> int:
    cap = MAX_RECHASES
    args = list(argv)
    if "--cap" in args:
        i = args.index("--cap")
        cap = int(args[i + 1])
        del args[i:i + 2]
    now = now_utc()
    if args and args[0] == "next":
        if len(args) < 2:
            print("usage: task-hygiene.py next <owner/repo#n | gh-issue-owner/repo-n>", file=sys.stderr)
            return 2
        with state_lock():
            st = load_state()
            try:
                live = Io().list_tasks()
            except Exception:  # noqa: BLE001 — state alone still bounds the count
                live = []
            res = next_rechase(args[1], st, live, cap)
            if not res["allowed"] and res["chain"] not in st["parked"]:
                refs, _ = parse_refs(args[1])
                st["parked"][res["chain"]] = {"parked_at": iso(now), "thread_id": res["thread_id"],
                                              "count": res["count"], "last_series": None,
                                              "prompt_head": "cap reached at scheduling time", "refs": refs}
                save_state(st)
                res["parked"] = True
        print(json.dumps(res))
        return 0 if res["allowed"] else 3
    if args and args[0] == "unpark":
        if len(args) < 2:
            print("usage: task-hygiene.py unpark <ref>", file=sys.stderr)
            return 2
        refs, err = parse_refs(args[1])
        if err or not refs:
            print(f"cannot parse {args[1]!r}: {err}", file=sys.stderr)
            return 2
        with state_lock():
            st = load_state()
            st["parked"].pop(refs[0], None)
            ch = st["chains"].setdefault(refs[0], {"max_ordinal": 0, "series": []})
            # Ordinals stay monotonic (names keep counting r4, r5, ...); the
            # allowance restarts here: another MAX_RECHASES re-chases.
            ch["base"] = int(ch.get("max_ordinal", 0))
            save_state(st)
        print(json.dumps({"unparked": refs[0]}))
        return 0

    dry = "--dry-run" in args
    unknown = [a for a in args if a not in ("--gate", "--dry-run")]
    if unknown:
        print(f"unknown argument(s): {unknown}", file=sys.stderr)
        return 2
    with state_lock():
        st = load_state()
        try:
            result = run_once(Io(), st, now, dry=dry, cap=cap)
        except Exception as e:  # noqa: BLE001 — a broken gate must not read as "clean"
            print(json.dumps({"wakeAgent": False, "data": {"error": str(e)[:300]}}))
            return 1
        if dry:
            print(json.dumps({k: result[k] for k in ("cancel", "unresolved", "parked", "digest_due", "deferred")},
                             indent=1))
            return 0
        write_outputs(result, st, now, cap)
    print(json.dumps(gate_json(result)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
