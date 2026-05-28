"""Static grep gate enforcing the group/collaborate hard-delete (Epic group-removal).

Three test cases (one per scope: backend / frontend / docs). Each runs `git grep`
with self-exclusion pathspecs and a denylist of regex patterns. Pass = 0 hits.

The docs gate is env-gated (``ENFORCE_DOCS_GATE=1``) so PR [1]-[4] can run with it
present but skipped; PR [5] flips the env to enforce alongside the lockstep doc rewrite.

Self-exclusion is load-bearing: this file, the preflight script, the not-yet-written
migration file, and the planning notes all contain the denied tokens by necessity.

Plan ref: dev-plans/group-removal-01-preflight-gate.md §2, master plan §Verification.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest


def _find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / ".git").exists():
            return parent
    raise RuntimeError(f"Could not find .git from {here}")


REPO_ROOT = _find_repo_root()

SELF_EXCLUDE: tuple[str, ...] = (
    ":!services/api/scripts/group_collaborate_removal_preflight.py",
    ":!services/api/tests/static/test_no_group_collaborate_refs.py",
    ":!services/api/migrations/versions/20260527_0034_remove_group_collaborate.py",
    ":!services/api/tests/migrations/test_remove_group_collaborate_migration.py",
    ":!dev-plans/remove-group-feature-and-consolidate-to-teams-only.md",
    ":!dev-plans/group-removal-*.md",
    ":!decisions/log.md",
)

BACKEND_PATTERNS: tuple[str, ...] = (
    r"group_workspace",
    r"collaborate_(start|plus|subscription)",
    r"assert_group_member_capacity",
    r"create_group_workspace",
    r"manual_create_group_workspace",
    r"manual_set_collaborate_plan",
    r"manual_operate_group_plan",
    r"COLLABORATE_PLAN_KEYS",
    r"ownerCollaborate",
    r"plan_family.*collaborate",
    r"admin\.finance\.manual\.collaborate_plan",
    r"AdminManualCollaboratePlanRequest",
    r"BillingCollaborateSubscriptionCheckoutRequest",
    r"include_groups",
    r"includeGroups",
)

FRONTEND_EXTRA_PATTERNS: tuple[str, ...] = (
    r"createGroupWorkspace",
    r"groupMemberLimit",
    r"groupWorkspaceLimit",
    r"CommerceGroupSummary",
    r"getCollaboratePlanOptions",
    r"adminManualSetCollaboratePlan",
    r"""["']/groups?["']""",
    r"Team or Group",
    r"Create a Group",
    r"groupsSeed",
)

DOCS_PATTERNS: tuple[str, ...] = (
    r"group_workspace",
    r"Collaborate plan",
    r"Group workspaces?",
    r"collaborate_(start|plus)",
    r"Team or Group",
)


def _git_grep(patterns: tuple[str, ...], scope: tuple[str, ...]) -> dict[str, list[str]]:
    """Run ``git grep -nE`` for each pattern; return ``{pattern: [hit_lines]}``.

    Empty dict = clean. Caps examples at 5 per pattern so failure output stays scannable.
    """
    hits: dict[str, list[str]] = {}
    for pattern in patterns:
        cmd = (
            ["git", "-C", str(REPO_ROOT), "grep", "-nE", pattern, "--"]
            + list(scope)
            + list(SELF_EXCLUDE)
        )
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            lines = [ln for ln in result.stdout.splitlines() if ln]
            if lines:
                hits[pattern] = lines[:5]
        elif result.returncode == 1:
            continue
        else:
            raise RuntimeError(f"git grep failed for {pattern!r}: {result.stderr}")
    return hits


def _format_hits(scope_name: str, hits: dict[str, list[str]]) -> str:
    total = sum(len(v) for v in hits.values())
    lines = [f"{scope_name}: {total} hits across {len(hits)} patterns"]
    for pattern, examples in hits.items():
        lines.append(f"  {pattern}:")
        lines.extend(f"    {ex}" for ex in examples)
    return "\n".join(lines)


def test_backend_gate() -> None:
    hits = _git_grep(BACKEND_PATTERNS, ("services/api/",))
    assert not hits, _format_hits("backend", hits)


def test_frontend_gate() -> None:
    hits = _git_grep(BACKEND_PATTERNS + FRONTEND_EXTRA_PATTERNS, ("apps/web/",))
    assert not hits, _format_hits("frontend", hits)


@pytest.mark.skipif(
    os.environ.get("ENFORCE_DOCS_GATE") != "1",
    reason="Docs gate env-gated until PR [5] flips ENFORCE_DOCS_GATE=1",
)
def test_docs_gate() -> None:
    scope = ("PRD/", "ARCH/", "project_state/", "knowledge/", "dev-plans/README.md")
    hits = _git_grep(DOCS_PATTERNS, scope)
    assert not hits, _format_hits("docs", hits)
