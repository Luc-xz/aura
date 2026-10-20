# Agent Notes

An Agent Note records a decision and why: the part code cannot carry. Notes live at `.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic.md`.

## Lifecycles

- `proposed/` — reviewed before implementation; may be unbuilt.
- `implemented/` — shipped. Keep it current with what shipped: when code moves or a default changes, update the note in the same change. Rewrite facts in place; never append history.
- `rejected/` — declined. Keep only while it prevents a plausible mistake, then delete it and repair inbound links.

## Classes

One closed set, enforced by the gate: `feature`, `bug-fix`, `simplification`, `architecture`, `process`, `testing`. `architecture` is structural (shipped source); `process` is tooling and workflow around it. `refactor` is absent because `simplification` already covers it — its discriminator is "does observable behavior change?".

## When to write one

Every non-trivial change adds or updates a note in the same PR. Non-trivial means it alters behavior, a contract shared across files or modules, process or tooling, testing strategy, or an on-disk or wire format — anything a maintainer may revisit. Updating the note that already owns the decision satisfies the rule; do not duplicate it.

A purely mechanical or local edit is exempt. Never edit a note into a *different* decision: supersede it with a new note and cross-link both.

Delete a stale note rather than archiving it; git history holds the record.

Stale notes are why this tree exists: the repository previously accumulated one acceptance document per development phase, and all 67 of them were deleted in a single change once they described work that had already shipped. A note that states what is and why survives that; a note that narrates a phase does not.

## Format

The first three lines are exactly these, followed by a blank line:

```markdown
# Agent Note: <title>

Status: <status>
```

`Status:` is `proposed`, `implemented`, or `rejected — <why, one line>`, and must match the lifecycle folder. The filename date is when the topic was first proposed.

The body opens with `## Problem` (motivation, standing without the solution), then:

| Lifecycle | Required sections |
|---|---|
| `proposed` | `## Proposal`, `## Acceptance criteria`, `## Risks` |
| `implemented` | `## Decision` (present tense), `## Consequences` (what it cost and bought) |
| `rejected` | `## Proposal` |

`implemented/` notes may not use `## Proposal`, `## Plan`, `## Migration plan`, or `## Acceptance criteria`; the gate rejects proposal-era headings.

Every note carries `## Alternatives considered`: each genuine alternative and why it lost. A decision recorded without what it beat invites re-litigation.

Moving between lifecycles updates `Status:` and re-satisfies the target folder's sections in the same change. Cross-reference notes with relative links, never bare numbers.

Notes and `AGENTS.md` are written in Chinese, matching `docs/`; identifiers, file paths, and format tokens stay in English.

Run `pnpm test:docs` before pushing. It checks this tree's structure and format, and resolves every relative Markdown link in the repository.
