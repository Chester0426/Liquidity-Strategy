---
description: "Automated review-fix loop: find issues, fix them, validate, repeat until clean."
type: code-writing
reads:
  - CLAUDE.md
  - EVENTS.yaml
  - scripts/scoped-review-prompt.md
stack_categories: []
requires_approval: false
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
branch_prefix: chore
modifies_specs: false
---
Run an automated review of the experiment template, fix findings, and validate
until clean. Replaces the manual workflow of running `scripts/scoped-review-prompt.md`.

## Step 0: Read context

- Read `CLAUDE.md`
- Read `EVENTS.yaml`
- Read `scripts/check-inventory.md`
- Read `idea/idea.example.yaml` (for understanding template structure)

## Step 1: Run baseline validators

- Run all 3 validators, capture total error count as `baseline_errors`:
  - `python3 scripts/validate-frontmatter.py`
  - `python3 scripts/validate-semantics.py`
  - `bash scripts/consistency-check.sh`
- If a script fails to run (missing python3/pyyaml): stop and tell the user

## Step 2: Review (iteration N)

Launch 3 Explore subagents in parallel, one per dimension below. Construct each
agent's prompt from:

- The **shared context instruction** (box below)
- The agent's **dimension section** (focus, examples, files to read)
- The **Finding Format**, **Check Proposal Criteria**, and **Rules** sections

> **Shared context instruction** — include verbatim in every subagent prompt:
>
> Before reviewing, read these files:
> `scripts/check-inventory.md`, `CLAUDE.md`, `idea/idea.example.yaml`, `EVENTS.yaml`.
> Do not report anything already covered by check-inventory.md (including Pending).

### Dimension A: Cross-File Consistency

**Focus**: Find contradictions or inconsistencies **between** files that no regex or structural check can catch. Examples:
- A skill file says "do X" but a stack file's code template does Y
- A rule in CLAUDE.md conflicts with how a skill actually operates
- A stack file assumes a convention that another stack file violates
- A prose instruction references a function/file/path that doesn't match reality

**Files to read**:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file

### Dimension B: Edge Case Robustness

**Focus**: Find configurations where skills or stack files would produce broken output. Examples:
- A skill assumes auth exists but the idea.yaml has no `stack.auth`
- A code template hard-codes a path that changes based on stack choices
- A conditional branch in a skill handles 2 of 3 possible states
- An edge case not covered by the test fixtures

**Files to read**:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file
- Glob `tests/fixtures/*.yaml` — read each test fixture

**After reading**: mentally simulate running `/bootstrap` and `/change` with each fixture's configuration.

### Dimension C: User Journey Completeness

**Focus**: Find dead-end states where a user gets stuck with no clear next step. Examples:
- A skill exits early but doesn't tell the user what to do next
- A build failure produces an unhelpful error message
- A workflow step assumes a previous step succeeded but doesn't verify
- A Makefile target fails silently or with an unhelpful error
- The user follows instructions but ends up in an undocumented state

**Files to read**:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file
- Read `Makefile`
- Read `.claude/patterns/verify.md`

**After reading**: trace the user journey from `make validate` → `/bootstrap` → `/change` → `/verify` → `/distribute` → `/iterate` → `/retro`.

### Finding Format

Each subagent must use this format for findings:

```
### Finding N: <title>
- **File(s)**: ...
- **Issue**: ... (be specific — quote the conflicting text)
- **Impact**: ... (what breaks or confuses the user)
- **Fix**: ... (concrete, implementable)
- **Proposed check** (only if the finding qualifies — see Check Proposal Criteria):
  - **Target**: validate-frontmatter.py | validate-semantics.py | consistency-check.sh
  - **Name**: imperative verb phrase (e.g., "Verify X matches Y")
  - **Category**: structural | cross-file sync | behavioral contract | reference check
  - **Similar to**: existing/pending check from check-inventory.md, or "none"
  - **Pass/fail**: one sentence describing what constitutes failure
```

### Check Proposal Criteria

A proposed check must fall into one of these categories:

| Category | What it catches | Example |
|----------|----------------|---------|
| Structural | Missing keys, malformed data, invalid syntax | "Fixture YAML missing required `assertions` key" |
| Cross-file sync | Value in file A doesn't match corresponding value in file B | "Env var in prose not declared in frontmatter" |
| Behavioral contract | Code template would produce broken output at runtime | "Non-src template uses `process.env` without loading env config" |
| Reference check | A named reference (tool, file, path) doesn't resolve | "Skill references unknown tool `FooBar`" |

**Do NOT propose checks that:**
- Regex-match natural-language prose for specific wording (e.g., "prose must contain the word 'branch' within 200 chars of a recovery message")
- Enforce cosmetic formatting with no silent-failure risk (e.g., "numbered lists must have no gaps")
- Verify that prose *explains* something (e.g., "skill must document resumption behavior") — this is the scoped LLM review's job

### Rules

Include these in each subagent prompt:

1. **Maximum 5 findings.** Keep only the 5 most impactful.
2. **No overlap with automated checks.** `scripts/check-inventory.md` is authoritative, including the Pending and Rejected sections. If a check is pending, propose extending it instead. If a check was rejected, do not re-propose it unless the rejection reason no longer applies.
3. **Zero findings is valid.** Say "No findings for this dimension" and summarize what was checked.
4. **Self-review before presenting.** Merge proposed checks that cover the same invariant. Verify each finding against check-inventory.md one more time.
5. **Concrete fixes only.** Every fix must be implementable in a single PR.

On iteration 2+: include the list of seen finding signatures in the subagent prompt so they skip already-reported issues.

After all 3 return: collect up to 15 findings, deduplicate.

## Step 3: Filter findings

- A finding signature = `<file_path>:<finding_title>`
- Remove findings whose signatures match `seen_findings` set (oscillation guard)
- If 0 remaining findings → skip to Step 8
- Add new signatures to `seen_findings`

## Step 4: Branch setup (first iteration with findings only)

Follow `.claude/patterns/branch.md` with prefix `chore` and name `chore/review-fixes`.

If branch already exists from prior iteration, continue on it.

## Step 5: Fix findings

For each finding in priority order:

1. Implement the fix
2. If finding has a Proposed Check → implement it in the target validator
3. Run all 3 validators
4. If error count increased vs pre-fix count → revert with
   `git checkout -- <modified files>`, log as "reverted", move to next
5. If error count same or decreased → keep the fix
   (do NOT commit per-fix; accumulate changes for a single commit)

The validator scripts serve as this skill's quality gate, analogous to the
build verification in `.claude/patterns/verify.md`.

## Step 6: Check iteration limit and compact state

- Increment iteration counter
- If iteration >= 3 OR no fixes succeeded → proceed to Step 7
- Before returning to Step 2, emit a compact state summary and discard prior detail:

  ```
  ## Iteration N complete
  - seen_findings: [list of all finding signatures across all iterations]
  - error_count: [current validator error count]
  - files_modified: [list of files changed so far]
  - fixes_applied: N, reverted: M, skipped: K
  - checks_added: [list of new validator checks, or "none"]
  ```

  This summary is the only carry-forward state needed. Prior subagent results,
  file reads, and validator outputs from this iteration are no longer needed and
  can be safely compressed.

- Return to Step 2

## Step 7: Update check-inventory.md

If new validator checks were implemented in Step 5:

- Add each to the appropriate table in `scripts/check-inventory.md`
- Update the total counts in the header
- Clear any matching entries from the Pending table

## Step 8: Final validation

- Run all 3 validators
- Record `final_errors`
- If `final_errors` > `baseline_errors` → stop and report regression

## Step 9: Commit, push, open PR

If no branch exists (no findings across all iterations):
  Report "Review clean — no findings" and stop.

If branch exists with changes:

- Commit all accumulated changes with a descriptive message
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md`:
  - **Summary**: "Automated review-fix: N findings fixed across M iterations"
  - **How to Test**: "Run `make validate` + all 3 validator scripts"
  - **What Changed**: list every file and what changed
  - **Why**: "Template quality — fixes found by 3-dimension LLM review"
- Include in PR body: review summary, fixed findings, skipped/reverted
  findings, new checks added, remaining unfixable findings

## Do NOT

- Modify idea.yaml or EVENTS.yaml
- Enter plan mode or wait for user approval
- Add new features or pages
- Propose checks that regex-match natural-language prose
- Fix findings that overlap with check-inventory.md
- Run more than 3 iterations
- Skip running validators after each fix
- Commit fixes that cause validator regressions
- Install or remove packages
- Commit to main directly
