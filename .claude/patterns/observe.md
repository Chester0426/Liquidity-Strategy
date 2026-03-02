# Template Observation Procedure

Follow this procedure after verify.md's "Template Observation Review" step, or
after deploy.md's auto-fix loop (Step 5d). This evaluates whether any code
change or error fix made during the current skill execution has a root cause in
a template file.

**If you are running an analysis-only skill (`/review`, `/iterate`, or `/retro`),
skip this entire procedure** — analysis-only skills do not make code changes that
trigger observations. `/review` fixes are already captured in the review PR.

## Prerequisites

1. Read `template_repo` from `idea/idea.yaml`. If not set or idea.yaml does not
   exist → skip silently.
2. `gh auth status` — if fails → skip silently.
3. `gh repo view <template_repo> --json name` — if fails → skip silently.

Observation filing is best-effort. Never stop the skill, never ask the user for
input, never block on filing.

## Trigger Evaluation

For each code change or error fix made during this skill execution, evaluate
whether it qualifies as a template observation. A change qualifies when **all
three** conditions are true:

**A. Template file is the root cause.** The fix required changing — or would ideally
change — a file under:
  - `.claude/stacks/**/*.md`
  - `.claude/commands/*.md`
  - `.claude/patterns/*.md`
  - `scripts/`
  - `Makefile` or `CLAUDE.md`

  OR: you fixed project code, but the root cause is incorrect guidance in a template
  file (e.g., a code template produces a build error, a skill's instructions lead to
  a missing import).

**B. Not an environment issue.** NOT caused by: missing CLI tools, network failures,
Node version mismatches, missing env vars (.env not populated), or auth failures.

**C. Not a user code issue.** NOT caused by: business logic bugs specific to this
idea.yaml, unclear idea.yaml content, user code not following template guidance, or
project-specific dependency conflicts.

**Heuristic:** "Would another developer using this template with a different idea.yaml
hit this same problem?" If yes → file it.

If no fixes qualify → stop here.

## Redaction

Before composing the issue, strip all project-specific information:
- Replace the project name (from idea.yaml `name`) with `<project>`
- Replace idea.yaml content (problem, solution, features) with `<redacted>`
- Replace full error stack traces with the relevant error message only
- Replace paths containing project-specific page names with generic paths
  (e.g., `src/app/invoice-create/page.tsx` → `src/app/<page>/page.tsx`)
- Keep: template file name, generic symptom description, fix diff (template-relevant
  lines only)

## Dedup

Search for existing open observations about the same template file:

```bash
gh issue list --repo <template_repo> --label observation \
  --search "[observe] <template-file-basename>:" --state open --limit 20
```

Read the titles of matching results. If any existing issue describes the same
underlying problem (same template file, same root cause — even if worded
differently), add a comment instead of creating a new issue:

```bash
gh issue comment <issue-number> --repo <template_repo> --body "<comment>"
```

Comment body:
```
## Additional occurrence

**Skill:** /<skill-name>
**Date:** <today>
**Symptom:** <one-line generic description>
**Fix applied in project:** <generic description of the workaround>
```

After commenting → stop. Do not create a new issue.

## Issue Creation

If no duplicate found, create a new issue.

**Title format:** `[observe] <template-file-basename>: <symptom-in-imperative-form>`

Examples:
- `[observe] nextjs.md: Landing page template missing React import for Suspense`
- `[observe] bootstrap.md: Step 7b runs playwright install before npm install -D`
- `[observe] deploy.md: Auto-fix loop does not re-check auth config after PATCH`

**Body format:**
```
## Observation

**Template file:** `<full path>`
**Skill running:** /<skill-name>
**Trigger:** verify.md build fix | verify.md observation review | deploy.md auto-fix

## Symptom

<1-3 sentences, generic — no project names>

## Root cause

<1-3 sentences explaining why the template guidance/code is incorrect>

## Fix

<Minimal diff or description. Only template-relevant lines. Redacted.>

## Suggested template change

<What the template file should change to prevent this in future projects.
If you already updated the stack file during "Save Notable Patterns", describe
that change. If you only fixed project code as a workaround, describe the
template-level fix.>

---
*Auto-filed by the observation pattern during /<skill-name> execution.*
```

**Filing command:**
```bash
gh issue create --repo <template_repo> \
  --title "<title>" \
  --label "observation" \
  --body "<body>"
```

**Error handling:**
- If label "observation" doesn't exist → retry without `--label "observation"`.
  Prefix body with: `**Label:** observation (create this label for filtering)`.
- If filing fails for any other reason → log the error and continue.
- If successful → report the URL to the user: "Filed template observation: <url>"

## Constraints

- **Best-effort.** Any failure → skip silently. Never block the skill.
- **Max 1 issue per skill execution.** Multiple fixes → combine into one issue with
  multiple Symptom/Fix sections.
- **Skip simple typos** unlikely to recur (consistent with verify.md's skip rule).
