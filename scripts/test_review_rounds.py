#!/usr/bin/env python3
"""Tests for review-rounds.py (review-cycles v2), the producer behind the
dashboard's "human review per PR, bot vs human" panel.

Every test pins a way the v1 number was confidently WRONG on prod rather than
obviously broken: workflow automation posted from a user account counted as human
review, one PR defining a whole week, months of design review landing in a single
merge week. Fixtures are synthetic GraphQL PullRequest nodes; no network.
Run: python3 -m unittest scripts/test_review_rounds.py
"""

import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

SCRIPT = Path(__file__).resolve().parent / "review-rounds.py"
_spec = importlib.util.spec_from_file_location("review_rounds", SCRIPT)
rr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rr)

REPO = "shader-slang/slang"
SINCE = "2026-04-10"
BOT = {"login": "nv-slang-bot", "__typename": "Bot"}
BOARD_SYNC_BODY = ("<!-- pr-board-sync-assignment --> **Automated notice** (PR board sync) - "
                   "do not reply to this comment. Auto-assigned @jkwak-work as reviewer.")


def actor(login, typename="User"):
    return {"login": login, "__typename": typename}


def comment(login, body, at, typename="User", url=None):
    return {"id": f"{login}-{at}-{abs(hash(body)) % 10000}", "body": body, "createdAt": at,
            "url": url or f"https://github.com/{REPO}/pull/1#c-{at}",
            "author": actor(login, typename) if login is not None else None}


def thread(*comments):
    return {"comments": {"totalCount": len(comments), "nodes": list(comments)}}


def review(login, state, at, typename="User"):
    return {"state": state, "submittedAt": at,
            "author": actor(login, typename) if login is not None else None}


def _stamps(reviews, threads, comments):
    out = []
    for r in reviews:
        if r.get("submittedAt"):
            out.append(r["submittedAt"])
    for t in threads:
        out += [c["createdAt"] for c in t["comments"]["nodes"]]
    out += [c["createdAt"] for c in comments]
    return out


def pr_node(number, author, created, merged=None, closed=None, reviews=(), threads=(),
            comments=(), title="fix", updated=None, repo=REPO):
    """A GraphQL PullRequest node. `author` is an actor dict or a login string."""
    if isinstance(author, str):
        author = actor(author)
    reviews, threads, comments = list(reviews), list(threads), list(comments)
    state = "MERGED" if merged else ("CLOSED" if closed else "OPEN")
    stamps = [created, merged or "", closed or ""] + _stamps(reviews, threads, comments)
    return {
        "number": number, "title": title, "url": f"https://github.com/{repo}/pull/{number}",
        "state": state, "createdAt": created, "updatedAt": updated or max(stamps),
        "mergedAt": merged, "closedAt": merged or closed, "author": author,
        "reviews": {"totalCount": len(reviews), "nodes": reviews},
        "reviewThreads": {"totalCount": len(threads), "nodes": threads},
        "comments": {"totalCount": len(comments), "nodes": comments},
    }


def facts(node, since=SINCE):
    return rr.pr_facts(node, REPO, f"{since}T00:00:00Z")


def snapshot(nodes, since=SINCE, repos=(REPO,)):
    return rr.build_snapshot({REPO: list(nodes)}, since, list(repos))


def by_week(rows, week):
    for r in rows:
        if r["week"] == week:
            return r
    raise AssertionError(f"no row for week {week}; have {[r['week'] for r in rows]}")


def write_fixture(nodes_by_repo):
    """A --fixture file: {repo: [raw GraphQL PR nodes]}. Returns its path."""
    d = tempfile.mkdtemp()
    path = os.path.join(d, "fixture.json")
    with open(path, "w") as f:
        json.dump(nodes_by_repo, f)
    return path


class TestAutomationFilter(unittest.TestCase):
    """Spec item 2: only VALID human feedback survives, and every removal is counted."""

    def test_board_sync_notices_are_removed_as_automation_including_duplicates(self):
        # Prod: 66 of 198 counted "human" cycles on bot PRs were these notices,
        # posted from a USER account (PAT), 26 of them duplicated seconds apart.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:00:00Z"),
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:00:02Z"),
            comment("jhelferty-nv", "**PR board sync:** auto-assigned @jkwak-work", "2026-08-22T00:00:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["comments"], 0)
        self.assertEqual(f["removedAutomation"], 3)
        self.assertEqual(f["removed"], {"automation": 3, "commands": 0, "duplicates": 0, "self": 0})
        self.assertEqual(f["_reasons"], {"boardSyncNotice": 3})
        self.assertEqual(f["_byLogin"], {"jhelferty-nv": 3})
        self.assertEqual(f["reviewers"], [])

    def test_user_typed_bot_accounts_and_bot_suffixes_are_removed(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("CLAassistant", "CLA assistant check: all committers have signed.", "2026-08-21T00:00:00Z"),
            comment("slangbot", "Build passed.", "2026-08-21T00:01:00Z"),
            comment("coderabbitai", "Walkthrough: ...", "2026-08-21T00:02:00Z"),
            comment("qodo-merge-pro[bot]", "PR Reviewer Guide", "2026-08-21T00:03:00Z", typename="Bot"),
            comment("qodo-code-review", "Suggestions", "2026-08-21T00:04:00Z"),
            comment("github-actions[bot]", "CI report", "2026-08-21T00:05:00Z", typename="Bot"),
            comment("dependabot", "bump", "2026-08-21T00:06:00Z"),
            comment(None, "ghost", "2026-08-21T00:07:00Z"),
            comment("jkwak-work", "Please add a test for the negative case.", "2026-08-21T00:08:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["comments"], 1)
        self.assertEqual(f["removedAutomation"], 8)
        self.assertEqual(f["_reasons"], {"botLogin": 7, "ghost": 1})
        self.assertIn("claassistant", f["_byLogin"])
        self.assertIn("slangbot", f["_byLogin"])
        self.assertIn("qodo-merge-pro", f["_byLogin"])
        self.assertEqual(f["reviewers"], ["jkwak-work"])

    def test_dispatch_commands_are_removed_but_substantive_mentions_are_kept(self):
        long_ask = ("@nv-slang-bot can you fix the build issues? Also, we need to also revert this "
                    "PR: https://github.com/shader-slang/slang/pull/11556. This PR implements "
                    "getDownstreamCompilerVersion which is useless with the new API.")
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jvepsalainen-nv", "@coderabbitai review", "2026-08-21T00:00:00Z"),
            comment("jvepsalainen-nv", "@nv-slang-bot review this PR", "2026-08-21T00:01:00Z"),
            comment("jkwak-work", "@nv-slang-bot can you resolve the merge conflict and rebase?", "2026-08-21T00:02:00Z"),
            comment("jvepsalainen-nv", "@coderabbitai review @nv-slang-bot verification pass", "2026-08-21T00:03:00Z"),
            comment("kaizhangNV", long_ask, "2026-08-21T00:04:00Z"),
            comment("jkwak-work", "@nv-slang-bot " + "please review the design carefully, " * 4 + "then rebase.",
                    "2026-08-21T00:05:00Z"),  # > 120 chars: not a bare dispatch
            # Real #12186 comment: "re-review" is a review that mentions the bot,
            # not a command. The spec's literal \b(review|rebase)\b matched it.
            comment("pdeayton-nv", "@nv-slang-bot , make any changes you want, I'll re-review and approve after",
                    "2026-08-21T00:06:00Z"),
            comment("pdeayton-nv", "@nv-slang-bot please check my previous comments", "2026-08-21T00:07:00Z"),
            comment("jvepsalainen-nv", "@nv-slang-bot @coderabbit review this PR", "2026-08-21T00:08:00Z"),  # real #12863
        ])
        f = facts(node)
        self.assertEqual(f["removed"]["commands"], 5)
        self.assertEqual(f["comments"], 4)
        self.assertEqual(sorted(f["reviewers"]), ["jkwak-work", "kaizhangnv", "pdeayton-nv"])
        self.assertTrue(rr.is_dispatch_command("@nv-slang-bot @coderabbit review this PR"))
        self.assertFalse(rr.is_dispatch_command("@nv-slang-bot , make any changes you want, I'll re-review and approve after"))
        self.assertFalse(rr.is_dispatch_command("@nv-slang-bot please check my previous comments"))

    def test_the_pr_authors_own_comments_and_reviews_are_self_not_review(self):
        node = pr_node(1, "Alice", "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                       reviews=[review("alice", "COMMENTED", "2026-08-21T00:00:00Z"),
                                review("bob", "APPROVED", "2026-08-22T00:00:00Z")],
                       comments=[comment("alice", "Addressed in the latest push.", "2026-08-21T00:00:00Z"),
                                 comment("ALICE", "Rebased.", "2026-08-21T00:01:00Z"),
                                 comment("bob", "Looks good, thanks.", "2026-08-22T00:00:00Z")])
        f = facts(node)
        self.assertEqual(f["authorClass"], "human")
        self.assertEqual(f["removed"]["self"], 2)
        self.assertEqual(f["reviewsRemoved"], {"automation": 0, "self": 1})
        self.assertEqual(f["comments"], 1)
        self.assertEqual(f["rounds"], 1)
        self.assertEqual(f["reviewers"], ["bob"])

    def test_our_bots_own_comments_on_its_pr_are_self_under_either_spelling(self):
        # 164 of the 404 comments on the 43 sampled prod PRs were the bot replying
        # on its own PRs. Booked as automation they swamped removedAutomation, so
        # a reader could not tell two board-sync notices from ten bot replies.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("nv-slang-bot[bot]", "Pushed a fix.", "2026-08-21T00:00:00Z", typename="Bot"),
            comment("nv-slang-bot", "Pushed another fix.", "2026-08-21T00:01:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["authorClass"], "bot")
        self.assertEqual(f["comments"], 0)
        self.assertEqual(f["removed"]["self"], 2)
        self.assertEqual(f["removedAutomation"], 0)
        # On someone else's PR the same account is automation, not self.
        other = pr_node(2, "alice", "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("nv-slang-bot[bot]", "Opened #3 to fix this.", "2026-08-21T00:00:00Z", typename="Bot"),
        ])
        g = facts(other)
        self.assertEqual(g["removed"]["self"], 0)
        self.assertEqual(g["removedAutomation"], 1)
        self.assertEqual(g["_byLogin"], {"nv-slang-bot": 1})

    def test_a_human_quote_replying_the_notice_is_kept(self):
        # GitHub's quote reply carries the raw markdown of the notice, HTML
        # comment included; the marker must not swallow the human's question.
        quoted = "> " + BOARD_SYNC_BODY + "\n\nWhy was I assigned as shepherd?"
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:00:00Z"),
            comment("jkwak-work", quoted, "2026-08-21T00:05:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["comments"], 1)
        self.assertEqual(f["removedAutomation"], 1)
        self.assertEqual(f["classification"]["question"], 1)
        self.assertEqual(f["reviewers"], ["jkwak-work"])

    def test_the_board_sync_prefix_is_matched_case_insensitively(self):
        self.assertTrue(rr.is_board_sync_notice("**PR Board Sync:** auto-assigned @jkwak-work"))
        self.assertTrue(rr.is_board_sync_notice("  **PR board sync:** auto-assigned @jkwak-work"))
        self.assertTrue(rr.is_board_sync_notice(BOARD_SYNC_BODY))
        self.assertFalse(rr.is_board_sync_notice("The PR board sync assigned me; is that right?"))
        self.assertFalse(rr.is_board_sync_notice(None))

    def test_identical_bodies_by_the_same_author_within_60s_are_deduped(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jkwak-work", "Remove this comment.", "2026-08-21T00:00:00Z"),
            comment("jkwak-work", "Remove this comment.", "2026-08-21T00:00:30Z"),   # duplicate
            comment("jkwak-work", "Remove this comment.", "2026-08-21T00:10:00Z"),   # a new nit, 10 min later
            comment("pdeayton-nv", "Remove this comment.", "2026-08-21T00:00:31Z"),  # other author, kept
        ])
        f = facts(node)
        self.assertEqual(f["removed"]["duplicates"], 1)
        self.assertEqual(f["comments"], 3)

    def test_bot_reviews_never_make_rounds(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("coderabbitai", "COMMENTED", "2026-08-21T00:00:00Z"),
            review("copilot-pull-request-reviewer[bot]", "COMMENTED", "2026-08-21T00:00:00Z", typename="Bot"),
            review("qodo-merge-pro[bot]", "COMMENTED", "2026-08-21T00:00:00Z", typename="Bot"),
        ])
        f = facts(node)
        self.assertEqual(f["rounds"], 0)
        self.assertEqual(f["reviewsRemoved"]["automation"], 3)


class TestRounds(unittest.TestCase):
    """Spec item 3: a round is a human review SESSION."""

    def test_three_submissions_in_twenty_minutes_are_one_round(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "COMMENTED", "2026-08-21T10:10:00Z"),
            review("jkwak-work", "CHANGES_REQUESTED", "2026-08-21T10:20:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["rounds"], 1)
        self.assertEqual(f["submissions"], 3)
        self.assertEqual(f["changesRequested"], 1)

    def test_a_gap_over_thirty_minutes_starts_a_new_round(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "COMMENTED", "2026-08-21T10:45:00Z"),
        ])
        self.assertEqual(facts(node)["rounds"], 2)

    def test_the_collapse_chains_from_the_previous_submission(self):
        # 10:00, 10:25, 10:50: each gap is 25 min, so one session even though the
        # last is 50 min after the first.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "COMMENTED", "2026-08-21T10:25:00Z"),
            review("jkwak-work", "APPROVED", "2026-08-21T10:50:00Z"),
        ])
        self.assertEqual(facts(node)["rounds"], 1)

    def test_a_review_with_five_inline_comments_is_one_round_and_five_comments(self):
        at = "2026-08-21T10:00:00Z"
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                       reviews=[review("jkwak-work", "CHANGES_REQUESTED", at)],
                       threads=[thread(comment("jkwak-work", f"Remove this comment ({i}).", at)) for i in range(5)])
        f = facts(node)
        self.assertEqual(f["rounds"], 1)
        self.assertEqual(f["comments"], 5)
        self.assertEqual(f["inlineComments"], 5)
        self.assertEqual(f["threads"], 5)
        self.assertEqual(f["conversationComments"], 0)

    def test_whole_threads_count_every_human_reply_not_just_the_opener(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", threads=[
            thread(comment("jkwak-work", "Why is this branch needed?", "2026-08-21T10:00:00Z"),
                   comment("nv-slang-bot", "Because the SPIR-V path differs.", "2026-08-21T10:05:00Z", typename="Bot"),
                   comment("pdeayton-nv", "Agreed, but please add a comment explaining it.", "2026-08-21T11:00:00Z")),
        ])
        f = facts(node)
        self.assertEqual(f["comments"], 2)
        self.assertEqual(f["threads"], 1)
        # The bot's reply on its own PR is self, not automation.
        self.assertEqual(f["removed"]["self"], 1)
        self.assertEqual(f["removedAutomation"], 0)

    def test_three_submissions_over_two_hours_count_by_gap_not_by_span(self):
        # 10:00 / 10:20 / 12:00: the first two chain, the third opens a new session.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "COMMENTED", "2026-08-21T10:20:00Z"),
            review("jkwak-work", "APPROVED", "2026-08-21T12:00:00Z"),
        ])
        self.assertEqual(facts(node)["rounds"], 2)
        # 10:00 / 11:00 / 12:00: every gap is over 30 minutes, three sessions.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "COMMENTED", "2026-08-21T11:00:00Z"),
            review("jkwak-work", "APPROVED", "2026-08-21T12:00:00Z"),
        ])
        self.assertEqual(facts(node)["rounds"], 3)

    def test_two_reviewers_at_the_same_minute_are_two_rounds(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "APPROVED", "2026-08-21T10:00:00Z"),
            review("pdeayton-nv", "COMMENTED", "2026-08-21T10:00:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["rounds"], 2)
        self.assertEqual(f["reviewers"], ["jkwak-work", "pdeayton-nv"])

    def test_approved_and_dismissed_are_rounds_and_pending_is_not(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "APPROVED", "2026-08-21T10:00:00Z"),
            review("pdeayton-nv", "PENDING", "2026-08-21T12:00:00Z"),
            review("csyonghe", "DISMISSED", "2026-08-21T13:00:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["rounds"], 2)
        self.assertEqual(f["submissions"], 2)
        self.assertEqual(f["reviewers"], ["csyonghe", "jkwak-work"])

    def test_a_dismissed_review_is_still_a_round(self):
        # Prod #12186: pdeayton-nv's "LGTM" of 07-23 was auto-dismissed by the
        # next push. It was published and it was a review session; ignoring it
        # loses the round AND lets a later dismissal rewrite a past week.
        node = pr_node(12186, BOT, "2026-07-06T10:00:00Z", merged="2026-09-02T16:50:00Z",
                       reviews=[review("pdeayton-nv", "DISMISSED", "2026-07-23T10:00:00Z")])
        f = facts(node)
        self.assertEqual(f["rounds"], 1)
        self.assertEqual(f["changesRequested"], 0)  # strict: the pre-dismiss state is not exposed
        self.assertEqual(f["submissions"], 1)
        self.assertEqual(f["reviewers"], ["pdeayton-nv"])
        self.assertEqual(f["activityByWeek"], {"2026-07-20": {"rounds": 1, "comments": 0}})

    def test_a_dismissal_within_thirty_minutes_of_an_approval_is_the_same_round(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=[
            review("jkwak-work", "APPROVED", "2026-08-21T10:00:00Z"),
            review("jkwak-work", "DISMISSED", "2026-08-21T10:20:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["rounds"], 1)
        self.assertEqual(f["submissions"], 2)


class TestAttribution(unittest.TestCase):
    """Spec item 4: activity week is primary; merge week is kept for comparison."""

    def design_review(self):
        # Opened in July, discussed in July, merged in September. v1 charged the
        # whole discussion to the September merge week.
        return pr_node(12186, BOT, "2026-07-06T10:00:00Z", merged="2026-09-02T16:50:00Z",
                       reviews=[review("jkwak-work", "COMMENTED", "2026-07-08T10:00:00Z"),
                                review("pdeayton-nv", "CHANGES_REQUESTED", "2026-07-09T10:00:00Z")],
                       threads=[thread(comment("jkwak-work", "Remove this comment.", "2026-07-08T10:00:00Z")),
                                thread(comment("pdeayton-nv", "There is a latent bug here; please select the opcode by isCombined().",
                                               "2026-07-09T10:00:00Z"))],
                       comments=[comment("csyonghe", "How does this interact with the descriptor heap path?",
                                         "2026-07-10T10:00:00Z")])

    def test_merge_week_series_charges_the_whole_pr_to_the_merge_week(self):
        doc = snapshot([self.design_review()])
        self.assertEqual([r["week"] for r in doc["weeklyByMerge"]], ["2026-08-31"])
        bot = doc["weeklyByMerge"][0]["botAuthored"]
        self.assertEqual(bot["prs"], 1)
        self.assertEqual(bot["rounds"]["total"], 2)
        self.assertEqual(bot["comments"]["total"], 3)
        self.assertEqual(doc["weeklyByMerge"][0]["humanAuthored"]["prs"], 0)

    def test_activity_week_series_puts_the_review_where_it_happened(self):
        doc = snapshot([self.design_review()])
        weeks = [r["week"] for r in doc["weeklyByActivity"]]
        # Created + reviewed in the week of 07-06; merged in the week of 08-31.
        # Nothing in between: an idle PR does not pad the weeks it sat open.
        self.assertEqual(weeks, ["2026-07-06", "2026-08-31"])
        july = by_week(doc["weeklyByActivity"], "2026-07-06")["botAuthored"]
        self.assertEqual(july["prs"], 1)
        self.assertEqual(july["prsWithActivity"], 1)
        self.assertEqual(july["rounds"]["total"], 2)
        self.assertEqual(july["comments"]["total"], 3)
        sept = by_week(doc["weeklyByActivity"], "2026-08-31")["botAuthored"]
        self.assertEqual(sept["prs"], 1)  # touched by the merge, so it is in N ...
        self.assertEqual(sept["prsWithActivity"], 0)
        self.assertEqual(sept["rounds"]["total"], 0)  # ... but contributes zero review
        self.assertEqual(sept["comments"]["mean"], 0)

    def test_open_and_closed_prs_are_in_the_activity_series_but_not_the_merge_series(self):
        open_pr = pr_node(2, BOT, "2026-08-20T10:00:00Z",
                          reviews=[review("jkwak-work", "COMMENTED", "2026-08-21T10:00:00Z")])
        closed_pr = pr_node(3, BOT, "2026-08-20T10:00:00Z", closed="2026-08-27T10:00:00Z",
                            comments=[comment("pdeayton-nv", "Superseded by #4, closing.", "2026-08-27T09:00:00Z")])
        doc = snapshot([open_pr, closed_pr])
        self.assertEqual(doc["weeklyByMerge"], [])
        self.assertEqual(doc["weekly"], [])
        # Week of 08-17: both created, the open one reviewed. Week of 08-24: the
        # closed one drew its comment and was closed.
        wk = by_week(doc["weeklyByActivity"], "2026-08-17")["botAuthored"]
        self.assertEqual(wk["prs"], 2)
        self.assertEqual(wk["rounds"]["total"], 1)
        self.assertEqual(wk["comments"]["total"], 0)
        wk2 = by_week(doc["weeklyByActivity"], "2026-08-24")["botAuthored"]
        self.assertEqual(wk2["prs"], 1)
        self.assertEqual(wk2["comments"]["total"], 1)
        states = {p["number"]: p["state"] for p in doc["perPR"]}
        self.assertEqual(states, {2: "open", 3: "closed"})
        self.assertEqual(doc["totals"]["openPrs"], 1)
        self.assertEqual(doc["totals"]["closedPrs"], 1)

    def test_events_before_since_count_in_the_pr_but_are_not_bucketed(self):
        node = pr_node(5, BOT, "2026-03-01T10:00:00Z", merged="2026-04-15T10:00:00Z",
                       comments=[comment("jkwak-work", "Please add a test.", "2026-03-05T10:00:00Z")])
        doc = snapshot([node])
        self.assertEqual(doc["perPR"][0]["comments"], 1)
        self.assertEqual(doc["perPR"][0]["activityByWeek"], {})
        self.assertEqual([r["week"] for r in doc["weeklyByActivity"]], ["2026-04-13"])
        self.assertEqual(doc["weeklyByActivity"][0]["botAuthored"]["comments"]["total"], 0)
        self.assertEqual(doc["weeklyByMerge"][0]["botAuthored"]["comments"]["total"], 1)

    def test_a_pr_last_updated_before_since_is_outside_the_window(self):
        stale = pr_node(6, BOT, "2026-01-01T10:00:00Z", merged="2026-02-01T10:00:00Z")
        self.assertFalse(rr.in_window(stale, f"{SINCE}T00:00:00Z"))
        still_open = pr_node(7, BOT, "2026-01-01T10:00:00Z", updated="2026-05-01T00:00:00Z")
        self.assertTrue(rr.in_window(still_open, f"{SINCE}T00:00:00Z"))
        self.assertEqual(snapshot([stale, still_open])["totals"]["prs"], 1)

    def test_low_n_is_flagged_so_the_chart_cannot_plot_one_pr_as_a_week(self):
        # Prod week 2026-09-07: exactly one merged bot PR read as "7.0 cycles".
        lone = pr_node(12879, BOT, "2026-09-01T10:00:00Z", merged="2026-09-08T23:12:00Z",
                       reviews=[review("jkwak-work", "COMMENTED", "2026-09-08T10:00:00Z")])
        busy = [pr_node(100 + i, BOT, "2026-08-24T10:00:00Z", merged=f"2026-08-2{5 + i % 3}T10:00:00Z")
                for i in range(5)]
        doc = snapshot([lone] + busy)
        sep = by_week(doc["weeklyByMerge"], "2026-09-07")["botAuthored"]
        self.assertEqual(sep["prs"], 1)
        self.assertTrue(sep["lowN"])
        aug = by_week(doc["weeklyByMerge"], "2026-08-24")["botAuthored"]
        self.assertEqual(aug["prs"], 5)
        self.assertFalse(aug["lowN"])
        self.assertTrue(by_week(doc["weeklyByActivity"], "2026-09-07")["botAuthored"]["lowN"])
        self.assertEqual(doc["definition"]["minN"] if "definition" in doc else rr.MIN_N, 5)

    def test_legacy_alias_keeps_the_v1_shape_and_matches_the_legacy_block(self):
        doc = snapshot([self.design_review()])
        self.assertEqual(len(doc["weekly"]), 1)
        row = doc["weekly"][0]
        self.assertEqual(row["week"], "2026-08-31")
        self.assertEqual(sorted(row["botAuthored"]), sorted([
            "prs", "avgCycles", "medianCycles", "p90Cycles", "avgRounds", "medianRounds",
            "p90Rounds", "zeroRoundPct", "avgSubmissions", "avgThreads", "avgIssueComments"]))
        self.assertEqual(row["botAuthored"], doc["weeklyByMerge"][0]["botAuthored"]["legacy"])
        # cycles = 2 human-initiated threads + 1 conversation comment (v1 headline)
        self.assertEqual(row["botAuthored"]["avgCycles"], 3)
        # v1 "rounds" = strict CHANGES_REQUESTED, not the v2 session index
        self.assertEqual(row["botAuthored"]["avgRounds"], 1)
        self.assertEqual(row["botAuthored"]["avgSubmissions"], 2)
        # The v1 names also sit at class level on totals and the merge rows, so
        # the old panel's totals strip (which reads totals.botAuthored.avgCycles
        # directly) keeps rendering during rollout, not only its chart.
        bt = doc["totals"]["botAuthored"]
        self.assertEqual(bt["avgCycles"], bt["legacy"]["avgCycles"])
        self.assertEqual(bt["avgSubmissions"], bt["legacy"]["avgSubmissions"])
        self.assertEqual(bt["avgRounds"], bt["legacy"]["avgRounds"])
        self.assertEqual(bt["avgCycles"], 3)
        self.assertEqual(doc["weeklyByMerge"][0]["botAuthored"]["avgRounds"], 1)
        self.assertNotIn("partial", row)  # the v1 alias keeps the v1 shape

    def test_automation_authored_prs_are_listed_but_excluded_from_both_classes(self):
        dep = pr_node(8, actor("dependabot[bot]", "Bot"), "2026-08-20T10:00:00Z", merged="2026-08-21T10:00:00Z",
                      reviews=[review("jkwak-work", "APPROVED", "2026-08-21T09:00:00Z")])
        slangbot = pr_node(9, "slangbot", "2026-08-20T10:00:00Z", merged="2026-08-21T10:00:00Z")
        human = pr_node(10, "alice", "2026-08-20T10:00:00Z", merged="2026-08-21T10:00:00Z")
        doc = snapshot([dep, slangbot, human])
        t = doc["totals"]
        self.assertEqual(t["automationAuthoredPrs"], 2)
        self.assertEqual(t["botAuthored"]["prs"], 0)
        self.assertEqual(t["humanAuthored"]["prs"], 1)
        classes = {p["number"]: p["authorClass"] for p in doc["perPR"]}
        self.assertEqual(classes, {8: "automation", 9: "automation", 10: "human"})
        wk = by_week(doc["weeklyByMerge"], "2026-08-17")
        self.assertEqual(wk["humanAuthored"]["prs"], 1)
        self.assertEqual(wk["botAuthored"]["prs"], 0)

    def test_every_requested_repo_is_present_in_per_repo_even_when_empty(self):
        doc = rr.build_snapshot({REPO: [self.design_review()]}, SINCE, rr.DEFAULT_REPOS)
        self.assertEqual(sorted(doc["perRepo"]), sorted(rr.DEFAULT_REPOS))
        self.assertEqual(len(rr.DEFAULT_REPOS), 7)
        empty = doc["perRepo"]["shader-slang/slang-playground"]
        self.assertEqual(empty["totals"]["prs"], 0)
        self.assertEqual(empty["weeklyByActivity"], [])
        self.assertEqual(doc["perRepo"][REPO]["totals"]["prs"], 1)

    def test_activity_weeks_bucket_across_month_and_year_boundaries(self):
        # Saturday 2026-08-01 belongs to Monday 2026-07-27; Friday 2027-01-01 to
        # Monday 2026-12-28; Sunday 2026-05-03 to Monday 2026-04-27.
        self.assertEqual(rr.week_of("2026-08-01T12:00:00Z"), "2026-07-27")
        self.assertEqual(rr.week_of("2027-01-01T00:00:00Z"), "2026-12-28")
        self.assertEqual(rr.week_of("2026-05-03T23:59:59Z"), "2026-04-27")
        node = pr_node(1, BOT, "2026-07-30T10:00:00Z", comments=[
            comment("jkwak-work", "Please add a test.", "2026-08-01T12:00:00Z"),
            comment("jkwak-work", "Why this branch?", "2026-08-03T00:00:00Z"),
        ])
        doc = snapshot([node])
        self.assertEqual([r["week"] for r in doc["weeklyByActivity"]], ["2026-07-27", "2026-08-03"])
        self.assertEqual(by_week(doc["weeklyByActivity"], "2026-07-27")["botAuthored"]["comments"]["total"], 1)
        self.assertEqual(by_week(doc["weeklyByActivity"], "2026-08-03")["botAuthored"]["comments"]["total"], 1)

    def test_the_window_start_week_and_the_current_week_are_flagged_partial(self):
        # --since 2026-04-10 is a Friday, so the first row covers three days; the
        # week containing generatedAt is always in progress. Neither is a full
        # week and both are flagged so the chart can draw them hollow.
        early = pr_node(1, BOT, "2026-04-10T10:00:00Z", merged="2026-04-11T10:00:00Z")
        cur = pr_node(2, BOT, "2026-08-25T10:00:00Z", merged="2026-09-09T10:00:00Z")
        doc = rr.build_snapshot({REPO: [early, cur]}, SINCE, [REPO], now="2026-09-09T13:00:00Z")
        for series in ("weeklyByActivity", "weeklyByMerge"):
            first = by_week(doc[series], "2026-04-06")
            self.assertTrue(first["partial"])
            self.assertEqual(first["partialReasons"], ["window-start"])
            last = by_week(doc[series], "2026-09-07")
            self.assertTrue(last["partial"])
            self.assertEqual(last["partialReasons"], ["in-progress"])
        middle = by_week(doc["weeklyByActivity"], "2026-08-24")
        self.assertFalse(middle["partial"])
        self.assertNotIn("partialReasons", middle)
        self.assertIn("partial", rr.DEFINITION["attribution"])

    def test_a_monday_since_has_no_window_start_partial(self):
        node = pr_node(1, BOT, "2026-04-13T10:00:00Z", merged="2026-04-14T10:00:00Z")
        doc = rr.build_snapshot({REPO: [node]}, "2026-04-13", [REPO], now="2026-09-09T13:00:00Z")
        self.assertFalse(by_week(doc["weeklyByActivity"], "2026-04-13")["partial"])
        self.assertFalse(by_week(doc["weeklyByMerge"], "2026-04-13")["partial"])

    def test_stats_are_mean_median_p90_and_n(self):
        prs = [pr_node(20 + i, BOT, "2026-08-18T10:00:00Z", merged="2026-08-20T10:00:00Z",
                       comments=[comment("jkwak-work", f"Please fix item {j}.", f"2026-08-19T10:{j:02d}:00Z")
                                 for j in range(n)])
               for i, n in enumerate([0, 0, 1, 2, 10])]
        wk = by_week(snapshot(prs)["weeklyByMerge"], "2026-08-17")["botAuthored"]
        self.assertEqual(wk["comments"], {"n": 5, "total": 13, "mean": 2.6, "median": 1, "p90": 10, "zeroPct": 40.0})
        self.assertEqual(wk["rounds"]["n"], 5)
        self.assertEqual(wk["rounds"]["mean"], 0)


class TestClassification(unittest.TestCase):
    """Spec item 5: one heuristic label per valid comment."""

    def test_each_category(self):
        cases = {
            "Why is this branch needed?": "question",
            "Could you select the opcode based on isCombined()": "question",
            "What about kIROp_MakeStruct": "question",
            "Is it safe to skip the legalization pass here": "question",
            "Please rename this to doesTargetSupportFuncType().": "change_request",
            "Do not disable this test. The purpose of this PR is to see the result of this test.": "change_request",
            "Remove this comment.": "change_request",
            "nit: prefer an early return": "nit",
            "Minor: typo in the comment": "nit",
            "Optional: could also use a range-for here": "nit",
            "LGTM, thanks!": "ack",
            "Approved and merging.": "ack",
            "Please rebase onto master.": "process",
            "CI is red, can you rerun the failing job": "process",
            "Please update the PR description to reflect the new approach.": "process",
            "Interesting.": "other",
            "": "other",
        }
        for body, want in cases.items():
            with self.subTest(body=body):
                self.assertEqual(rr.classify_comment(body), want)

    def test_quotes_code_and_html_comments_are_ignored_when_classifying(self):
        self.assertEqual(rr.classify_comment("> is this right?\n\nYes."), "other")
        self.assertEqual(rr.classify_comment("```\nwhy();\n```\nPlease remove the debug print."), "change_request")
        self.assertEqual(rr.classify_comment("<!-- why? --> Remove this."), "change_request")

    def test_long_messages_that_merely_say_thanks_are_not_acks(self):
        body = "Thanks for the PR. " + "The conversion belongs in legalization, not constant folding; " * 4 + "please move it."
        self.assertEqual(rr.classify_comment(body), "change_request")

    def test_per_pr_counts_cover_every_valid_comment(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("a", "Why?", "2026-08-21T00:00:00Z"),
            comment("b", "Please fix.", "2026-08-21T00:01:00Z"),
            comment("c", "nit: spacing", "2026-08-21T00:02:00Z"),
            comment("d", "LGTM", "2026-08-21T00:03:00Z"),
            comment("e", "Needs a rebase.", "2026-08-21T00:04:00Z"),
            comment("f", "Hm.", "2026-08-21T00:05:00Z"),
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:06:00Z"),
        ])
        f = facts(node)
        self.assertEqual(f["classification"],
                         {"question": 1, "change_request": 1, "nit": 1, "ack": 1, "process": 1, "other": 1})
        self.assertEqual(sum(f["classification"].values()), f["comments"])


class TestPerPRDetail(unittest.TestCase):
    def test_longest_comments_are_capped_at_five_and_two_hundred_chars(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jkwak-work", f"Please fix {'x' * (300 + i)}", f"2026-08-21T00:0{i}:00Z") for i in range(7)
        ])
        f = facts(node)
        self.assertEqual(len(f["longestComments"]), 5)
        self.assertEqual(f["longestComments"][0]["chars"], 300 + 6 + len("Please fix "))
        for c in f["longestComments"]:
            self.assertLessEqual(len(c["text"]), 200)
            self.assertEqual(set(c), {"author", "date", "kind", "chars", "url", "text"})

    def test_row_carries_the_fields_the_dashboard_and_mining_task_read(self):
        f = facts(pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", title="Fix #1: thing"))
        for key in ("repo", "number", "url", "title", "author", "authorClass", "state", "mergedAt",
                    "rounds", "comments", "reviewers", "classification", "removedAutomation",
                    "longestComments", "activityByWeek", "reviewDurationDays", "truncated",
                    "pagesFetched"):
            self.assertIn(key, f)
        self.assertEqual(f["url"], f"https://github.com/{REPO}/pull/1")
        self.assertEqual(f["reviewDurationDays"], 5.0)
        self.assertFalse(f["truncated"])
        self.assertEqual(f["pagesFetched"], {"reviews": 1, "comments": 1, "reviewThreads": 1, "threadComments": 0})

    def test_a_truncated_sub_resource_flags_the_row(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                       threads=[thread(comment("a", "Please fix.", "2026-08-21T00:00:00Z"))])
        node["reviewThreads"]["totalCount"] = 60
        self.assertTrue(facts(node)["truncated"])
        node["reviewThreads"]["totalCount"] = 1
        node["reviewThreads"]["nodes"][0]["comments"]["totalCount"] = 31
        self.assertTrue(facts(node)["truncated"])

    def test_fleet_filter_counters_add_up_across_prs(self):
        a = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:00:00Z"),
            comment("jvepsalainen-nv", "@coderabbitai review", "2026-08-21T00:01:00Z")])
        b = pr_node(2, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", comments=[
            comment("jhelferty-nv", BOARD_SYNC_BODY, "2026-08-21T00:00:00Z"),
            comment("CLAassistant", "signed", "2026-08-21T00:00:01Z"),
            comment("jkwak-work", "Remove this comment.", "2026-08-21T00:02:00Z"),
            comment("jkwak-work", "Remove this comment.", "2026-08-21T00:02:20Z")])
        fl = snapshot([a, b])["filters"]
        self.assertEqual(fl["removedAutomation"], 3)
        self.assertEqual(fl["removedAutomationByReason"], {"botLogin": 1, "boardSyncNotice": 2, "ghost": 0})
        self.assertEqual(fl["removedCommands"], 1)
        self.assertEqual(fl["dedupedDuplicates"], 1)
        self.assertEqual(fl["removedByLogin"], {"jhelferty-nv": 2, "claassistant": 1})
        self.assertIn("claassistant", fl["botLogins"])
        self.assertIn("slangbot", fl["botLogins"])
        self.assertIn(r"\[bot\]$", fl["botLoginPatterns"])


class TestRobustness(unittest.TestCase):
    """Surprising API shapes must neither crash the run (a traceback leaves the
    previous snapshot in place looking current) nor inflate N."""

    def test_a_null_pr_node_does_not_crash_and_does_not_count(self):
        # GitHub emits null entries in `nodes` for PRs the token cannot see.
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")
        col = rr.Collection()
        doc = rr.build_snapshot({REPO: [node, None]}, SINCE, [REPO], col=col)
        self.assertEqual(doc["totals"]["prs"], 1)
        self.assertEqual([p["number"] for p in doc["perPR"]], [1])
        self.assertTrue(col.ok)
        self.assertEqual(len(col.warnings), 1)
        self.assertIn("1 null PR node", col.warnings[0]["detail"])
        # Without a collection to warn on it still does not crash.
        self.assertEqual(rr.build_snapshot({REPO: [None]}, SINCE, [REPO])["totals"]["prs"], 0)

    def test_a_null_author_pr_is_unknown_and_excluded_from_both_series(self):
        ghost = pr_node(2, None, "2026-08-20T10:00:00Z", merged="2026-08-21T10:00:00Z",
                        reviews=[review("jkwak-work", "APPROVED", "2026-08-21T09:00:00Z")])
        human = pr_node(3, "alice", "2026-08-20T10:00:00Z", merged="2026-08-21T10:00:00Z")
        doc = snapshot([ghost, human])
        self.assertEqual({p["number"]: p["authorClass"] for p in doc["perPR"]}, {2: "unknown", 3: "human"})
        t = doc["totals"]
        self.assertEqual(t["unknownAuthoredPrs"], 1)
        self.assertEqual(t["automationAuthoredPrs"], 0)
        self.assertEqual(t["botAuthored"]["prs"], 0)
        self.assertEqual(t["humanAuthored"]["prs"], 1)
        wk = by_week(doc["weeklyByActivity"], "2026-08-17")
        self.assertEqual(wk["botAuthored"]["prs"] + wk["humanAuthored"]["prs"], 1)
        wk = by_week(doc["weeklyByMerge"], "2026-08-17")
        self.assertEqual(wk["botAuthored"]["prs"] + wk["humanAuthored"]["prs"], 1)
        # The row itself still carries the review it drew.
        self.assertEqual(doc["perPR"][0]["rounds"], 1)
        self.assertIn("unknown", rr.DEFINITION["authorClass"])

    def test_duplicate_pr_nodes_count_once(self):
        # UPDATED_AT DESC paging with position cursors: a PR updated mid-run
        # shifts the boundary and the PR at the page edge comes back twice.
        node = pr_node(7, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                       reviews=[review("jkwak-work", "APPROVED", "2026-08-24T10:00:00Z")])
        doc = snapshot([node, json.loads(json.dumps(node))])
        self.assertEqual(doc["totals"]["prs"], 1)
        self.assertEqual([p["number"] for p in doc["perPR"]], [7])
        self.assertEqual(by_week(doc["weeklyByMerge"], "2026-08-24")["botAuthored"]["rounds"]["n"], 1)
        self.assertEqual(by_week(doc["weeklyByActivity"], "2026-08-24")["botAuthored"]["prs"], 1)


class FakeRun:
    """Stands in for subprocess.run: the token helper and the GraphQL curl. Repo
    pages are keyed by the query's `name` variable; follow-up node() pages by
    (node id, cursor). A follow-up with no page prepared answers node:null."""

    def __init__(self, pages_by_repo, token="tok", token_rc=0, node_pages=None):
        self.pages_by_repo = pages_by_repo  # {name: [page, page, ...]}
        self.node_pages = node_pages or {}  # {(node_id, cursor): node payload}
        self.token = token
        self.token_rc = token_rc
        self.curl_calls = []

    def __call__(self, cmd, **kw):
        if cmd[0] == "python3":
            return SimpleNamespace(returncode=self.token_rc, stdout=self.token, stderr="no token")
        assert cmd[0] == "curl", cmd
        variables = json.loads(kw["input"])["variables"]
        if "id" in variables:
            key = (variables["id"], variables.get("cursor"))
            self.curl_calls.append(("node",) + key)
            node = self.node_pages.get(key)
            return SimpleNamespace(returncode=0, stdout=json.dumps({"data": {"node": node}}), stderr="")
        self.curl_calls.append((variables["name"], variables.get("cursor")))
        pages = self.pages_by_repo.get(variables["name"])
        if pages is None:
            return SimpleNamespace(returncode=0, stdout=json.dumps({"data": {"repository": None}}), stderr="")
        idx = 0 if variables.get("cursor") is None else int(variables["cursor"])
        nodes, has_next = pages[idx]
        conn = {"pageInfo": {"hasNextPage": has_next, "endCursor": str(idx + 1)}, "nodes": nodes}
        return SimpleNamespace(returncode=0, stdout=json.dumps({"data": {"repository": {"pullRequests": conn}}}),
                               stderr="")


class TestMain(unittest.TestCase):
    def run_main(self, argv, fake=None):
        out_dir = tempfile.mkdtemp()
        out = os.path.join(out_dir, "reports", "review-rounds.json")
        buf = io.StringIO()
        real_run, real_sleep = rr.subprocess.run, rr.time.sleep
        if fake is not None:
            rr.subprocess.run = fake
        rr.time.sleep = lambda s: None
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
                old_argv, sys.argv = sys.argv, ["review-rounds.py", "--json", out, *argv]
                try:
                    code = rr.main()
                finally:
                    sys.argv = old_argv
        finally:
            rr.subprocess.run, rr.time.sleep = real_run, real_sleep
        doc = json.loads(Path(out).read_text()) if os.path.exists(out) else None
        return code, doc, buf.getvalue()

    def test_a_fixture_run_writes_the_v2_document(self):
        fx = write_fixture({REPO: [pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                                           reviews=[review("jkwak-work", "APPROVED", "2026-08-24T10:00:00Z")])]})
        code, doc, out = self.run_main(["--fixture", fx, "--repos", REPO])
        self.assertEqual(code, 0)
        self.assertEqual(doc["schema"], 3)
        self.assertTrue(doc["complete"])
        self.assertEqual(doc["errors"], [])
        for key in ("definition", "window", "filters", "totals", "weeklyByActivity", "weeklyByMerge",
                    "weekly", "perRepo", "perPR"):
            self.assertIn(key, doc)
        self.assertEqual(doc["window"]["states"], ["MERGED", "OPEN", "CLOSED"])
        self.assertEqual(doc["definition"]["roundCollapseMinutes"], 30)
        self.assertEqual(doc["definition"]["dedupeWindowSeconds"], 60)
        self.assertEqual(doc["definition"]["minN"], 5)
        self.assertIsInstance(doc["definition"]["rounds"], str)
        self.assertEqual(doc["totals"]["botAuthored"]["rounds"]["total"], 1)
        self.assertEqual(doc["warnings"], [])
        self.assertIn("partial", doc["weeklyByActivity"][0])
        self.assertIn("ROUNDS per PR", out)

    def test_the_default_repo_list_is_all_seven(self):
        fx = write_fixture({REPO: [pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")]})
        _, doc, _ = self.run_main(["--fixture", fx])
        self.assertEqual(len(doc["window"]["repos"]), 7)
        self.assertEqual(sorted(doc["perRepo"]), sorted(doc["window"]["repos"]))

    def test_token_failure_fails_closed(self):
        code, doc, _ = self.run_main(["--repos", REPO], fake=FakeRun({}, token_rc=1))
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertEqual([e["what"] for e in doc["errors"]], ["token"])
        for key in ("totals", "weeklyByActivity", "weeklyByMerge", "perPR"):
            self.assertNotIn(key, doc)

    def test_an_invisible_repo_fails_closed(self):
        code, doc, _ = self.run_main(["--repos", REPO], fake=FakeRun({}))
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertNotIn("totals", doc)

    def test_paging_stops_once_a_whole_page_predates_the_window(self):
        fresh = [pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")]
        stale = [pr_node(2, BOT, "2026-01-01T10:00:00Z", merged="2026-01-05T10:00:00Z")]
        never = [pr_node(3, BOT, "2025-12-01T10:00:00Z", merged="2025-12-05T10:00:00Z")]
        fake = FakeRun({"slang": [(fresh, True), (stale, True), (never, False)]})
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertEqual(fake.curl_calls, [("slang", None), ("slang", "1")])
        self.assertEqual([p["number"] for p in doc["perPR"]], [1])

    def test_no_prs_in_window_is_not_a_clean_zero(self):
        fake = FakeRun({"slang": [([pr_node(2, BOT, "2026-01-01T10:00:00Z", merged="2026-01-05T10:00:00Z")], False)]})
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 2)
        self.assertFalse(doc["complete"])

    def test_a_pr_past_the_first_page_is_completed_with_node_queries(self):
        # 150 reviews, 100 on the first page. On a bot PR coderabbitai's implicit
        # COMMENTED reviews fill the page and the human review sits on page two;
        # without the follow-up the round is silently lost and the row a floor.
        first = [review("coderabbitai", "COMMENTED", f"2026-08-21T{i // 60:02d}:{i % 60:02d}:00Z")
                 for i in range(100)]
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", reviews=first)
        node["id"] = "PR_kwDO1"
        node["reviews"]["totalCount"] = 150
        node["reviews"]["pageInfo"] = {"hasNextPage": True, "endCursor": "r100"}
        second = [review("coderabbitai", "COMMENTED", f"2026-08-22T{i // 60:02d}:{i % 60:02d}:00Z")
                  for i in range(49)]
        second.append(review("jkwak-work", "APPROVED", "2026-08-24T10:00:00Z"))
        fake = FakeRun({"slang": [([node], False)]}, node_pages={
            ("PR_kwDO1", "r100"): {"reviews": {"totalCount": 150,
                                               "pageInfo": {"hasNextPage": False, "endCursor": "r150"},
                                               "nodes": second}},
        })
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertEqual(fake.curl_calls, [("slang", None), ("node", "PR_kwDO1", "r100")])
        p = doc["perPR"][0]
        self.assertEqual(p["rounds"], 1)
        self.assertEqual(p["reviewers"], ["jkwak-work"])
        self.assertEqual(p["reviewsRemoved"]["automation"], 149)
        self.assertFalse(p["truncated"])
        self.assertEqual(p["pagesFetched"], {"reviews": 2, "comments": 1, "reviewThreads": 1, "threadComments": 0})
        self.assertEqual(doc["totals"]["reviewTruncatedPrs"], 0)
        self.assertEqual(doc["warnings"], [])

    def test_a_deep_thread_is_completed_through_the_thread_node(self):
        th = thread(*[comment("jkwak-work", f"Point {i}.", f"2026-08-21T10:{i:02d}:00Z") for i in range(30)])
        th["id"] = "PRRT_1"
        th["comments"]["totalCount"] = 31
        th["comments"]["pageInfo"] = {"hasNextPage": True, "endCursor": "c30"}
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z", threads=[th])
        node["id"] = "PR_kwDO1"
        reply = comment("pdeayton-nv", "Agreed, please add a comment explaining it.", "2026-08-21T11:00:00Z")
        fake = FakeRun({"slang": [([node], False)]}, node_pages={
            ("PRRT_1", "c30"): {"comments": {"totalCount": 31,
                                             "pageInfo": {"hasNextPage": False, "endCursor": "c31"},
                                             "nodes": [reply]}},
        })
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertEqual(fake.curl_calls, [("slang", None), ("node", "PRRT_1", "c30")])
        p = doc["perPR"][0]
        self.assertEqual(p["comments"], 31)
        self.assertEqual(p["threads"], 1)
        self.assertFalse(p["truncated"])
        self.assertEqual(p["pagesFetched"]["threadComments"], 1)
        self.assertEqual(sorted(p["reviewers"]), ["jkwak-work", "pdeayton-nv"])

    def test_a_failed_follow_up_fails_closed(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z",
                       comments=[comment("jkwak-work", "Please add a test.", "2026-08-21T00:00:00Z")])
        node["id"] = "PR_kwDO1"
        node["comments"]["totalCount"] = 101
        node["comments"]["pageInfo"] = {"hasNextPage": True, "endCursor": "c1"}
        fake = FakeRun({"slang": [([node], False)]})  # no node page prepared: follow-up answers node:null
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertEqual(doc["errors"][0]["what"], f"{REPO}#1 comments")
        self.assertNotIn("totals", doc)

    def test_a_pr_outside_the_window_is_not_followed_up(self):
        stale = pr_node(2, BOT, "2026-01-01T10:00:00Z", merged="2026-01-05T10:00:00Z")
        stale["id"] = "PR_old"
        stale["comments"]["totalCount"] = 200
        stale["comments"]["pageInfo"] = {"hasNextPage": True, "endCursor": "c100"}
        fresh = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")
        fake = FakeRun({"slang": [([fresh, stale], False)]})
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertEqual(fake.curl_calls, [("slang", None)])
        self.assertEqual([p["number"] for p in doc["perPR"]], [1])

    def test_a_null_pr_node_in_a_page_is_a_warning_not_a_failure(self):
        node = pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")
        fake = FakeRun({"slang": [([node, None], False)]})
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertTrue(doc["complete"])
        self.assertEqual([p["number"] for p in doc["perPR"]], [1])
        self.assertEqual(len(doc["warnings"]), 1)
        self.assertIn("1 null PR node", doc["warnings"][0]["detail"])

    def test_a_pr_returned_on_two_pages_counts_once(self):
        a = pr_node(7, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")
        b = pr_node(8, BOT, "2026-08-20T10:00:00Z", merged="2026-08-24T10:00:00Z")
        c = pr_node(9, BOT, "2026-08-19T10:00:00Z", merged="2026-08-23T10:00:00Z")
        fake = FakeRun({"slang": [([a, b], True), ([json.loads(json.dumps(a)), c], False)]})
        code, doc, _ = self.run_main(["--repos", REPO], fake=fake)
        self.assertEqual(code, 0)
        self.assertEqual([p["number"] for p in doc["perPR"]], [7, 8, 9])
        self.assertEqual(doc["totals"]["prs"], 3)
        self.assertEqual(len(doc["warnings"]), 1)
        self.assertIn("returned twice", doc["warnings"][0]["detail"])

    def test_an_aggregation_bug_lands_as_complete_false_not_a_traceback(self):
        fx = write_fixture({REPO: [pr_node(1, BOT, "2026-08-20T10:00:00Z", merged="2026-08-25T10:00:00Z")]})
        real = rr.build_snapshot

        def boom(*_a, **_k):
            raise KeyError("activityByWeek")

        rr.build_snapshot = boom
        try:
            code, doc, _ = self.run_main(["--fixture", fx, "--repos", REPO])
        finally:
            rr.build_snapshot = real
        self.assertEqual(code, 1)
        self.assertFalse(doc["complete"])
        self.assertEqual(doc["errors"][0]["what"], "aggregate")
        self.assertIn("KeyError", doc["errors"][0]["detail"])
        self.assertNotIn("totals", doc)


class TestAtomicWrite(unittest.TestCase):
    def test_it_creates_the_output_directory_and_replaces_atomically(self):
        d = tempfile.mkdtemp()
        out = os.path.join(d, "reports", "review-rounds.json")
        rr.write_json(out, {"n": 1})
        rr.write_json(out, {"n": 2})
        self.assertEqual(json.loads(Path(out).read_text()), {"n": 2})
        self.assertEqual(os.listdir(os.path.dirname(out)), ["review-rounds.json"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
