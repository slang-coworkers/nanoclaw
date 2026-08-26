"""Regression tests for create_or_update_file's blob-SHA lookup.

WHAT WENT WRONG, AND WHY NO TEST CAUGHT IT

`get_file_contents` was defined twice in src/github/github.py. The pydantic-args
export at line ~1983 shadowed the 4-positional-arg helper at ~1622, so this call
inside create_or_update_file raised TypeError on EVERY invocation:

    existing_file = await get_file_contents(owner, repo, path, branch)

The surrounding `except Exception` caught it and logged "File does not exist,
will create new file". `current_sha` stayed None, the PUT went out with no `sha`,
and GitHub's contents API requires one to update a file in place. So updating an
existing file through this tool could not work — and it reported the failure as
the file being absent. A wrong answer wearing the costume of a diagnosis.

THE SHAPE OF THE TEST MATTERS

A test that merely asserts "the call returns without raising" PASSES against the
broken version, because the broken version swallowed its own TypeError and
returned normally. The assertion has to be on the OUTGOING REQUEST: updating an
existing file must send a `sha`. That is the only thing that distinguishes
working from broken here.

The fix renamed the helper to `_get_file_contents_raw`; these tests pin the
behaviour rather than the name, except where the arity itself is the point.
"""

import inspect
from unittest.mock import patch

import pytest

from src.github.github import (
    CreateOrUpdateFileArgs,
    _get_file_contents_raw,
    create_or_update_file,
)

ARGS = dict(
    owner="shader-slang",
    repo="slang",
    path="docs/thing.md",
    content="hello",
    message="update thing",
    branch="main",
)


def _dispatch(get_result=None, get_raises=None):
    """github_request stub that answers GET and PUT differently.

    Returns (side_effect, calls) where calls records every (method, url, kwargs)
    so a test can assert on what was actually sent to GitHub.
    """
    calls = []

    async def side_effect(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if method == "GET":
            if get_raises is not None:
                raise get_raises
            return get_result
        return {"content": {"path": ARGS["path"]}, "commit": {"sha": "newcommit"}}

    return side_effect, calls


def _put_body(calls):
    for method, _url, kwargs in calls:
        if method == "PUT":
            return kwargs.get("json") or {}
    raise AssertionError("no PUT was made")


@pytest.mark.asyncio
async def test_updating_an_existing_file_sends_its_sha():
    """THE regression test. Broken code omitted `sha` and silently created."""
    side_effect, calls = _dispatch(get_result={"sha": "abc123", "path": ARGS["path"]})
    with patch("src.github.github.github_request", side_effect=side_effect):
        await create_or_update_file(CreateOrUpdateFileArgs(**ARGS))

    body = _put_body(calls)
    assert body.get("sha") == "abc123", (
        "PUT must carry the existing blob sha — without it GitHub cannot update "
        "the file in place, which is the bug this test exists for"
    )


@pytest.mark.asyncio
async def test_creating_a_new_file_omits_sha():
    """A genuinely absent file must still create — the fix must not overcorrect."""
    side_effect, calls = _dispatch(get_raises=RuntimeError("404 Not Found"))
    with patch("src.github.github.github_request", side_effect=side_effect):
        await create_or_update_file(CreateOrUpdateFileArgs(**ARGS))

    assert "sha" not in _put_body(calls)


@pytest.mark.asyncio
async def test_an_explicit_sha_skips_the_lookup_entirely():
    side_effect, calls = _dispatch(get_result={"sha": "fromlookup"})
    with patch("src.github.github.github_request", side_effect=side_effect):
        await create_or_update_file(CreateOrUpdateFileArgs(**ARGS, sha="caller-supplied"))

    assert _put_body(calls)["sha"] == "caller-supplied"
    assert not [c for c in calls if c[0] == "GET"], "no lookup needed when the caller supplied a sha"


@pytest.mark.asyncio
async def test_lookup_returning_a_non_dict_does_not_fabricate_a_sha():
    """Defensive: the caller guards with isinstance(existing_file, dict)."""
    side_effect, calls = _dispatch(get_result=["unexpected", "shape"])
    with patch("src.github.github.github_request", side_effect=side_effect):
        await create_or_update_file(CreateOrUpdateFileArgs(**ARGS))

    assert "sha" not in _put_body(calls)


def test_the_raw_helper_takes_four_positional_args():
    """Pins the arity directly — this is what the duplicate definition broke.

    If a future edit reintroduces a pydantic-args function under this name, the
    caller's 4-positional call starts raising TypeError again and gets swallowed
    by the same `except Exception`. Asserting the signature catches that at the
    definition rather than waiting for a silent wrong answer in production.
    """
    params = list(inspect.signature(_get_file_contents_raw).parameters)
    assert params == ["owner", "repo", "path", "branch"]
