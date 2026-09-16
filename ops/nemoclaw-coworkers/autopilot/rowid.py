#!/usr/bin/env python3
"""rowid.py: the ONE canonical spelling of a `hermes-<ROW>` thread id.

NanoClaw keys agent-to-agent sessions on the exact thread string. On 2026-09-16 the ISO-F13 builder
addressed its tester and reviewer with thread `hermes-iso-f13`; their sessions then lived on that
lower-case thread while the Orchestrator, architect and builder sat on `hermes-ISO-F13`. Every tool
that recognises a row by its thread id (collect_threads.py, collect-acks.sh, pull-state.sh,
rows-board.py, slack-rows.py) matched the upper-case grammar only and silently dropped the two
sessions: the tester's PASS and the reviewer's REQUEST_CHANGES were invisible to the supervisor, to
acks.json and to the rows board.

`canon_thread` folds the row id back to the ledger spelling at INGESTION — `hermes-iso-f13` ->
`hermes-ISO-F13`, `hermes-Iso-F10.A` -> `hermes-ISO-F10.a` — and leaves everything that is not a
row thread (`hermes-status`, `hermes-p6-fleet`, `hermes-P0-LOOP`, None, "") exactly as it was.
Attribution follows the canonical id; the session's REAL thread stays on the record as
`thread_id_raw` wherever there is room, because a message sent into `hermes-ISO-F13` does not reach
a session living on `hermes-iso-f13` — the supervisor's re-arms pin the real session and its real
thread (hermes_supervise.py).

The row-id grammar is the existing ROW_ID (collect_threads.py / pull-state.sh): a letters+digits
prefix, `-F`, digits, an optional `.<letter>` suffix. Stdlib only. The two bash scripts that embed
Python via heredoc (collect-acks.sh, pull-state.sh) carry an inline copy of `canon_thread` with a
comment naming this file as the canonical copy — keep the three in step.
"""

from __future__ import annotations

import re

ROW_ID = r"[A-Z0-9]+-F[0-9]+(?:\.[a-z])?"
THREAD_RE = re.compile(rf"^hermes-({ROW_ID})$")
# The same grammar, case-insensitive: prefix, `-F`, digits, optional `.<letter>`; nothing else.
_LOOSE_RE = re.compile(r"^([A-Za-z0-9]+-[Ff][0-9]+)(\.[A-Za-z])?$")
_LOOSE_THREAD_RE = re.compile(r"^hermes-(.+)$")


def canon_row(row):
    """`iso-f13` -> `ISO-F13`, `Iso-F10.A` -> `ISO-F10.a`; anything that is not a row id (or not a str) unchanged."""
    if not isinstance(row, str):
        return row
    m = _LOOSE_RE.match(row)
    if not m:
        return row
    return m.group(1).upper() + (m.group(2).lower() if m.group(2) else "")


def canon_thread(thread):
    """`hermes-iso-f13` -> `hermes-ISO-F13`; non-row threads (`hermes-status`, `hermes-p6-fleet`), None and "" unchanged."""
    if not isinstance(thread, str) or not thread:
        return thread
    m = _LOOSE_THREAD_RE.match(thread)
    if not m:
        return thread
    return "hermes-" + canon_row(m.group(1))


def is_miscased(thread) -> bool:
    """True when `thread` is a row thread whose canonical spelling differs from what was stored."""
    return isinstance(thread, str) and bool(thread) and canon_thread(thread) != thread


def row_of(thread):
    """The canonical row id of a row thread (`hermes-iso-f13` -> `ISO-F13`), else None."""
    c = canon_thread(thread)
    m = THREAD_RE.match(c) if isinstance(c, str) else None
    return m.group(1) if m else None
