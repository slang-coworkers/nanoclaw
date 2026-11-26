from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mention import parse_mention

ALIASES = frozenset({"luna", "sol"})


def cmd(body: str) -> str | None:
    m = parse_mention(body, "bot", ALIASES)
    return None if m is None else m.command


class MentionTests(unittest.TestCase):
    def test_line_start(self) -> None:
        self.assertEqual(cmd("@bot fix the typo"), "fix the typo")

    def test_mid_line_keeps_preceding_text_as_context(self) -> None:
        m = parse_mention("Some context. @bot, please revise this.", "bot", ALIASES)
        assert m is not None
        self.assertEqual(m.command, "please revise this.")
        self.assertEqual(m.context, "Some context.")

    def test_colon_and_following_lines(self) -> None:
        self.assertEqual(cmd("@bot: step one\nstep two"), "step one\nstep two")

    def test_case_insensitive(self) -> None:
        self.assertEqual(cmd("@BOT do it"), "do it")

    def test_requires_full_account_name(self) -> None:
        self.assertIsNone(cmd("@botnet do it"))
        self.assertIsNone(cmd("@bot.x do it"))
        self.assertIsNone(cmd("x@bot do it"))
        self.assertIsNone(cmd("@@bot do it"))

    def test_end_of_line_mention_takes_following_lines(self) -> None:
        self.assertEqual(cmd("@bot\nplease do it"), "please do it")

    def test_ignored_in_inline_code(self) -> None:
        self.assertIsNone(cmd("use `@bot fix` to ask"))

    def test_ignored_in_fences(self) -> None:
        self.assertIsNone(cmd("```\n@bot fix\n```"))
        self.assertIsNone(cmd("~~~\n@bot fix\n~~~"))
        self.assertEqual(cmd("```\n@bot no\n```\n@bot yes"), "yes")

    def test_ignored_in_quotes(self) -> None:
        self.assertIsNone(cmd("> @bot fix this"))
        self.assertEqual(cmd("> @bot old\n@bot new"), "new")

    def test_empty_command_rejected(self) -> None:
        m = parse_mention("@bot   ", "bot", ALIASES)
        assert m is not None
        self.assertEqual(m.rejected, "empty-command")

    def test_model_block(self) -> None:
        m = parse_mention("@bot {model=Sol} do it", "bot", ALIASES)
        assert m is not None
        self.assertEqual((m.command, m.model, m.rejected), ("do it", "sol", None))

    def test_unknown_model_rejected(self) -> None:
        m = parse_mention("@bot {model=gpt9} do it", "bot", ALIASES)
        assert m is not None
        self.assertEqual(m.rejected, "unknown-model")

    def test_model_block_without_command_rejected(self) -> None:
        m = parse_mention("@bot {model=luna}", "bot", ALIASES)
        assert m is not None
        self.assertEqual(m.rejected, "empty-command")

    def test_no_mention(self) -> None:
        self.assertIsNone(parse_mention("nothing here", "bot", ALIASES))

    def test_account_must_be_bare(self) -> None:
        with self.assertRaises(ValueError):
            parse_mention("@bot x", "@bot", ALIASES)


if __name__ == "__main__":
    unittest.main()
