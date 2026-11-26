"""Mention parsing for GitLab notes.

Rules (see container/spines/khr/PORT.md, "Bounded-context rules"):

- The mention must name the full account, case-insensitively. It must not be
  preceded by a word character or ``@``, and must be followed by whitespace,
  ``,``, ``:`` or end of line.
- Lines inside fenced code (``` or ~~~), blockquote lines (``>``) and inline
  code spans never match.
- The request is the rest of the line after the mention, plus every following
  line. One leading ``,`` or ``:`` and surrounding whitespace are stripped.
  Text before the mention is context, not request.
- An empty request is rejected.
- An optional leading ``{model=<alias>}`` block picks a model from a fixed
  alias set. An unknown alias rejects the request.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_FENCE_RE = re.compile(r"^\s{0,3}(```|~~~)")
_INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
_MODEL_RE = re.compile(r"^\{\s*model\s*=\s*([A-Za-z0-9._-]+)\s*\}\s*")


@dataclass(frozen=True)
class Mention:
    """A parsed command, or a rejection with a reason."""

    command: str | None
    model: str | None
    context: str
    rejected: str | None = None


def _mask_inline_code(line: str) -> str:
    return _INLINE_CODE_RE.sub(lambda m: " " * len(m.group(0)), line)


def parse_mention(
    body: str, account: str, model_aliases: frozenset[str] = frozenset()
) -> Mention | None:
    """Return the first eligible mention in ``body``, or None when there is none.

    ``account`` is the bare account name, without ``@``.
    """
    if not account or account.startswith("@"):
        raise ValueError("account must be a bare name without '@'")
    tag = re.compile(
        r"(?<![\w@])@" + re.escape(account) + r"(?=$|[\s,:])", re.IGNORECASE
    )

    lines = body.split("\n")
    in_fence = False
    for index, line in enumerate(lines):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence or line.lstrip().startswith(">"):
            continue
        match = tag.search(_mask_inline_code(line))
        if not match:
            continue

        before = "\n".join([*lines[:index], line[: match.start()]]).strip()
        rest = "\n".join([line[match.end() :], *lines[index + 1 :]])
        rest = rest.lstrip()
        if rest[:1] in {",", ":"}:
            rest = rest[1:]
        rest = rest.strip()

        model = None
        model_match = _MODEL_RE.match(rest)
        if model_match:
            model = model_match.group(1).lower()
            rest = rest[model_match.end() :].strip()
            if model not in model_aliases:
                return Mention(None, model, before, rejected="unknown-model")
        if not rest:
            return Mention(None, model, before, rejected="empty-command")
        return Mention(rest, model, before)
    return None
