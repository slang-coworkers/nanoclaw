#!/usr/bin/env python3
"""eval_run.py — dispatch a bank of evaluation tasks to an eval coworker group and score them.

Evaluation copies of the production coworkers (groups such as `eval-slang-triage` and
`eval-slang-fixer`, carrying the `eval-sandbox` overlay) run test tasks against the
`slang-coworkers/slang-eval` fork. This runner is what the driver group
(`eval-compliance`, cli_scope global) executes: it reads the task bank
(slang-coworkers/slang-eval-tasks, Harbor task format), hands each task to the eval
group as independent one-shot NanoClaw tasks, waits for the results, scores them, keeps
the spend under a cap, and writes a job report that `nanoclaw-metrics.py` re-emits as
`nanoclaw_evals`.

  python3 eval_run.py --bank /path/to/slang-eval-tasks --kind triage --group eval-slang-triage \\
                      --limit 60 --variant baseline [--repeats 3] [--budget-usd 300] [--concurrency 2]
  python3 eval_run.py ... --compare <baseline-job-id>     # paired per-task comparison with a bootstrap CI
  python3 eval_run.py ... --retry-from <job-id>           # re-run that job's timeouts/errors once

The models are probabilistic, so one trajectory is never compared to one trajectory:
every task runs `--repeats` times (default 3 for triage, 2 for fixer) as independent
one-shot tasks with distinct trial ids `<task-id>#r<k>`. Each repeat gets a fresh
session and its own answer directory `eval/<task-id>/r<k>/`, so an eval copy never sees
an earlier attempt. The budget cap counts every repeat.

Task selection: `MANIFEST.json` at the bank root (rows with task_id, kind, path,
base_commit, issue, repo, size) is the source of truth; a bank without a manifest is
walked for `instruction.md` + `task.toml` directories. `[metadata]` in task.toml is the
hidden answer key: it is copied into the trial config and never into the prompt.

How a trial runs:
  dispatch   `ncl tasks create --group <eval group> --name eval-<kind>-<task-id>-r<k>
              --process-after <now, ISO 8601 UTC> --prompt <instruction + output contract> --json`
             (the in-container CLI bridge; `--process-after` takes a timestamp, never a
             relative word). The reply's `data.session_id` is the eval session.
  wait       triage: `<prod-groups>/<eval folder>/eval/<task-id>/r<k>/answer.json` appears
             on the read-only mount of the eval group's directory. fixer: a PR on the
             fork whose head branch carries `<task-id>-r<k>` (or whose title carries
             `[<task-id>#r<k>]`), via `gh api` GET. Per-task timeout from task.toml
             `[agent] timeout_sec` (default 1800).
  score      triage: `tests/test.sh` with AGENT_OUTPUT=<answer.json> and REWARD_DIR set to
             the trial's verifier directory; the bank's verifiers write
             `$REWARD_DIR/reward.txt` in [0,1] and exit 0. fixer: the bank's verifier
             needs a Slang Release build, so the fork's CI is the verifier here: the
             check runs for the PR head (`gh api` GET); all green → 1, any red → 0,
             none → unknown. The Slang build-and-test runs on the fork's CI, not in this
             container.
  budget     `ncl cost-cap status --session <id> --json` gives `spent_usd` per eval
             session when the caller may run the cost-cap CLI; a session without a cost
             row counts at `--fallback-cost-usd`. Dispatch stops when known + estimated
             spend would pass `--budget-usd`.

Per task the report carries mean reward, pass@k (k = repeats), min and max over the
repeats, and a `low-signal` flag when the repeats disagree. `--compare` pairs each task
with the baseline job (mean over repeats on both sides), reports the mean paired
difference with a seeded bootstrap 95% interval over tasks, and marks the comparison
`smoke-signal` when fewer than 30 tasks of that kind were paired.

Frozen into job.json: the exact model id of the eval group (from `ncl groups config get`
and the forwarded ANTHROPIC_* model env; an alias that cannot be resolved is recorded as
unresolved, never passed off as an id), the group's provider settings, the skills pin
(the `github-ref` / `github-tree-sha` stamps of every installed skill) and each task's
base commit from the manifest.

Outputs under `<reports>/evals/` (default /workspace/agent/reports/evals/):
  <job-id>/job.json, trials.jsonl, scorecard.html, config.json, result.json,
  <job-id>/trials/<task>#r<k>__<hex>/{config.json,result.json,verifier/reward.txt}  (Harbor-style)
  latest.json  — the summary nanoclaw-metrics.py reads.

Exit codes: 0 every trial scored, 1 some trial timed out / errored / is unknown, 2 the
job stopped early (budget) or no task could be dispatched.

Python 3.9+, standard library only; `tomllib` when present, else a small TOML subset
parser. Every external effect (ncl, gh, test.sh, clock, sleep) is injectable so the
tests run on fakes.
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import html
import json
import math
import os
import random
import re
import statistics
import subprocess
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Callable

SCHEMA = 2
DEFAULT_FORK = "slang-coworkers/slang-eval"
DEFAULT_CI_CHECK = "eval-ci"
DEFAULT_REPORTS = "/workspace/agent/reports"
DEFAULT_PROD_GROUPS = "/workspace/extra/ephemeral/prod-groups"
DEFAULT_SKILLS_DIRS = ("/home/node/.claude/skills", "/app/skills")
DEFAULT_AGENT_TIMEOUT_SEC = 1800
DEFAULT_VERIFIER_TIMEOUT_SEC = 300
# How long after the PR appears the runner waits for the fork's CI to report at least
# one check run before calling the trial unknown.
DEFAULT_CI_GRACE_SEC = 900
FALLBACK_COST_USD = {"triage": 1.5, "fixer": 20.0, "reply": 1.5}
DEFAULT_REPEATS = {"triage": 3, "fixer": 2, "reply": 3}
# Kinds whose deliverable is an answer.json on the eval group mount, scored by the bank's verifier.
FILE_KINDS = ("triage", "reply")
MAX_ATTEMPTS = 2
# Below this many paired tasks a comparison is a smoke signal, not a result.
SMOKE_SIGNAL_TASKS = 30
BOOTSTRAP_SAMPLES = 2000
BOOTSTRAP_SEED = 20261016
MODEL_ALIASES = {"opus": "ANTHROPIC_DEFAULT_OPUS_MODEL", "sonnet": "ANTHROPIC_DEFAULT_SONNET_MODEL",
                 "haiku": "ANTHROPIC_DEFAULT_HAIKU_MODEL"}

PENDING, RUNNING, SCORED, TIMEOUT, ERROR, UNKNOWN, SKIPPED = (
    "pending", "running", "scored", "timeout", "error", "unknown", "skipped")


# --------------------------------------------------------------------------- TOML


def parse_toml(text: str) -> dict:
    """task.toml as a dict. Uses tomllib on 3.11+; otherwise a parser for the subset
    Harbor tasks use (tables, strings, numbers, booleans, flat arrays)."""
    try:
        import tomllib
        return tomllib.loads(text)
    except ImportError:
        pass
    doc: dict = {}
    table = doc
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip() if not raw.strip().startswith(("'", '"')) else raw.strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            table = doc
            for part in line[1:-1].strip().split("."):
                table = table.setdefault(part.strip().strip('"'), {})
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        table[key.strip().strip('"')] = _toml_value(value.strip())
    return doc


def _toml_value(v: str):
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        return [_toml_value(x.strip()) for x in _split_toml_array(inner)] if inner else []
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    if v in ("true", "false"):
        return v == "true"
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        return v


def _split_toml_array(inner: str) -> list[str]:
    parts, buf, quote = [], "", ""
    for ch in inner:
        if quote:
            buf += ch
            if ch == quote:
                quote = ""
        elif ch in "\"'":
            quote = ch
            buf += ch
        elif ch == ",":
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    if buf.strip():
        parts.append(buf)
    return parts


# --------------------------------------------------------------------------- tasks


@dataclass
class Task:
    id: str
    dir: str
    kind: str
    instruction: str
    metadata: dict
    agent_timeout_sec: int
    verifier_timeout_sec: int
    base_commit: str | None = None
    manifest: dict = field(default_factory=dict)

    @property
    def test_script(self) -> str:
        return os.path.join(self.dir, "tests", "test.sh")


def task_kind(toml: dict, path: str) -> str:
    meta = toml.get("metadata") or {}
    for key in ("kind", "category"):
        v = str(meta.get(key) or "").lower()
        if v in ("triage", "fixer", "reply"):
            return v
    tags = [str(t).lower() for t in (meta.get("tags") or [])]
    for k in ("triage", "fixer", "reply"):
        if k in tags:
            return k
    parts = [p.lower() for p in path.split(os.sep)]
    for k in ("triage", "fixer", "reply"):
        if k in parts:
            return k
    return "unknown"


def _read_task_dir(root: str, kind_hint: str | None = None, manifest_row: dict | None = None) -> Task | None:
    toml_path = os.path.join(root, "task.toml")
    instr_path = os.path.join(root, "instruction.md")
    if not (os.path.isfile(toml_path) and os.path.isfile(instr_path)):
        return None
    with open(toml_path, encoding="utf-8") as fh:
        toml = parse_toml(fh.read())
    kind = kind_hint or task_kind(toml, root)
    with open(instr_path, encoding="utf-8") as fh:
        instruction = fh.read().strip()
    agent = toml.get("agent") or {}
    verifier = toml.get("verifier") or {}
    row = manifest_row or {}
    meta = dict(toml.get("metadata") or {})
    return Task(
        id=str(row.get("task_id") or os.path.basename(root)), dir=root, kind=kind, instruction=instruction,
        metadata=meta,
        agent_timeout_sec=int(float(agent.get("timeout_sec") or DEFAULT_AGENT_TIMEOUT_SEC)),
        verifier_timeout_sec=int(float(verifier.get("timeout_sec") or DEFAULT_VERIFIER_TIMEOUT_SEC)),
        base_commit=row.get("base_commit") or meta.get("source_snapshot") or meta.get("base_commit"),
        manifest=row,
    )


def load_bank(bank: str, kind: str, log: Callable[[str], None] = lambda s: None) -> list[Task]:
    """Tasks of `kind` from the bank, in manifest order when `MANIFEST.json` exists (the
    bank's own list of what is complete), else every task directory sorted by id. A
    manifest row whose directory is missing is reported and skipped, never guessed."""
    manifest_path = os.path.join(bank, "MANIFEST.json")
    tasks: list[Task] = []
    if os.path.isfile(manifest_path):
        with open(manifest_path, encoding="utf-8") as fh:
            rows = json.load(fh)
        if isinstance(rows, dict):
            rows = rows.get("tasks") or []
        for row in rows:
            if str(row.get("kind") or "").lower() != kind:
                continue
            task = _read_task_dir(os.path.join(bank, row.get("path") or ""), kind, row)
            if task is None:
                log(f"manifest row {row.get('task_id')} points at {row.get('path')}, which has no task; skipped")
                continue
            tasks.append(task)
        return tasks
    for root, dirs, files in os.walk(bank):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        if "instruction.md" in files and "task.toml" in files:
            task = _read_task_dir(root)
            if task and task.kind == kind:
                tasks.append(task)
    tasks.sort(key=lambda t: t.id)
    return tasks


def trial_id(task_id: str, repeat: int) -> str:
    return f"{task_id}#r{repeat}"


def answer_dir(group_dir: str, task_id: str, repeat: int) -> str:
    return os.path.join(group_dir, "eval", task_id, f"r{repeat}")


def build_prompt(task: Task, repeat: int, fork: str) -> str:
    """The task prompt: the instruction text plus the output contract the scorer reads.
    `[metadata]` is never included; it is the hidden part of the task. Each repeat
    names its own answer directory and branch tag so attempts stay independent."""
    tid = trial_id(task.id, repeat)
    path = f"/workspace/agent/eval/{task.id}/r{repeat}/answer.json"
    if task.kind == "reply":
        contract = (
            f"Evaluation trial id: {tid}.\n"
            f"You are an evaluation copy. Write your reply to {path} as one JSON object with exactly one key "
            f"\"reply\" whose value is the Markdown text you would post. The file is the deliverable; do not "
            f"comment on, label or edit any GitHub issue, and do not message anyone. If you cannot answer, "
            f"write {{\"error\": \"<why>\"}} to the same path."
        )
    elif task.kind == "triage":
        contract = (
            f"Evaluation trial id: {tid}.\n"
            f"You are an evaluation copy. Write your triage answer to {path} as one JSON object with exactly the "
            f"keys \"subsystem\" (string), \"severity\" (string), \"next_step\" (string) and \"labels\" (list of "
            f"strings). The file is the deliverable; do not comment on, label or edit any GitHub issue, and do "
            f"not message anyone. If you cannot answer, write {{\"error\": \"<why>\"}} to the same path."
        )
    else:
        contract = (
            f"Evaluation trial id: {tid}.\n"
            f"You are an evaluation copy. Work only in the fork {fork}: clone it, create a branch whose name "
            f"contains \"{task.id}-r{repeat}\", push it to the fork and open a DRAFT pull request on {fork} whose "
            f"title starts with \"[{tid}]\". The fork's CI is the verifier. Never push to or open anything on "
            f"shader-slang/* and do not message anyone. If you cannot finish, write {path} with "
            f"{{\"error\": \"<why>\"}}."
        )
    return f"{task.instruction}\n\n---\n{contract}"


# --------------------------------------------------------------------------- effects


Runner = Callable[..., "subprocess.CompletedProcess[str]"]


def default_run(argv: list[str], timeout: int | None = None, **kw) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False, **kw)


def ncl_json(run: Runner, argv: list[str], timeout: int = 60) -> dict:
    """Run an `ncl ... --json` command and return its `data`. The bridge answers
    `{id, ok, data}`; anything else is an error with the CLI's text attached."""
    r = run(["ncl", *argv, "--json"], timeout=timeout)
    try:
        payload = json.loads(r.stdout or "{}")
    except ValueError:
        payload = {}
    if r.returncode != 0 or payload.get("ok") is not True:
        detail = (payload.get("error") if isinstance(payload, dict) else None) or (r.stderr or r.stdout or "").strip()
        raise RuntimeError(f"ncl {' '.join(argv[:2])} failed (exit {r.returncode}): {str(detail)[:400]}")
    return payload.get("data") if isinstance(payload.get("data"), dict) else {"data": payload.get("data")}


@dataclass
class Dispatched:
    session_id: str
    series_id: str
    raw: dict = field(default_factory=dict)


class NclDispatcher:
    """Creates one one-shot NanoClaw task per trial on the eval group through the
    in-container CLI bridge. The caller must have `cli_scope: global` because the task
    is created on another group (`--group`), which the group-scoped guard refuses."""

    def __init__(self, group: str, run: Runner = default_run, now: Callable[[], dt.datetime] | None = None):
        self.group = group
        self.run = run
        self.now = now or (lambda: dt.datetime.now(dt.timezone.utc))

    def command(self, task: Task, repeat: int, prompt: str) -> list[str]:
        when = self.now().astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        return ["tasks", "create", "--group", self.group, "--name", f"eval-{task.kind}-{task.id}-r{repeat}",
                "--process-after", when, "--prompt", prompt]

    def dispatch(self, task: Task, repeat: int, prompt: str) -> Dispatched:
        data = ncl_json(self.run, self.command(task, repeat, prompt))
        return Dispatched(session_id=str(data.get("session_id") or ""),
                          series_id=str(data.get("series_id") or data.get("row_id") or ""), raw=data)


class NclCostReader:
    """`spent_usd` of an eval session from `ncl cost-cap status --session <id>`; None when
    the session has no cost row yet or the command is unavailable to this caller."""

    def __init__(self, run: Runner = default_run):
        self.run = run
        self.available: bool | None = None

    def __call__(self, session_id: str) -> float | None:
        if not session_id or self.available is False:
            return None
        try:
            data = ncl_json(self.run, ["cost-cap", "status", "--session", session_id], timeout=30)
        except RuntimeError as exc:
            # A guard denial ("scoped to this agent group", "not permitted") means the
            # command will never work for this caller; stop asking.
            if re.search(r"scope|permitted|denied|unknown (command|resource)", str(exc), re.IGNORECASE):
                self.available = False
            return None
        self.available = True
        v = data.get("spent_usd")
        return float(v) if isinstance(v, (int, float)) else None


class GhGet:
    """`gh api` GET only. The verb is pinned here so the scorer cannot write by accident."""

    def __init__(self, run: Runner = default_run):
        self.run = run

    def __call__(self, path: str):
        r = self.run(["gh", "api", "--method", "GET", path], timeout=60)
        if r.returncode != 0:
            raise RuntimeError(f"gh api GET {path} failed: {(r.stderr or r.stdout).strip()[:300]}")
        return json.loads(r.stdout or "null")


# --------------------------------------------------------------------------- freeze


def resolve_model(configured: str | None, env: dict) -> dict:
    """The exact model id the eval group runs, or an honest `unresolved`. The group's
    container config may hold an alias (`opus`) or nothing (then the forwarded
    ANTHROPIC_MODEL decides); aliases map through the ANTHROPIC_DEFAULT_*_MODEL env the
    host forwards into every container. An id must carry a version-looking token
    (a digit); a bare family name is an alias and is never reported as an id."""
    source = "container_configs.model"
    name = (configured or "").strip()
    if not name:
        name = (env.get("ANTHROPIC_MODEL") or "").strip()
        source = "ANTHROPIC_MODEL"
    alias = None
    if name.lower() in MODEL_ALIASES:
        alias = name
        name = (env.get(MODEL_ALIASES[name.lower()]) or "").strip()
        source = MODEL_ALIASES[alias.lower()]
    if name and re.search(r"\d", name):
        return {"model_id": name, "source": source, "alias": alias}
    return {"model_id": None, "source": source, "alias": alias or (name or None),
            "note": "unresolved: no exact model id in the group config or the forwarded model env"}


def freeze_group(group: str, run: Runner = default_run, env: dict | None = None) -> dict:
    """Provider settings of the eval group from `ncl groups config get`, plus the
    resolved model. A denied or failing call is recorded as such, not skipped."""
    env = os.environ if env is None else env
    try:
        cfg = ncl_json(run, ["groups", "config", "get", "--id", group], timeout=30)
    except RuntimeError as exc:
        return {"group": group, "error": str(exc), "model": resolve_model(None, env)}
    return {
        "group": group,
        "agent_provider": cfg.get("agent_provider"),
        "provider": cfg.get("provider"),
        "configured_model": cfg.get("model"),
        "effective_model": cfg.get("effective_model"),
        "effort": cfg.get("effort"),
        "speed": cfg.get("speed"),
        "image_tag": cfg.get("image_tag"),
        "cli_scope": cfg.get("cli_scope"),
        "skills": cfg.get("skills"),
        "model": resolve_model(cfg.get("effective_model") or cfg.get("model"), env),
    }


def freeze_skills(dirs: tuple[str, ...] = DEFAULT_SKILLS_DIRS) -> dict:
    """The skills pin: for every installed skill, the `github-ref` and `github-tree-sha`
    stamps fetch-skills.sh writes into SKILL.md (repo-local skills carry none and are
    listed with sha null)."""
    out: dict = {}
    for base in dirs:
        for path in sorted(glob.glob(os.path.join(base, "*", "SKILL.md"))):
            name = os.path.basename(os.path.dirname(path))
            if name in out:
                continue
            try:
                with open(path, encoding="utf-8") as fh:
                    head = fh.read(4000)
            except OSError:
                continue
            ref = re.search(r"github-ref:\s*(\S+)", head)
            sha = re.search(r"github-tree-sha:\s*(\S+)", head)
            out[name] = {"ref": ref.group(1) if ref else None, "tree_sha": sha.group(1) if sha else None,
                         "path": path}
    return out


# --------------------------------------------------------------------------- pollers


def poll_triage(group_dir: str, task: Task, repeat: int, not_before: float = 0.0) -> dict | None:
    """The agent's answer.json for this repeat once it exists and parses; None while it
    is absent. A file that is not JSON yet (being written) counts as absent, and so does
    a file last written before `not_before` (the trial's dispatch time): the answer path
    depends only on task and repeat, so a file from an earlier job on the same mount
    would otherwise be scored as this trial's answer."""
    p = os.path.join(answer_dir(group_dir, task.id, repeat), "answer.json")
    if not os.path.isfile(p):
        return None
    try:
        if os.path.getmtime(p) < not_before:
            return None
        with open(p, encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, ValueError):
        return None
    return doc if isinstance(doc, dict) else {"error": "answer.json is not a JSON object"}


def existing_answers(group_dir: str, plan: list[tuple[Task, int]]) -> list[str]:
    """The planned answer paths that already hold a file. A job must start with none of
    them present: the eval copy reads its own answer directory, so a leftover answer can
    steer the new session as well as the scorer."""
    paths = [os.path.join(answer_dir(group_dir, t.id, k), "answer.json") for t, k in plan]
    return [p for p in paths if os.path.isfile(p)]


def poll_fixer(gh: Callable[[str], object], fork: str, task: Task, repeat: int) -> dict | None:
    """The fork PR for this repeat: head branch carries `<task-id>-r<k>` or the title
    carries `[<task-id>#r<k>]`."""
    tag = f"{task.id}-r{repeat}"
    title_tag = f"[{trial_id(task.id, repeat)}]"
    pulls = gh(f"repos/{fork}/pulls?state=all&per_page=100&sort=created&direction=desc") or []
    for pr in pulls:
        head = ((pr.get("head") or {}).get("ref") or "")
        if tag in head or title_tag in (pr.get("title") or ""):
            return {"number": pr.get("number"), "url": pr.get("html_url"), "draft": bool(pr.get("draft")),
                    "head_sha": (pr.get("head") or {}).get("sha"), "head_ref": head, "state": pr.get("state")}
    return None


# --------------------------------------------------------------------------- scorers


def read_reward_text(text: str) -> float | None:
    for line in reversed([ln.strip() for ln in text.splitlines() if ln.strip()]):
        try:
            v = float(line)
        except ValueError:
            continue
        return max(0.0, min(1.0, v))
    return None


def score_triage(task: Task, answer_file: str, verifier_dir: str, run: Runner = default_run) -> tuple[float | None, str]:
    """Run the task's verifier on the answer. The bank's contract: AGENT_OUTPUT is the
    answer, REWARD_DIR receives reward.txt (and summary.json), the script exits 0. The
    reward is reward.txt when written, else the last numeric line of stdout. A verifier
    that writes neither is unknown, not zero."""
    if not os.path.isfile(task.test_script):
        return None, "task has no tests/test.sh"
    os.makedirs(verifier_dir, exist_ok=True)
    reward_path = os.path.join(verifier_dir, "reward.txt")
    env = dict(os.environ, AGENT_OUTPUT=answer_file, REWARD_DIR=verifier_dir, REWARD_PATH=reward_path,
               TASK_DIR=task.dir, TASK_ID=task.id)
    try:
        r = run(["bash", task.test_script], timeout=task.verifier_timeout_sec, cwd=task.dir, env=env)
    except subprocess.TimeoutExpired:
        return None, f"verifier exceeded {task.verifier_timeout_sec}s"
    with open(os.path.join(verifier_dir, "test.log"), "w", encoding="utf-8") as fh:
        fh.write(r.stdout or "")
        if r.stderr:
            fh.write("\n--- stderr ---\n" + r.stderr)
    reward = None
    if os.path.isfile(reward_path):
        with open(reward_path, encoding="utf-8") as fh:
            reward = read_reward_text(fh.read())
    if reward is None:
        reward = read_reward_text(r.stdout or "")
        if reward is not None:
            with open(reward_path, "w", encoding="utf-8") as fh:
                fh.write(f"{reward}\n")
    if reward is None:
        return None, f"verifier exited {r.returncode} and wrote no reward"
    return reward, f"verifier exited {r.returncode}"


GREEN = {"success", "neutral", "skipped"}
RED = {"failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"}


def ci_verdict(check_runs: list[dict], statuses: list[dict], only: str | None = None) -> tuple[str, str]:
    """`green`, `red`, `pending` or `none` from the fork's check runs (and legacy commit
    statuses). Any red run decides red; otherwise an unfinished run keeps it pending.
    With `only`, just the check runs of that name count and statuses are ignored: the
    fork carries every upstream workflow file, and a check that skips drafts or wants
    a label would otherwise decide the verdict."""
    seen = False
    pending = False
    if only:
        check_runs = [cr for cr in check_runs or [] if cr.get("name") == only]
        statuses = []
    for cr in check_runs or []:
        seen = True
        if cr.get("status") != "completed":
            pending = True
            continue
        if (cr.get("conclusion") or "") in RED:
            return "red", f"check run \"{cr.get('name')}\" concluded {cr.get('conclusion')}"
    for st in statuses or []:
        seen = True
        state = st.get("state")
        if state in ("failure", "error"):
            return "red", f"status \"{st.get('context')}\" is {state}"
        if state == "pending":
            pending = True
    if not seen:
        if only:
            return "none", f"the fork reported no \"{only}\" check run for the PR head"
        return "none", "the fork reported no check runs or statuses for the PR head"
    if pending:
        return "pending", "check runs still running"
    return "green", "every check run concluded success"


def fork_ci(gh: Callable[[str], object], fork: str, sha: str, only: str | None = None) -> tuple[str, str]:
    try:
        runs = (gh(f"repos/{fork}/commits/{sha}/check-runs?per_page=100") or {}).get("check_runs") or []
        combined = {} if only else (gh(f"repos/{fork}/commits/{sha}/status") or {})
    except RuntimeError as exc:
        return "none", f"could not read the fork's checks: {exc}"
    return ci_verdict(runs, combined.get("statuses") or [], only)


# --------------------------------------------------------------------------- budget


class Budget:
    """Keeps dispatch under `cap_usd`. Known spend comes from `cost_reader(session_id)`;
    a session whose cost is unknown is counted at `fallback_usd`, so an eval without
    the cost signal degrades to a hard cap of floor(cap / fallback) trials. Every repeat
    is its own session and counts."""

    def __init__(self, cap_usd: float, cost_reader: Callable[[str], float | None], fallback_usd: float):
        self.cap_usd = cap_usd
        self.cost_reader = cost_reader
        self.fallback_usd = fallback_usd
        self.costs: dict[str, float | None] = {}
        self.cost_signal_seen = False

    def refresh(self, session_id: str) -> float | None:
        if not session_id:
            return None
        v = self.cost_reader(session_id)
        if v is not None:
            self.cost_signal_seen = True
            self.costs[session_id] = v
        else:
            self.costs.setdefault(session_id, None)
        return self.costs.get(session_id)

    def committed_usd(self) -> float:
        return sum(self.fallback_usd if v is None else v for v in self.costs.values())

    def known_usd(self) -> float:
        return sum(v for v in self.costs.values() if v is not None)

    def can_dispatch(self) -> tuple[bool, str]:
        projected = self.committed_usd() + self.fallback_usd
        if projected > self.cap_usd:
            return False, (f"budget: committed {self.committed_usd():.2f} USD + next trial estimate "
                           f"{self.fallback_usd:.2f} would pass the cap of {self.cap_usd:.2f}")
        return True, ""


# --------------------------------------------------------------------------- trials


@dataclass
class Trial:
    task_id: str
    repeat: int
    trial_name: str
    attempt: int
    kind: str
    status: str = PENDING
    session_id: str = ""
    series_id: str = ""
    dispatched_at: str | None = None
    finished_at: str | None = None
    duration_sec: float | None = None
    reward: float | None = None
    reason: str = ""
    cost_usd: float | None = None
    pr: dict | None = None
    answer: dict | None = None
    base_commit: str | None = None
    _started: float = field(default=0.0, repr=False)
    _pr_seen_at: float = field(default=0.0, repr=False)
    _answer_sig: str = field(default="", repr=False)

    @property
    def trial_id(self) -> str:
        return trial_id(self.task_id, self.repeat)

    def public(self) -> dict:
        d = asdict(self)
        d.pop("_started", None)
        d.pop("_pr_seen_at", None)
        d.pop("_answer_sig", None)
        d["trial_id"] = self.trial_id
        return d


def iso(t: float) -> str:
    return dt.datetime.fromtimestamp(t, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass
class JobConfig:
    job_id: str
    kind: str
    group: str
    group_dir: str
    bank: str
    variant: str
    fork: str
    budget_usd: float
    concurrency: int
    limit: int
    repeats: int
    poll_interval_sec: float
    ci_grace_sec: int
    reports_dir: str
    compare: str | None = None
    retry_from: str | None = None
    ci_check: str | None = None


class EvalJob:
    """One job: dispatch up to `concurrency` trials at a time, poll, score, write.

    `pairs` (task, repeat) overrides the default queue of every task × every repeat;
    a retry job passes only the pairs a previous job left unscored."""

    def __init__(self, cfg: JobConfig, tasks: list[Task], dispatcher, budget: Budget,
                 gh: Callable[[str], object] | None = None, run: Runner = default_run,
                 clock: Callable[[], float] = time.time, sleep: Callable[[float], None] = time.sleep,
                 log: Callable[[str], None] | None = None, attempts: dict[str, int] | None = None,
                 frozen: dict | None = None, pairs: list[tuple[Task, int]] | None = None):
        self.cfg = cfg
        self.tasks = tasks
        self.dispatcher = dispatcher
        self.budget = budget
        self.gh = gh
        self.run = run
        self.clock = clock
        self.sleep = sleep
        self.log = log or (lambda s: None)
        self.attempts = attempts or {}
        self.frozen = frozen or {}
        self.pairs = pairs
        self.trials: list[Trial] = []
        self.stopped_for_budget = False
        self.job_dir = os.path.join(cfg.reports_dir, "evals", cfg.job_id)
        self.started_at = 0.0
        self.finished_at = 0.0

    # -- lifecycle
    def queue(self) -> list[tuple[Task, int]]:
        """Repeats of one task are spread apart so a budget stop leaves every task with a
        comparable number of repeats, not the first tasks with all of theirs and the
        last with none."""
        if self.pairs is not None:
            return list(self.pairs)
        return [(t, k) for k in range(1, self.cfg.repeats + 1) for t in self.tasks]

    def run_all(self) -> list[Trial]:
        queue = self.queue()
        in_flight: list[tuple[Task, Trial]] = []
        self.started_at = self.clock()
        while queue or in_flight:
            while queue and len(in_flight) < self.cfg.concurrency:
                ok, why = self.budget.can_dispatch()
                if not ok:
                    self.log(f"{why}; not dispatching the remaining {len(queue)} trial(s)")
                    for t, k in queue:
                        self.trials.append(self._new_trial(t, k, status=SKIPPED, reason=why))
                    queue = []
                    self.stopped_for_budget = True
                    break
                task, repeat = queue.pop(0)
                trial = self._dispatch(task, repeat)
                self.trials.append(trial)
                if trial.status == RUNNING:
                    in_flight.append((task, trial))
            if not in_flight:
                continue
            self.sleep(self.cfg.poll_interval_sec)
            in_flight = [(task, trial) for task, trial in in_flight if not self._poll(task, trial)]
        self.finished_at = self.clock()
        for trial in self.trials:
            if trial.session_id:
                trial.cost_usd = self.budget.refresh(trial.session_id)
        return self.trials

    def _new_trial(self, task: Task, repeat: int, **kw) -> Trial:
        attempt = self.attempts.get(trial_id(task.id, repeat), 1)
        name = f"{trial_id(task.id, repeat)}__{attempt}-{uuid.uuid4().hex[:4]}"
        return Trial(task.id, repeat, name, attempt, task.kind, base_commit=task.base_commit, **kw)

    def _dispatch(self, task: Task, repeat: int) -> Trial:
        trial = self._new_trial(task, repeat)
        prompt = build_prompt(task, repeat, self.cfg.fork)
        now = self.clock()
        trial._started = now
        trial.dispatched_at = iso(now)
        try:
            d = self.dispatcher.dispatch(task, repeat, prompt)
        except Exception as exc:  # noqa: BLE001 - a dispatch failure is a trial error, never a crash
            trial.status = ERROR
            trial.reason = f"dispatch failed: {exc}"
            trial.finished_at = iso(now)
            trial.duration_sec = 0.0
            self.log(f"{trial.trial_id}: {trial.reason}")
            return trial
        trial.session_id, trial.series_id = d.session_id, d.series_id
        trial.status = RUNNING
        self.budget.refresh(trial.session_id)
        self.log(f"{trial.trial_id}: dispatched as session {trial.session_id or '?'} ({trial.series_id or '?'})")
        return trial

    def _finish(self, trial: Trial, status: str, reward: float | None, reason: str) -> None:
        now = self.clock()
        trial.status = status
        trial.reward = reward
        trial.reason = reason
        trial.finished_at = iso(now)
        trial.duration_sec = round(now - trial._started, 1)
        trial.cost_usd = self.budget.refresh(trial.session_id)
        self.log(f"{trial.trial_id}: {status} reward={reward} ({reason})")
        self._write_trial(trial)

    def _poll(self, task: Task, trial: Trial) -> bool:
        """True when the trial is finished (scored, unknown, timed out or errored)."""
        elapsed = self.clock() - trial._started
        verifier_dir = os.path.join(self.job_dir, "trials", trial.trial_name, "verifier")
        if task.kind in FILE_KINDS:
            answer = poll_triage(self.cfg.group_dir, task, trial.repeat, not_before=trial._started)
            if answer is not None:
                # The agent may rewrite its answer moments after the first version
                # appears, so a version is scored only once two consecutive polls
                # read it unchanged.
                sig = json.dumps(answer, sort_keys=True)
                if sig != trial._answer_sig:
                    trial._answer_sig = sig
                    answer = None
            if answer is not None:
                trial.answer = answer
                if "error" in answer and not {"subsystem", "severity", "next_step", "labels", "reply"} & set(answer):
                    self._finish(trial, ERROR, 0.0, f"agent reported: {str(answer.get('error'))[:200]}")
                    return True
                answer_file = os.path.join(answer_dir(self.cfg.group_dir, task.id, trial.repeat), "answer.json")
                reward, why = score_triage(task, answer_file, verifier_dir, self.run)
                self._finish(trial, SCORED if reward is not None else UNKNOWN, reward, why)
                return True
        else:
            if trial.pr is None:
                try:
                    pr = poll_fixer(self.gh, self.cfg.fork, task, trial.repeat)
                except RuntimeError as exc:
                    pr = None
                    self.log(f"{trial.trial_id}: poll failed: {exc}")
                if pr is not None:
                    trial.pr = pr
                    trial._pr_seen_at = self.clock()
                    self.log(f"{trial.trial_id}: PR #{pr.get('number')} found ({pr.get('head_ref')})")
                else:
                    answer = poll_triage(self.cfg.group_dir, task, trial.repeat, not_before=trial._started)
                    if answer is not None and "error" in answer:
                        self._finish(trial, ERROR, 0.0, f"agent reported: {str(answer.get('error'))[:200]}")
                        return True
            if trial.pr is not None:
                verdict, why = fork_ci(self.gh, self.cfg.fork, trial.pr.get("head_sha") or "", self.cfg.ci_check)
                if verdict == "green":
                    self._write_reward(verifier_dir, 1.0)
                    self._finish(trial, SCORED, 1.0, why)
                    return True
                if verdict == "red":
                    self._write_reward(verifier_dir, 0.0)
                    self._finish(trial, SCORED, 0.0, why)
                    return True
                if verdict == "none" and self.clock() - trial._pr_seen_at >= self.cfg.ci_grace_sec:
                    self._finish(trial, UNKNOWN, None, why + "; the scorer cannot tell green from red without them")
                    return True
        if elapsed >= task.agent_timeout_sec:
            self._finish(trial, TIMEOUT, 0.0 if trial.pr is None else None,
                         f"no {'answer' if task.kind in FILE_KINDS else 'CI verdict'} within {task.agent_timeout_sec}s")
            return True
        return False

    # -- output
    def _write_reward(self, verifier_dir: str, reward: float) -> None:
        os.makedirs(verifier_dir, exist_ok=True)
        with open(os.path.join(verifier_dir, "reward.txt"), "w", encoding="utf-8") as fh:
            fh.write(f"{reward}\n")

    def _write_trial(self, trial: Trial) -> None:
        """Harbor-style trial directory: config.json (task + hidden metadata + the frozen
        settings), result.json (verdict), verifier/reward.txt (the number)."""
        task = next((t for t in self.tasks if t.id == trial.task_id), None)
        tdir = os.path.join(self.job_dir, "trials", trial.trial_name)
        os.makedirs(os.path.join(tdir, "verifier"), exist_ok=True)
        config = {
            "trial_name": trial.trial_name, "trial_id": trial.trial_id, "repeat": trial.repeat,
            "task": {"id": trial.task_id, "path": task.dir if task else None, "kind": trial.kind,
                     "base_commit": trial.base_commit, "manifest": task.manifest if task else {},
                     "metadata": task.metadata if task else {}},
            "agent": {"name": self.cfg.group, "variant": self.cfg.variant, **self.frozen},
            "job_id": self.cfg.job_id, "attempt": trial.attempt,
        }
        _write_json(os.path.join(tdir, "config.json"), config)
        result = {
            "trial_name": trial.trial_name, "trial_id": trial.trial_id, "task_id": trial.task_id,
            "repeat": trial.repeat, "status": trial.status,
            "started_at": trial.dispatched_at, "finished_at": trial.finished_at,
            "verifier_result": {"rewards": {"reward": trial.reward}} if trial.reward is not None else None,
            "exception_info": None if trial.status == SCORED else {"type": trial.status, "message": trial.reason},
            "agent_info": {"session_id": trial.session_id, "series_id": trial.series_id, "cost_usd": trial.cost_usd},
            "pr": trial.pr, "answer": trial.answer,
        }
        _write_json(os.path.join(tdir, "result.json"), result)
        if trial.reward is not None and not os.path.isfile(os.path.join(tdir, "verifier", "reward.txt")):
            self._write_reward(os.path.join(tdir, "verifier"), trial.reward)


def _write_json(path: str, doc) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, sort_keys=True)
        fh.write("\n")


# --------------------------------------------------------------------------- statistics


def _mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 4) if xs else None


def aggregate_tasks(trials: list[dict]) -> dict[str, dict]:
    """Per-task view over the repeats: mean, pass@k (any repeat with reward 1), min, max,
    the repeat count, how many repeats produced a reward, and `low_signal` when the
    scored repeats disagree (the task's answer depends on the draw, so a single
    difference on it says little)."""
    by: dict[str, list[dict]] = {}
    for t in trials:
        by.setdefault(t["task_id"], []).append(t)
    out: dict[str, dict] = {}
    for tid, ts in sorted(by.items()):
        rewards = [t["reward"] for t in ts if t.get("reward") is not None]
        out[tid] = {
            "task_id": tid, "repeats": len(ts), "scored": len(rewards),
            "mean": _mean(rewards), "min": min(rewards) if rewards else None, "max": max(rewards) if rewards else None,
            "pass_at_k": (1.0 if any(r >= 1.0 for r in rewards) else 0.0) if rewards else None,
            "k": len(ts),
            "stdev": round(statistics.pstdev(rewards), 4) if len(rewards) > 1 else None,
            "low_signal": len(rewards) > 1 and (max(rewards) - min(rewards)) > 1e-9,
            "base_commit": next((t.get("base_commit") for t in ts if t.get("base_commit")), None),
        }
    return out


def bootstrap_ci(diffs: list[float], samples: int = BOOTSTRAP_SAMPLES, seed: int = BOOTSTRAP_SEED,
                 level: float = 0.95) -> tuple[float, float] | None:
    """Percentile bootstrap interval of the mean over tasks, seeded so a report is
    reproducible from its inputs."""
    if len(diffs) < 2:
        return None
    rng = random.Random(seed)
    n = len(diffs)
    means = sorted(sum(rng.choice(diffs) for _ in range(n)) / n for _ in range(samples))
    lo = means[math.floor((1 - level) / 2 * (samples - 1))]
    hi = means[math.ceil((1 - (1 - level) / 2) * (samples - 1))]
    return round(lo, 4), round(hi, 4)


def compare_jobs(baseline: list[dict], variant: list[dict]) -> dict:
    """Paired comparison: for every task scored in both jobs, variant mean over repeats
    minus baseline mean over repeats; the mean paired difference with a bootstrap 95%
    interval over tasks; win/loss/tie counts; the low-signal tasks; and
    `smoke_signal` when fewer than SMOKE_SIGNAL_TASKS tasks were paired."""
    b, v = aggregate_tasks(baseline), aggregate_tasks(variant)
    common = sorted(tid for tid in set(b) & set(v) if b[tid]["mean"] is not None and v[tid]["mean"] is not None)
    rows = []
    for tid in common:
        rows.append({"task_id": tid, "baseline": b[tid]["mean"], "variant": v[tid]["mean"],
                     "delta": round(v[tid]["mean"] - b[tid]["mean"], 4),
                     "baseline_pass_at_k": b[tid]["pass_at_k"], "variant_pass_at_k": v[tid]["pass_at_k"],
                     "low_signal": bool(b[tid]["low_signal"] or v[tid]["low_signal"])})
    diffs = [r["delta"] for r in rows]
    ci = bootstrap_ci(diffs)
    return {
        "tasks_compared": len(common),
        "smoke_signal": len(common) < SMOKE_SIGNAL_TASKS,
        "baseline_mean": _mean([r["baseline"] for r in rows]), "variant_mean": _mean([r["variant"] for r in rows]),
        "paired_delta_mean": _mean(diffs),
        "paired_delta_ci95": list(ci) if ci else None,
        "significant": bool(ci and (ci[0] > 0 or ci[1] < 0)),
        "bootstrap": {"samples": BOOTSTRAP_SAMPLES, "seed": BOOTSTRAP_SEED},
        "wins": sum(1 for d in diffs if d > 0), "losses": sum(1 for d in diffs if d < 0),
        "ties": sum(1 for d in diffs if d == 0),
        "low_signal_tasks": sorted(r["task_id"] for r in rows if r["low_signal"]),
        "rows": rows,
        "baseline_only": sorted(set(b) - set(v)), "variant_only": sorted(set(v) - set(b)),
    }


# --------------------------------------------------------------------------- report


def summarize(cfg: JobConfig, trials: list[Trial], budget: Budget, started_at: float, finished_at: float,
              stopped_for_budget: bool, frozen: dict) -> dict:
    public = [t.public() for t in trials]
    tasks = aggregate_tasks(public)
    scored = [t for t in trials if t.status == SCORED]
    with_reward = [t for t in trials if t.reward is not None]
    dispatched = [t for t in trials if t.status != SKIPPED]
    costs = [t.cost_usd for t in trials if t.cost_usd is not None]
    task_means = [a["mean"] for a in tasks.values() if a["mean"] is not None]
    pass_k = [a["pass_at_k"] for a in tasks.values() if a["pass_at_k"] is not None]
    return {
        "schema": SCHEMA, "job_id": cfg.job_id, "kind": cfg.kind, "variant": cfg.variant, "group": cfg.group,
        "fork": cfg.fork, "bank": cfg.bank, "repeats": cfg.repeats,
        "started_at": iso(started_at), "finished_at": iso(finished_at),
        "duration_sec": round(finished_at - started_at, 1),
        "tasks": len(tasks), "trials": len(trials), "dispatched": len(dispatched), "scored": len(scored),
        "unknown": sum(1 for t in trials if t.status == UNKNOWN),
        "timeouts": sum(1 for t in trials if t.status == TIMEOUT),
        "errors": sum(1 for t in trials if t.status == ERROR),
        "skipped": sum(1 for t in trials if t.status == SKIPPED),
        "mean_reward": _mean(task_means),
        "trial_mean_reward": _mean([t.reward for t in with_reward]),
        "pass_at_k": _mean(pass_k),
        "pass_rate": _mean([1.0 if t.reward >= 1.0 else 0.0 for t in with_reward]),
        "low_signal_tasks": sum(1 for a in tasks.values() if a["low_signal"]),
        "cost_usd": round(sum(costs), 4) if costs else None,
        "cost_known_sessions": len(costs),
        "cost_signal": "ncl cost-cap status" if budget.cost_signal_seen else "none (fallback per-trial estimate)",
        "cost_committed_usd": round(budget.committed_usd(), 4),
        "budget_usd": cfg.budget_usd, "stopped_for_budget": stopped_for_budget,
        "concurrency": cfg.concurrency, "compare": cfg.compare, "retry_from": cfg.retry_from,
        "frozen": frozen,
        "status": "complete" if trials and all(t.status == SCORED for t in trials) else
                  ("stopped" if stopped_for_budget or not dispatched else "partial"),
    }


def load_trials(reports_dir: str, job_id: str) -> list[dict]:
    p = os.path.join(reports_dir, "evals", job_id, "trials.jsonl")
    out = []
    if not os.path.isfile(p):
        return out
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def render_html(summary: dict, trials: list[dict], tasks: dict[str, dict], compare: dict | None,
                baseline_id: str | None) -> str:
    e = html.escape

    def fmt(v):
        if v is None:
            return "—"
        return f"{v:.2f}" if isinstance(v, float) else str(v)

    frozen = summary.get("frozen") or {}
    model = ((frozen.get("group") or {}).get("model") or {})
    head = [
        ("job", summary["job_id"]), ("kind", summary["kind"]), ("variant", summary["variant"]),
        ("group", summary["group"]), ("repeats", summary["repeats"]),
        ("tasks / trials", f"{summary['tasks']} / {summary['trials']}"), ("scored trials", summary["scored"]),
        ("mean reward (task means)", fmt(summary["mean_reward"])), ("pass@k", fmt(summary["pass_at_k"])),
        ("low-signal tasks", summary["low_signal_tasks"]),
        ("cost USD", fmt(summary["cost_usd"])), ("cost signal", summary["cost_signal"]),
        ("budget USD", fmt(summary["budget_usd"])), ("stopped for budget", summary["stopped_for_budget"]),
        ("model id", model.get("model_id") or f"unresolved ({model.get('alias') or '?'})"),
        ("duration s", summary["duration_sec"]), ("status", summary["status"]),
    ]
    out = [
        "<!doctype html><meta charset='utf-8'><title>eval scorecard {}</title>".format(e(summary["job_id"])),
        ("<style>body{font:14px system-ui,sans-serif;margin:2rem;color:#222}table{border-collapse:collapse;margin:1rem 0}"
        "td,th{border:1px solid #ccc;padding:.3rem .6rem;text-align:left}th{background:#f3f3f3}"
        ".ok{color:#1a7f37}.bad{color:#b42318}.na{color:#777}.flag{color:#9a6700;font-weight:600}</style>"),
        f"<h1>Eval scorecard — {e(summary['job_id'])}</h1>",
        "<table>" + "".join(f"<tr><th>{e(str(k))}</th><td>{e(str(v))}</td></tr>" for k, v in head) + "</table>",
    ]
    if compare is not None:
        out.append(f"<h2>Baseline {e(baseline_id or '')} vs variant {e(summary['variant'])}</h2>")
        if compare["smoke_signal"]:
            out.append(f"<p class='flag'>smoke-signal: only {compare['tasks_compared']} tasks paired "
                       f"(fewer than {SMOKE_SIGNAL_TASKS}); treat the difference as a hint, not a result.</p>")
        ci = compare["paired_delta_ci95"]
        out.append("<table><tr><th>tasks paired</th><th>baseline mean</th><th>variant mean</th>"
                   "<th>paired Δ mean</th><th>Δ 95% CI (bootstrap)</th><th>wins</th><th>losses</th><th>ties</th></tr>"
                   f"<tr><td>{compare['tasks_compared']}</td><td>{fmt(compare['baseline_mean'])}</td>"
                   f"<td>{fmt(compare['variant_mean'])}</td><td>{fmt(compare['paired_delta_mean'])}</td>"
                   f"<td>{(f'[{fmt(ci[0])}, {fmt(ci[1])}]') if ci else '—'}</td>"
                   f"<td>{compare['wins']}</td><td>{compare['losses']}</td><td>{compare['ties']}</td></tr></table>")
        out.append("<table><tr><th>task</th><th>baseline mean</th><th>variant mean</th><th>Δ</th><th>signal</th></tr>")
        for r in compare["rows"]:
            cls = "ok" if r["delta"] > 0 else ("bad" if r["delta"] < 0 else "na")
            flag = "<span class='flag'>low-signal</span>" if r["low_signal"] else ""
            out.append(f"<tr><td>{e(r['task_id'])}</td><td>{fmt(r['baseline'])}</td><td>{fmt(r['variant'])}</td>"
                       f"<td class='{cls}'>{fmt(r['delta'])}</td><td>{flag}</td></tr>")
        out.append("</table>")
    out.append("<h2>Tasks</h2><table><tr><th>task</th><th>repeats</th><th>scored</th><th>mean</th><th>pass@k</th>"
               "<th>min</th><th>max</th><th>signal</th><th>base commit</th></tr>")
    for a in tasks.values():
        flag = "<span class='flag'>low-signal</span>" if a["low_signal"] else ""
        out.append(f"<tr><td>{e(a['task_id'])}</td><td>{a['repeats']}</td><td>{a['scored']}</td><td>{fmt(a['mean'])}</td>"
                   f"<td>{fmt(a['pass_at_k'])}</td><td>{fmt(a['min'])}</td><td>{fmt(a['max'])}</td><td>{flag}</td>"
                   f"<td>{e(str(a['base_commit'] or '')[:12])}</td></tr>")
    out.append("</table>")
    out.append("<h2>Trials</h2><table><tr><th>trial</th><th>attempt</th><th>status</th><th>reward</th>"
               "<th>duration s</th><th>cost USD</th><th>PR</th><th>reason</th></tr>")
    for t in trials:
        cls = "na" if t.get("reward") is None else ("ok" if t["reward"] >= 1.0 else "bad")
        pr = t.get("pr") or {}
        link = f"<a href='{e(str(pr.get('url')))}'>#{e(str(pr.get('number')))}</a>" if pr.get("url") else "—"
        out.append(f"<tr><td>{e(t['trial_id'])}</td><td>{t.get('attempt', 1)}</td><td>{e(t['status'])}</td>"
                   f"<td class='{cls}'>{fmt(t.get('reward'))}</td><td>{fmt(t.get('duration_sec'))}</td>"
                   f"<td>{fmt(t.get('cost_usd'))}</td><td>{link}</td><td>{e(str(t.get('reason') or ''))}</td></tr>")
    out.append("</table>")
    return "\n".join(out) + "\n"


def write_job(cfg: JobConfig, job: EvalJob) -> dict:
    trials = [t.public() for t in job.trials]
    summary = summarize(cfg, job.trials, job.budget, job.started_at, job.finished_at, job.stopped_for_budget,
                        job.frozen)
    tasks = aggregate_tasks(trials)
    compare = None
    if cfg.compare:
        compare = compare_jobs(load_trials(cfg.reports_dir, cfg.compare), trials)
        summary["compare_result"] = {k: v for k, v in compare.items() if k != "rows"}
    job_dir = job.job_dir
    os.makedirs(job_dir, exist_ok=True)
    with open(os.path.join(job_dir, "trials.jsonl"), "w", encoding="utf-8") as fh:
        fh.writelines(json.dumps(t, sort_keys=True) + "\n" for t in trials)
    _write_json(os.path.join(job_dir, "job.json"), {**summary, "task_results": tasks, "trial_results": trials,
                                                     "compare": compare})
    # Harbor-style job files next to the trial directories.
    _write_json(os.path.join(job_dir, "config.json"), {
        "job_name": cfg.job_id, "agents": [{"name": cfg.group, "variant": cfg.variant, **job.frozen}],
        "datasets": [{"path": cfg.bank, "kind": cfg.kind}], "n_concurrent_trials": cfg.concurrency,
        "n_attempts": cfg.repeats, "budget_usd": cfg.budget_usd,
    })
    _write_json(os.path.join(job_dir, "result.json"), {
        "id": cfg.job_id, "started_at": summary["started_at"], "finished_at": summary["finished_at"],
        "n_total_trials": summary["trials"], "stats": {
            "n_trials": summary["trials"], "n_errors": summary["errors"] + summary["timeouts"],
            "evals": {cfg.kind: {"metrics": [{"mean": summary["mean_reward"], "pass_at_k": summary["pass_at_k"]}],
                                 "n_trials": summary["scored"]}},
        },
    })
    with open(os.path.join(job_dir, "scorecard.html"), "w", encoding="utf-8") as fh:
        fh.write(render_html(summary, trials, tasks, compare, cfg.compare))
    _write_json(os.path.join(cfg.reports_dir, "evals", "latest.json"), summary)
    with open(os.path.join(cfg.reports_dir, "evals", "history.log"), "a", encoding="utf-8") as fh:
        fh.write(f"{summary['finished_at']} {cfg.job_id} kind={cfg.kind} variant={cfg.variant} tasks={summary['tasks']} "
                 f"trials={summary['trials']} scored={summary['scored']} mean={summary['mean_reward']} "
                 f"pass@k={summary['pass_at_k']} cost={summary['cost_usd']} status={summary['status']}\n")
    return summary


# --------------------------------------------------------------------------- main


def make_job_id(kind: str, variant: str, now: dt.datetime) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", variant.lower()).strip("-") or "run"
    return f"{now.strftime('%Y%m%d-%H%M%S')}-{kind}-{slug}"


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--bank", required=True, help="checkout of slang-eval-tasks (MANIFEST.json at its root)")
    p.add_argument("--kind", required=True, choices=["triage", "fixer", "reply"])
    p.add_argument("--group", required=True, help="agent group id of the eval coworker (ncl --group)")
    p.add_argument("--group-folder", help="the eval group's workspace folder (default: --group)")
    p.add_argument("--prod-groups-root", default=DEFAULT_PROD_GROUPS,
                   help="read-only mount of every group directory (default %(default)s)")
    p.add_argument("--group-dir", help="override: the eval group's directory (answers under <dir>/eval/)")
    p.add_argument("--limit", type=int, default=0, help="run at most N tasks (0 = all); repeats multiply this")
    p.add_argument("--repeats", type=int, help="independent runs per task (default: 3 triage, 2 fixer)")
    p.add_argument("--variant", default="baseline", help="label for this job (prompt/skill variant under test)")
    p.add_argument("--fork", default=DEFAULT_FORK)
    p.add_argument("--budget-usd", type=float, default=300.0)
    p.add_argument("--fallback-cost-usd", type=float, help="per-trial estimate when a session's cost is unknown "
                   "(default: 1.5 triage, 20 fixer)")
    p.add_argument("--concurrency", type=int, default=2)
    p.add_argument("--poll-interval", type=float, default=30.0)
    p.add_argument("--ci-grace-sec", type=int, default=DEFAULT_CI_GRACE_SEC)
    p.add_argument("--ci-check", default=DEFAULT_CI_CHECK,
                   help="name of the fork check run that scores a fixer PR (default eval-ci); '' means every check run")
    p.add_argument("--reports", default=DEFAULT_REPORTS)
    p.add_argument("--compare", help="baseline job id to compare against (paired, bootstrap CI)")
    p.add_argument("--retry-from", help="job id whose timed-out / errored trials to re-run (one retry only)")
    p.add_argument("--job-id")
    p.add_argument("--dry-run", action="store_true", help="list the trials and the ncl command; dispatch nothing")
    p.add_argument("--quiet", action="store_true")
    return p.parse_args(argv)


def select_retry(tasks: list[Task], previous: list[dict],
                 log: Callable[[str], None]) -> tuple[list[tuple[Task, int]], dict[str, int]]:
    """The (task, repeat) pairs of `previous` that timed out, errored or stayed unknown
    and have not been retried yet, with the attempt number each trial id gets. A trial
    already on its second attempt is left alone."""
    attempts: dict[str, int] = {}
    wanted: dict[str, set[int]] = {}
    for t in previous:
        if t.get("status") in (TIMEOUT, ERROR, UNKNOWN):
            attempt = int(t.get("attempt") or 1)
            repeat = int(t.get("repeat") or 1)
            tid = t.get("trial_id") or trial_id(t["task_id"], repeat)
            if attempt >= MAX_ATTEMPTS:
                log(f"{tid}: already attempted {attempt} time(s); not retried")
                continue
            attempts[tid] = attempt + 1
            wanted.setdefault(t["task_id"], set()).add(repeat)
    pairs = [(t, k) for t in tasks for k in sorted(wanted.get(t.id, ()))]
    return pairs, attempts


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    log = (lambda s: None) if args.quiet else (lambda s: print(s, file=sys.stderr, flush=True))
    now = dt.datetime.now(dt.timezone.utc)
    job_id = args.job_id or make_job_id(args.kind, args.variant, now)
    group_dir = args.group_dir or os.path.join(args.prod_groups_root, args.group_folder or args.group)
    repeats = args.repeats if args.repeats and args.repeats > 0 else DEFAULT_REPEATS[args.kind]
    cfg = JobConfig(
        job_id=job_id, kind=args.kind, group=args.group, group_dir=group_dir, bank=os.path.abspath(args.bank),
        variant=args.variant, fork=args.fork, budget_usd=args.budget_usd, concurrency=max(1, args.concurrency),
        limit=args.limit, repeats=repeats, poll_interval_sec=args.poll_interval, ci_grace_sec=args.ci_grace_sec, ci_check=args.ci_check or None,
        reports_dir=args.reports, compare=args.compare, retry_from=args.retry_from,
    )
    tasks = load_bank(cfg.bank, cfg.kind, log)
    if args.limit > 0:
        tasks = tasks[:args.limit]
    attempts: dict[str, int] = {}
    pairs: list[tuple[Task, int]] | None = None
    if args.retry_from:
        pairs, attempts = select_retry(tasks, load_trials(cfg.reports_dir, args.retry_from), log)
        tasks = [t for t in tasks if any(p[0].id == t.id for p in pairs)]
    if not tasks:
        log(f"no {cfg.kind} tasks selected under {cfg.bank}")
        return 2
    if not os.path.isdir(group_dir) and not args.dry_run:
        log(f"eval group directory {group_dir} is not mounted; triage answers cannot be read")
        if cfg.kind in FILE_KINDS:
            return 2
    dispatcher = NclDispatcher(cfg.group)
    plan = pairs if pairs is not None else [(t, k) for k in range(1, repeats + 1) for t in tasks]
    if cfg.kind in FILE_KINDS and not args.dry_run:
        stale = existing_answers(group_dir, plan)
        if stale:
            for p in stale[:10]:
                log(f"answer already present before dispatch: {p}")
            log(f"{len(stale)} planned answer path(s) already hold a file; move the previous job's "
                f"{os.path.join(group_dir, 'eval')} aside on the host before starting this job")
            return 2
    if args.dry_run:
        for t, k in plan:
            cmd = dispatcher.command(t, k, build_prompt(t, k, cfg.fork))
            log(f"{trial_id(t.id, k)}: ncl {' '.join(cmd[:8])} --prompt <{len(cmd[-1])} chars> --json  "
                f"(timeout {t.agent_timeout_sec}s, base {t.base_commit or '?'})")
        return 0
    fallback = args.fallback_cost_usd if args.fallback_cost_usd is not None else FALLBACK_COST_USD[cfg.kind]
    budget = Budget(cfg.budget_usd, NclCostReader(), fallback)
    frozen = {"group": freeze_group(cfg.group), "skills": freeze_skills(),
              "bank": {"path": cfg.bank, "manifest": os.path.isfile(os.path.join(cfg.bank, "MANIFEST.json"))}}
    if frozen["group"]["model"].get("model_id") is None:
        log("model id could not be resolved to an exact id; recorded as unresolved in job.json")
    job = EvalJob(cfg, tasks, dispatcher, budget, gh=GhGet(), log=log, attempts=attempts, frozen=frozen, pairs=pairs)
    log(f"job {job_id}: {len(tasks)} {cfg.kind} task(s), {len(plan)} trial(s) → group {cfg.group}, budget "
        f"{cfg.budget_usd} USD, concurrency {cfg.concurrency}")
    job.run_all()
    summary = write_job(cfg, job)
    log(f"job {job_id}: {summary['status']} — scored {summary['scored']}/{summary['trials']} trials over "
        f"{summary['tasks']} tasks, mean reward {summary['mean_reward']}, pass@k {summary['pass_at_k']}, "
        f"cost {summary['cost_usd']} USD ({summary['cost_signal']}); report "
        f"{os.path.join(job.job_dir, 'scorecard.html')}")
    if summary["status"] == "stopped":
        return 2
    return 0 if summary["status"] == "complete" else 1


if __name__ == "__main__":
    sys.exit(main())
