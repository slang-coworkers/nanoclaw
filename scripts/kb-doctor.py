#!/usr/bin/env python3
"""kb-doctor — reconcile what git says against what production actually runs.

The KB has four propagation paths and three of them have no automatic link:

  SKILL.md  --materialise-->  data/shared/.learnings_wiki.py     (manual)
  SKILL.md  --group-init--->  data/v2-sessions/*/.claude-shared  (on restart/spawn only)
  git       --???---------->  live scheduled-task prompts        (NO link at all)
  nv-main   --merge-------->  nv-coworkers (prod branch)         (manual)

Every drift found on 2026-08-04/05 was SILENT — the source files looked correct while
production behaved differently. The materialised builder had a prod-only footer
normalizer that a blind deploy would have reverted; the fold objective lived only in a
SQLite row; the skill's schedule_task template would have recreated that task weekly with
none of its objective. None of it announced itself.

So this REPORTS drift, it does not repair it. Silently rewriting live agent instructions
to match git is the same class of failure in the other direction — git is not always the
newer truth, as the footer normalizer proved.

THREE STATES, NOT TWO. A check that could not RUN is not a check that PASSED. Every
"SKIP" used to exit 0, so a missing dependency, an unfetched remote, or an `ncl` auth
failure all rendered as a clean bill of health — the exact failure this script exists to
catch, reproduced in the detector itself. OK / DRIFT / UNKNOWN are now distinct, they
carry the underlying error text, and UNKNOWN exits nonzero.

Offline and deterministic: no network, no API, no LLM.

  python3 scripts/kb-doctor.py [--repo <path>] [--quiet] [--artifact <path>|--no-artifact]

Exit codes: 0 = clean (every check ran, no drift), 1 = drift found, 2 = a check could
not run (indeterminate). DRIFT outranks UNKNOWN, because drift is actionable now; the
artifact reports both regardless.
"""
import argparse, datetime, glob, hashlib, importlib.util, json, os, re, subprocess, sys, tempfile

SCHEMA = 1
OK, DRIFT, UNKNOWN = "OK", "DRIFT", "UNKNOWN"

# Fallback if dump-scheduled-tasks.py cannot be imported. Kept in sync by IMPORTING it
# below rather than by copying — see volatile_fields().
VOLATILE_FALLBACK = {"row_id", "process_after", "tries", "completed_runs", "failed_runs",
                     "recent_log", "status", "created_at", "origin_session_id", "id", "ok"}


def sha(text):
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()[:16]


class Report:
    """Collects findings. Nothing is allowed to fail silently: a check that cannot run
    must register an UNKNOWN with its provenance, never nothing at all."""

    def __init__(self):
        self.findings = []

    def add(self, state, check, message, reason=None):
        self.findings.append({"state": state, "check": check, "message": message, "reason": reason})

    def ok(self, check, message):
        self.add(OK, check, message)

    def drift(self, check, message):
        self.add(DRIFT, check, message)

    def unknown(self, check, message, reason):
        self.add(UNKNOWN, check, message, reason)

    def of(self, state):
        return [f for f in self.findings if f["state"] == state]


def read_text(path):
    """(text, error). Never raises — an unreadable file is data, not a crash."""
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read(), None
    except OSError as e:
        return None, f"{type(e).__name__}: {e}"


def embedded_builder(skill_path):
    """The python block inside SKILL.md — the source of truth for the materialised script."""
    s, err = read_text(skill_path)
    if s is None:
        return None, err
    blocks = re.findall(r"```python\n(.*?)```", s, re.S)
    if not blocks:
        return None, "SKILL.md contains no ```python block"
    return max(blocks, key=len), None


def check_builder(repo, rep):
    skill = os.path.join(repo, "container/skills/learnings-wiki/SKILL.md")
    live = os.path.join(repo, "data/shared/.learnings_wiki.py")
    emb, err = embedded_builder(skill)
    if emb is None:
        rep.unknown("builder", f"cannot read embedded builder from {skill}: {err}", "missing-input")
        return
    cur, err = read_text(live)
    if cur is None:
        # NOT clean: we cannot tell "never materialised here" from "deleted in prod".
        rep.unknown("builder", f"materialised builder unreadable at {live}: {err}", "missing-input")
        return
    if sha(emb) == sha(cur):
        rep.ok("builder", "materialised == SKILL.md")
    else:
        rep.drift("builder",
                  f"data/shared/.learnings_wiki.py ({len(cur)} B, {sha(cur)}) != "
                  f"SKILL.md embedded ({len(emb)} B, {sha(emb)}). "
                  "Diff before overwriting — prod may hold a fix git does not.")


def check_group_skills(repo, rep):
    src = os.path.join(repo, "container/skills/learnings-wiki/SKILL.md")
    text, err = read_text(src)
    if text is None:
        # Used to `return` with no finding at all — the check vanished from the report.
        rep.unknown("group-skills", f"cannot read {src}: {err}", "missing-input")
        return
    want = sha(text)
    copies = glob.glob(os.path.join(repo, "data/v2-sessions/*/.claude-shared/skills/learnings-wiki/SKILL.md"))
    if not copies:
        rep.unknown("group-skills", "no .claude-shared copies found — no groups initialised, "
                                    "or the mirror path changed", "missing-input")
        return
    stale, unreadable = [], []
    for p in copies:
        t, e = read_text(p)
        if t is None:
            unreadable.append(f"{p} ({e})")
        elif sha(t) != want:
            stale.append(p)
    if unreadable:
        rep.unknown("group-skills", f"{len(unreadable)}/{len(copies)} copies unreadable: "
                                    f"{'; '.join(unreadable[:3])}", "unreadable")
    if stale:
        rep.drift("group-skills",
                  f"{len(stale)}/{len(copies)} group copies stale vs checkout — "
                  "they are mirrored into the bind mount, so a re-copy refreshes them live")
    elif not unreadable:
        rep.ok("group-skills", f"all {len(copies)} copies match checkout")


def volatile_fields():
    """The snapshot's own exclusion list, IMPORTED from dump-scheduled-tasks.py.

    Returns `(fields, error)`. **The error is the point.** Copying this list would let
    the doctor's comparison drift from what the dumper actually writes — a
    reconciliation tool disagreeing with its own source of truth — so when the import
    fails the caller has to say so rather than quietly compare under a different schema.

    This used to swallow every exception and return the in-file fallback with no
    signal at all. A field the dumper had *stopped* excluding would then be ignored by
    the stale copy, the comparison would find no difference, and the doctor would
    report a clean result it had no basis for — the precise "unknown is treated as
    clean" failure this tool exists to refuse. See check_tasks for what the caller now
    does with the error.

    That module guards main() behind __name__, so importing it runs only constants
    and defs.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dump-scheduled-tasks.py")
    try:
        spec = importlib.util.spec_from_file_location("dump_scheduled_tasks", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return set(mod.VOLATILE), None
    except Exception as e:
        return set(VOLATILE_FALLBACK), f"{type(e).__name__}: {e}"


# `ncl` exits nonzero for BOTH "no such task" and "the socket is down / you are not
# allowed / pnpm is missing". Treating every nonzero as "task missing" reported a
# transport outage as committed-task-deleted drift.
NOT_FOUND = re.compile(r"not found|no such|does not exist", re.I)


def ncl_task(repo, sid):
    """(definition, kind, detail). kind: 'ok' | 'missing' | 'unknown'.

    'missing' is concluded ONLY from a structured ncl envelope. A nonzero exit with no
    parseable envelope is a transport/environment failure and stays UNKNOWN — matching
    free text for "not found" is a trap this very check fell into: `bin/ncl` exits 127
    with `exec: pnpm: not found` when the toolchain is absent, so a broken PATH was
    reported as 13 deleted scheduled tasks. Absence has to be ASSERTED by the
    application layer, never inferred from a failed process.
    """
    ncl = os.path.join(repo, "bin", "ncl")
    try:
        r = subprocess.run([ncl, "tasks", "get", "--id", sid, "--json"],
                           cwd=repo, capture_output=True, text=True, timeout=60)
    except Exception as e:
        return None, "unknown", f"{type(e).__name__}: {e}"
    try:
        payload = json.loads(r.stdout)
    except Exception:
        payload = None
    if isinstance(payload, dict) and payload.get("ok") is False:
        err = payload.get("error") or {}
        msg = f"{err.get('code', '?')}: {err.get('message', '')}"
        # 'forbidden' is an AUTH problem, never evidence that the task is gone.
        if err.get("code") == "handler-error" and NOT_FOUND.search(str(err.get("message", ""))):
            return None, "missing", msg
        return None, "unknown", msg
    if r.returncode != 0:
        blob = (r.stderr or r.stdout or "").strip()
        return None, "unknown", (blob.splitlines()[0] if blob else f"exit {r.returncode}")
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"], "ok", None
    return None, "unknown", "unparseable ncl response"


def check_tasks(repo, rep):
    snaps = sorted(glob.glob(os.path.join(repo, "docs/scheduled-tasks.*.json")))
    if not snaps:
        rep.unknown("tasks", "no docs/scheduled-tasks.*.json snapshot to compare against", "missing-input")
        return
    snap = snaps[0]
    try:
        with open(snap, encoding="utf-8") as fh:
            committed = {t["series_id"]: t for t in json.load(fh)["tasks"]}
    except Exception as e:
        rep.unknown("tasks", f"unreadable snapshot {snap}: {type(e).__name__}: {e}", "unreadable")
        return
    ncl = os.path.join(repo, "bin", "ncl")
    if not os.path.exists(ncl):
        rep.unknown("tasks", f"{ncl} not present — cannot read live task definitions", "missing-input")
        return

    # The exclusion set decides what "identical" means, so a doubt about IT is a doubt
    # about every comparison below. Two distinct problems, reported separately:
    #
    #   import failed  -> we are comparing under a copy that nothing keeps in sync.
    #                     Real differences are still worth surfacing, but a CLEAN
    #                     result from this run certifies nothing, so it is degraded to
    #                     UNKNOWN at the bottom rather than reported as OK.
    #   import worked   -> then the in-file fallback is dead weight that only matters
    #     but differs   the next time an import fails. If it has drifted from the
    #                     authoritative set it is a false-clean waiting to happen, and
    #                     that is drift between two copies in one repo: actionable now.
    volatile, volatile_err = volatile_fields()
    degraded = volatile_err is not None
    if degraded:
        rep.unknown("tasks-volatile-set",
                    f"could not import the dumper's exclusion set ({volatile_err}) — comparing "
                    f"under the in-file fallback, which nothing keeps in sync",
                    "volatile-import")
    elif volatile != set(VOLATILE_FALLBACK):
        only_live = ", ".join(sorted(volatile - set(VOLATILE_FALLBACK))) or "-"
        only_copy = ", ".join(sorted(set(VOLATILE_FALLBACK) - volatile)) or "-"
        rep.drift("tasks-volatile-set",
                  f"VOLATILE_FALLBACK in {os.path.basename(__file__)} has drifted from the "
                  f"dumper's VOLATILE (only in dumper: {only_live}; only in fallback: {only_copy}). "
                  "The fallback is what a failed import compares under, so update it.")

    drift, missing, unknown = [], [], []
    for sid, want in sorted(committed.items()):
        live, kind, detail = ncl_task(repo, sid)
        if kind == "missing":
            missing.append(sid)
            continue
        if kind == "unknown":
            unknown.append(f"{sid} ({detail})")
            continue
        # Compare the FULL definition, not just the prompt. A task whose schedule,
        # agent group or enabled flag was changed live drifts just as dangerously as one
        # whose text changed, and prompt-only comparison called that a match.
        want_cmp = {k: v for k, v in want.items() if k not in volatile}
        live_cmp = {k: v for k, v in live.items() if k not in volatile and k in want_cmp}
        differing = sorted(k for k in want_cmp if want_cmp[k] != live_cmp.get(k))
        if differing:
            drift.append(f"{sid} [{', '.join(differing)}]")

    if unknown:
        rep.unknown("tasks", f"{len(unknown)} task(s) could not be read: {'; '.join(unknown[:4])}",
                    "ncl-transport")
    if missing:
        rep.drift("tasks", f"{len(missing)} committed task(s) not live: {', '.join(missing[:4])}")
    if drift:
        rep.drift("tasks", f"{len(drift)} live definition(s) differ from the snapshot: "
                           f"{', '.join(drift[:4])}. "
                           "Re-run scripts/dump-scheduled-tasks.py if the live value is intended.")
    if not missing and not drift and not unknown:
        if degraded:
            # Everything matched — under an exclusion set we could not verify. Saying OK
            # here is the false clean: the run genuinely cannot distinguish "no drift"
            # from "the field that drifted is one the stale copy still excludes".
            rep.unknown("tasks",
                        f"{len(committed)} definition(s) compared equal, but under the fallback "
                        "exclusion set — a clean result cannot be trusted until the dumper "
                        "imports again",
                        "volatile-import")
        else:
            rep.ok("tasks", f"all {len(committed)} live definitions match the snapshot")


def check_branch(repo, rep):
    def git(*a):
        try:
            r = subprocess.run(["git", *a], cwd=repo, capture_output=True, text=True, timeout=60)
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"
        if r.returncode != 0:
            return None, (r.stderr or r.stdout or f"exit {r.returncode}").strip().splitlines()[0]
        return r.stdout.strip(), None

    cur, err = git("rev-parse", "--abbrev-ref", "HEAD")
    if cur is None:
        # Used to `return` silently, so "this isn't a git repo" read as a passing check.
        rep.unknown("branch", f"cannot resolve HEAD in {repo}: {err}", "check-errored")
        return
    KB = ["container/skills/learnings-wiki", "container/spines/base",
          "container/workflows", "scripts/kb-health.py", "scripts/kb-doctor.py"]
    behind, err = git("log", "--oneline", "HEAD..origin/nv-main", "--", *KB)
    if behind is None:
        rep.unknown("branch", f"cannot compare against origin/nv-main (not fetched?): {err}",
                    "missing-input")
    elif behind:
        rep.drift("branch", f"{cur} is behind origin/nv-main by "
                            f"{len(behind.splitlines())} commit(s) on KB paths")
    else:
        rep.ok("branch", f"{cur} current with origin/nv-main on KB paths")


def write_artifact(path, doc):
    """Atomic replace, creating the directory.

    The dashboard reads this file every request. A half-written document would parse as
    corrupt exactly when someone is looking at it, so temp+fsync+rename, never in place.
    """
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".kb-doctor.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.expanduser("~/slang-coworkers-prod/nanoclaw"))
    ap.add_argument("--quiet", action="store_true", help="print only drift/unknown plus the summary")
    ap.add_argument("--artifact", default=None,
                    help="structured JSON output (default <repo>/data/shared/.kb-doctor.json)")
    ap.add_argument("--no-artifact", action="store_true", help="skip writing the JSON artifact")
    args = ap.parse_args()

    rep = Report()
    for name, fn in (("builder", check_builder), ("group-skills", check_group_skills),
                     ("tasks", check_tasks), ("branch", check_branch)):
        try:
            fn(args.repo, rep)
        except Exception as e:
            rep.unknown(name, f"check raised {type(e).__name__}: {e}", "check-errored")

    drift, unknown = rep.of(DRIFT), rep.of(UNKNOWN)
    status = DRIFT.lower() if drift else (UNKNOWN.lower() if unknown else "clean")
    code = 1 if drift else (2 if unknown else 0)

    doc = {
        "schema": SCHEMA,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "repo": os.path.abspath(args.repo),
        "status": status,
        # False = at least one check could not run. A consumer must not read the absence
        # of drift as health when this is false.
        "complete": not unknown,
        "exitCode": code,
        "counts": {"ok": len(rep.of(OK)), "drift": len(drift), "unknown": len(unknown)},
        "findings": rep.findings,
        "drift": [f"{f['check']}: {f['message']}" for f in drift],
        "unknown": [f"{f['check']}: {f['message']}" for f in unknown],
    }

    artifact = args.artifact or os.path.join(args.repo, "data", "shared", ".kb-doctor.json")
    if not args.no_artifact:
        try:
            write_artifact(artifact, doc)
        except Exception as e:
            # The artifact IS the dashboard's only view. Failing to write it must not be
            # silent, and must not let an otherwise-clean run report success.
            print(f"ERROR: could not write {artifact}: {type(e).__name__}: {e}", file=sys.stderr)
            code = max(code, 2)

    for f in rep.findings:
        if args.quiet and f["state"] == OK:
            continue
        print(f"{f['state']:<8}{f['check']:<14}{f['message']}")

    # ALWAYS print a summary, including under --quiet on a clean run. `--quiet` used to
    # emit zero bytes when everything passed, which is indistinguishable from the script
    # having died before producing output.
    print(f"kb-doctor: {status.upper()} — {len(rep.of(OK))} ok, {len(drift)} drift, "
          f"{len(unknown)} unknown (exit {code})")
    if drift:
        print("Reported, not repaired — inspect before syncing either direction; "
              "production is sometimes the newer truth.")
    if unknown:
        print("UNKNOWN means the check could not run. That is not a pass — fix the cause "
              "or this tool is blind to that path.")
    return code


if __name__ == "__main__":
    sys.exit(main())
