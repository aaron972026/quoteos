#!/usr/bin/env python3
"""
PreToolUse Bash guard.

Reads the tool-use payload from stdin (JSON) and blocks shell commands that
match dangerous patterns even if the deny-list in settings.json was bypassed.

Exit codes:
  0  = allow (silent)
  2  = block (stderr is shown to Claude as the reason, the tool call is skipped)
  1  = error in the hook itself (does not block the tool, but is logged)

Patterns are deliberately strict. Adjust per-project as needed.
"""
from __future__ import annotations

import json
import re
import sys

# Patterns that should never run, regardless of context.
DENY_PATTERNS: list[tuple[str, str]] = [
    (r"\brm\s+-rf?\s+/(\s|$)",                "rm -rf on root"),
    (r"\brm\s+-rf?\s+~/?(\s|$)",              "rm -rf on home"),
    (r"\brm\s+-rf?\s+\*",                     "rm -rf on glob *"),
    (r":\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;\s*:", "fork bomb"),
    (r"\bcurl\b[^|]*\|\s*(ba)?sh\b",          "curl | sh"),
    (r"\bwget\b[^|]*\|\s*(ba)?sh\b",          "wget | sh"),
    (r"\bdd\b[^;]*\bof=/dev/(sd|nvme|hd)",    "dd to a raw block device"),
    (r"\bmkfs\.",                             "filesystem create"),
    (r"\bchmod\s+-R\s+777\s+/",               "chmod 777 on root"),
    (r"\bgit\s+push\s+.*--force\b",           "force push"),
    (r"\bgit\s+push\s+.*-f\b",                "force push"),
    (r"\bgit\s+reset\s+--hard\s+HEAD~",       "destructive reset"),
    (r">\s*/dev/sd",                          "redirect to raw disk"),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:  # malformed input — don't block, but log
        print(f"[bash_guard] could not parse stdin: {exc}", file=sys.stderr)
        return 1

    cmd = (
        payload.get("tool_input", {}).get("command")
        or payload.get("input", {}).get("command")
        or ""
    )
    if not cmd:
        return 0

    for pattern, reason in DENY_PATTERNS:
        if re.search(pattern, cmd):
            print(
                f"BLOCKED by bash_guard: {reason}\n"
                f"Command: {cmd}\n"
                f"If this is intentional, ask the user to override; do not retry around the guard.",
                file=sys.stderr,
            )
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
