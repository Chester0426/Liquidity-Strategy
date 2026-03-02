---
description: "Use when starting a new experiment from a filled-in idea.yaml. Run once per project."
type: code-writing
reads:
  - idea/idea.yaml
  - EVENTS.yaml
  - CLAUDE.md
stack_categories: [framework, database, auth, analytics, ui, payment, email, hosting, testing]
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
  - .claude/patterns/messaging.md
  - .claude/patterns/design.md
branch_prefix: feat
modifies_specs: false
---
Bootstrap the MVP from idea.yaml.

## Step 0: Branch Setup

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `feat` and branch name `feat/bootstrap`.

## Phase 1: Plan (BEFORE writing any code)

DO NOT write any code, create any files, or run any install commands during this phase.

1. **Read context files**
   - Read `idea/idea.yaml` — this is the single source of truth
   - Read `EVENTS.yaml` — these are the canonical analytics events to wire up
   - Read `CLAUDE.md` — these are the rules to follow

2. **Resolve the stack**
   - Read idea.yaml `stack`. For each category present in idea.yaml `stack` (always: framework, analytics, ui, hosting; optional: database, auth, payment, email, testing), read `.claude/stacks/<category>/<value>.md`.
   - If a stack file doesn't exist for a given value:
     1. Read `.claude/stacks/TEMPLATE.md` for the required frontmatter schema.
     2. Read existing stack files in the same category (`.claude/stacks/<category>/*.md`) as reference for conventions and structure. If no files exist in that category, read a well-populated stack file from another category (e.g., `database/supabase.md` or `analytics/posthog.md`) as a structural reference.
     3. Generate `.claude/stacks/<category>/<value>.md` with:
        - Complete frontmatter (assumes, packages, files, env, ci_placeholders, clean, gitignore) — populate each field based on knowledge of the technology. Use empty lists/dicts for fields that genuinely don't apply.
        - Code templates for library files and route handlers using `### \`path\`` heading format.
        - Environment Variables, Packages, and Patterns sections following the TEMPLATE.md structure.
     4. Run `python3 scripts/validate-frontmatter.py` to verify the generated file passes structural checks. If it fails, fix the frontmatter and re-run (max 2 attempts). If still failing, stop and tell the user: "Could not generate a valid stack file for `<category>/<value>`. Create `.claude/stacks/<category>/<value>.md` manually using TEMPLATE.md as a guide, then re-run `/bootstrap`."
     5. Tell the user: "Generated `.claude/stacks/<category>/<value>.md` — this is auto-generated from Claude's knowledge and has not been team-reviewed. Review it after bootstrap completes."
     6. File an observation per `.claude/patterns/observe.md` noting the missing stack file, so the template repo can add a reviewed version.
     7. Continue bootstrap using the generated stack file.
   - These files define packages, library files, env vars, and patterns for each technology.
   - For each stack file read, validate its `assumes` entries: every `category/value` in the file's `assumes` list must match a `category: value` pair in idea.yaml `stack`. If any assumption is unmet, stop and list the incompatibilities (e.g., "analytics/posthog assumes framework/nextjs, but your stack has framework: remix"). The user must either change the mismatched stack value or create a compatible stack file.

3. **Validate idea.yaml**
   - Every one of these fields must be present and non-empty (strings must be non-blank, lists must have at least one item): `name`, `title`, `owner`, `problem`, `solution`, `target_user`, `distribution`, `pages`, `features`, `primary_metric`, `target_value`, `measurement_window`, `stack`
   - If ANY field still contains "TODO" or is missing: stop, list exactly which fields need to be filled in, and do nothing else
   - Verify `pages` includes an entry with `name: landing` (required)
   - Verify `name` is lowercase with hyphens only (no spaces, no uppercase)
   - If `stack.payment` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Payment requires authentication to identify the paying user. Add `auth: supabase` (or another auth provider) to your idea.yaml `stack` section."
   - If `stack.payment` is present, verify `stack.database` is also present. If not: stop and tell the user: "Payment requires a database to record transaction state. Add `database: supabase` (or another database provider) to your idea.yaml `stack` section."
   - If `stack.email` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Email requires authentication to know who to send emails to. Add `auth: supabase` (or another auth provider) to your idea.yaml `stack` section."
   - If `stack.email` is present, verify `stack.database` is also present. If not: stop and tell the user: "Email nudge requires a database to check user activation status. Add `database: supabase` (or another database provider) to your idea.yaml `stack` section."
   - If `variants` is present in idea.yaml, validate the variants list:
     - Must be a list with at least 2 entries (testing 1 variant = no variants — tell the user to remove the field)
     - Each variant must have: `slug`, `headline`, `subheadline`, `cta`, `pain_points` (all non-empty)
     - Each `slug` must be lowercase, start with a letter, and use only a-z, 0-9, hyphens
     - Slugs must be unique across all variants
     - No slug may collide with a page name from `pages`
     - `pain_points` must have exactly 3 items per variant
     - At most one variant may have `default: true`
     - If any validation fails: stop and list the specific errors

3b. **Check for duplicate experiments and update repo description**

   1. Detect the GitHub org: run `gh repo view --json owner --jq '.owner.login'`.
      If this fails (not a GitHub repo, or `gh` not authed), skip this entire step silently.

   2. Update the repo description with idea.yaml `title`:
      ```bash
      gh repo edit --description "<idea.yaml title>"
      ```
      If this fails, warn but continue — description is cosmetic.

   3. Hard check — name collision:
      Run `gh repo list <org> --json name,url --limit 200 --no-archived`.
      If any repo name exactly matches idea.yaml `name` AND is not the current repo,
      stop: "A repo named '<name>' already exists in <org>: <url>. Pick a different
      `name` in idea.yaml or confirm with the team that this is intentional."

   4. Soft check — LLM-filtered duplicate detection:
      Run `gh repo list <org> --json name,description,url --limit 200 --no-archived`.
      Exclude the current repo from the list. Review the remaining repo names and
      descriptions against the current idea.yaml (`title`, `problem`, `solution`,
      `target_user`). Identify repos that appear to solve a substantially similar
      problem for a similar audience.

      If no suspicious matches → proceed silently.

      If suspicious matches found → present them:

      > **Potential overlaps detected.** These existing experiments may overlap with yours:
      >
      > | Repo | Description | Link |
      > |------|-------------|------|
      > | ... | ... | https://github.com/\<org\>/... |
      >
      > **Why these flagged:** [1-sentence reason per repo]
      >
      > If these are intentionally different (different audience, angle, or distribution),
      > proceed. If this is an accidental duplicate, stop and coordinate with the team.

      Wait for user confirmation before proceeding.

4. **Check preconditions**
   - If `.claude/current-plan.md` exists and the current branch starts with `feat/bootstrap`: a previous session completed Phase 1 (plan approved) but Phase 2 was not finished. Tell the user: "Found a previously approved plan in `.claude/current-plan.md`. Resuming Phase 2 implementation on this branch. Skipping Phase 1 planning." Then skip the rest of Phase 1 and jump directly to Phase 2: Step 1.
   - If `package.json` exists AND the `src/` directory contains application files (check for any `.ts` or `.tsx` files): stop and tell the user: "This project has already been bootstrapped. Use `/change ...` to make changes, or run `make clean` to start over."
   - If `package.json` exists but the `src/` directory does NOT contain application files: warn the user: "A previous bootstrap may have partially completed. I'll continue from the beginning — packages may be reinstalled." Note: the branch name `feat/bootstrap` may already exist from the previous attempt. If so, this run will use `feat/bootstrap-2` — you can delete the old branch later with `git branch -d feat/bootstrap`. Then proceed.

5. **Present the plan** in plain language the user can verify:

   ```
   ## What I'll Build

   **Pages:**
   - Landing Page (/) — [purpose from idea.yaml]
   - [Page Name] (/route) — [purpose from idea.yaml]
   - ...

   **Features:**
   - [feature 1] → built in [file(s)]
   - [feature 2] → built in [file(s)]
   - ...

   **Variants (if idea.yaml has `variants`):**
   - [slug] — "[headline]" → /v/[slug] [default if applicable]
   - [slug] — "[headline]" → /v/[slug]
   - Root `/` renders: [default variant slug]

   **Database Tables (if any):**
   - [table name] — stores [what]
   - ...

   **External Dependencies (decided in Phase 2, Step 4b):**
   - [service] — [credentials needed] — user chooses: Provide now / Skip
   - ...
   - (Or: "None — all features use stack-managed services")

   **Analytics Events:**
   - [For each EVENTS.yaml standard_funnel event, show: event_name on Page Name]
   - [For each payment_funnel event if stack.payment present, show: event_name on page/route]

   **Activation mapping:**
   - idea.yaml primary_metric: [metric]
   - activate event action value: "[concrete_action]" (e.g., "created_invoice") — or "N/A — all features are descriptive, activate will be omitted" if no feature involves an interactive user action

   **Tests (if stack.testing present):**
   - Template path: Full templates (all assumes met) | No-Auth Fallback (assumes unmet: [list])
   - Smoke tests for: [list each page name]
   - Funnel test: landing → [activate action] → login → [core value pages in order]

   **Questions:**
   - [any ambiguities — or "None"]
   ```

6. **STOP.** End your response here. Say:
   > Does this plan look right? Reply **approve** to proceed, or tell me what to change.

   DO NOT proceed to Phase 2 until the user explicitly replies with approval.
   If the user requests changes instead of approving, revise the plan to address their feedback and present it again. Repeat until approved.

7. **Save the approved plan.** Write the plan you presented above to `.claude/current-plan.md`. This file persists the plan across context compression and serves as the reference for checkpoint verification.

## Phase 2: Implement (only after the user has approved)

### Step 1: Project initialization
- Create `package.json` with `name` from idea.yaml and project setup from the framework stack file (.nvmrc, scripts, engines, tsconfig, config)
- Install packages from all stack files whose categories are present in idea.yaml `stack`
- Install dev dependencies from the framework and UI stack files
- Run the UI setup commands from the UI stack file
- After UI setup, verify the UI stack file's post-setup checks pass (PostCSS config, globals.css, scripts intact). If any post-setup check fails: stop and tell the user which check failed and how to fix it (e.g., "PostCSS config was overwritten by shadcn init — restore it from the framework stack file template"). Do not proceed to Step 2 until all post-setup checks pass.
- After post-setup checks pass, apply the theme customizations from the UI stack file's "Theme Setup" section: add CSS custom property overrides (`--primary`, `--radius`) to `globals.css`. Derive the primary hue from the product domain per `.claude/patterns/design.md` Section B, or use the default blue fallback. The font setup happens in Step 3 when `layout.tsx` is created.
- If any install command fails: stop, show the error, and ask the user to fix the environment issue. After fixing, tell Claude: "Continue the bootstrap on this branch from the install step." Claude will re-run the failed install and any subsequent install commands, then continue with Step 2. Do NOT re-run `/bootstrap` (that would create a duplicate branch). If you close this conversation: either (1) commit partial files on this branch (`git add -A && git commit -m "WIP: partial install"`), then tell Claude "Continue the bootstrap on this branch from the install step"; or (2) switch to main (`git checkout main`), run `make clean`, and start `/bootstrap` fresh.

### Step 2: Core library files
- Create the library files specified in each stack file's "Files to Create" section:
  - Analytics library (from the analytics stack file)
  - If `stack.database` is present: database clients (from the database stack file)
- If `stack.auth` is present, create auth files from the auth stack file using the correct conditional path:
  - If `stack.database` matches the auth provider (e.g., both `supabase`): auth shares the database client files — only create auth-specific pages (signup, login)
  - If `stack.database` is absent or a different provider: create standalone auth library files from the "Standalone Client" section (e.g., `supabase-auth.ts` instead of `supabase.ts`)
- If both `stack.auth` and `stack.payment` are present, create auth library files and pages first — payment templates reference `user.id` which requires auth.
- If `stack.payment` is present, create the payment library files from the payment stack file's "Files to Create" section. Note: the payment stack file's checkout route template intentionally references `user.id` which is undefined until auth is integrated — this will cause a build error at Checkpoint B that you must fix by adding the auth check (see the auth stack file's "Server-Side Auth Check" section). The webhook route template also contains a `// TODO: Update user's payment status in database` — unlike the auth check, this TODO compiles silently, so you must resolve it using the database schema planned in Phase 1.
- Replace placeholder constants: In BOTH analytics library files (`src/lib/analytics.ts` and `src/lib/analytics-server.ts`), replace `PROJECT_NAME = "TODO"` with the `name` from idea.yaml and `PROJECT_OWNER = "TODO"` with the `owner` from idea.yaml. These constants auto-attach to every event — if left as TODO, experiment filtering will fail.
- Generate `src/lib/events.ts` with typed track wrapper functions from EVENTS.yaml. For each event, create a function like `trackVisitLanding(props: { referrer?: string; utm_source?: string })` that calls `track("visit_landing", props)`. Only generate wrappers for standard_funnel events and (if stack.payment is present) payment_funnel events. Pages should import from `events.ts` instead of calling `track()` directly with string event names.
- If `stack.email` is present, add to EVENTS.yaml `custom_events`:
  - `email_welcome_sent` (trigger: Welcome email sent after signup, properties: `recipient` string required)
  - `email_nudge_sent` (trigger: Activation nudge email sent by cron, properties: `recipient` string required, `days_since_signup` integer required)

### Checkpoint A — verify library layer
- Re-read `.claude/current-plan.md` to confirm implementation aligns with the approved plan.
- Run `npm run build` to verify all library files compile correctly
- If the build fails: fix the errors in the library files before proceeding. These files are imported by every page — errors here cascade into everything downstream. After fixing, re-run `npm run build` to confirm.
- If the build still fails after 2 fix attempts, proceed to the next step without retrying further at this checkpoint — Step 8 (final verification in `.claude/patterns/verify.md`) has its own 3-attempt retry budget that will catch any remaining issues.

### Step 3: App shell
- Follow the framework stack file's file structure and page conventions
- **Root layout**: metadata from idea.yaml `title`, import globals.css. Set up the display font per the UI stack file's "Theme Setup" section (Inter via `next/font/google`, apply variable to `<html>`). Also implement `retain_return` tracking following the framework stack file's `retain_return` section and EVENTS.yaml
- **404 page**: simple not-found page with link back to `/`
- **Error boundary**: user-friendly message and retry button

### Step 4: Pages from idea.yaml
For each entry in idea.yaml `pages`:
- If `name` is `landing` → create the root page
- Otherwise → create a page at the appropriate route
- Every page file must:
  - Follow page conventions from the framework stack file
  - Import tracking functions per the analytics stack file conventions
  - Fire the appropriate EVENTS.yaml event(s) on the correct trigger
  - Apply the visual conventions from `.claude/patterns/design.md` — page-level spacing (Section C) and component conventions (Section D)
  - If a standard_funnel event from EVENTS.yaml has no matching page in idea.yaml (e.g., no signup page for signup_start/signup_complete), omit that event — do not create a page just to fire it
- **Landing page specifically**: follow the conversion structure in `.claude/patterns/messaging.md`. Derive headline, subheadline, and CTA from idea.yaml using the copy derivation rules (do NOT use `title` as the headline — that's the product name, not the value proposition). Use the landing page information architecture for section order. CTA links to the next logical page (signup if it exists in idea.yaml pages, otherwise the first non-landing page; if landing is the only page, build the idea.yaml features as sections on the landing page below the hero and use a CTA that scrolls to the first feature section via anchor link (e.g., `href="#get-started"`) — do not link to a nonexistent route or add functionality beyond what is listed in `features`; if any feature is interactive, fire `activate` when they complete that action — if all features are descriptive with no user action, omit the `activate` event and note the omission in the PR body). Fire the landing page event from EVENTS.yaml on mount with its specified properties.
- **Variant landing pages (if idea.yaml has `variants`)**: follow messaging.md Section D instead of Section A for copy derivation. Create these additional files:
  - `src/lib/variants.ts` — typed `VARIANTS` array (slug, headline, subheadline, cta, pain_points, isDefault) and `getVariant(slug: string)` helper that returns the matching variant or null
  - `src/components/landing-content.tsx` — shared `LandingContent` component that accepts variant props (headline, subheadline, cta, pain_points) and renders the Section B information architecture (Hero → Pain Points → Features → CTA Repeat). Features section is shared across all variants (from idea.yaml `features`).
  - Root `src/app/page.tsx` — renders `LandingContent` with the default variant's props (the one with `default: true`, or the first in the list). Fires `visit_landing` with `variant` property set to the default variant's slug.
  - `src/app/v/[variant]/page.tsx` — dynamic route that looks up the variant by slug via `getVariant()`, renders `LandingContent` with that variant's props, and returns `notFound()` for unknown slugs. Fires `visit_landing` with `variant` property. Uses `generateStaticParams()` to pre-render all variant routes.
  - The existing non-variant landing page instruction (above) applies when idea.yaml has NO `variants` field.
- **Auth pages (if listed)**: signup/login forms using auth provider UI (see auth stack file). Fire the corresponding EVENTS.yaml events at their specified triggers. Update the post-auth redirect in signup and login pages to navigate to the first non-auth, non-landing page from idea.yaml (e.g., `/dashboard`). If no such page exists, keep the redirect to `/`.
- If `stack.email` is present: wire the welcome email API call into the auth success callback. After `signup_complete` event fires, call `/api/email/welcome` with the user's email and name. Read the email stack file for the route handler template.
- **All other pages**: functional layout following `.claude/patterns/design.md` Section C (app pages), with heading, description matching the page's `purpose` from idea.yaml, and a clear next-action CTA. Not blank placeholders — each page should feel like a real product screen

> **STOP** — verify analytics before proceeding. Every page must fire its EVENTS.yaml event(s). Every user action listed in EVENTS.yaml must have a tracking call. Do not move to Checkpoint B until each event is wired. "I'll add analytics later" is not acceptable.

### Checkpoint B — verify pages layer
- Re-read `.claude/current-plan.md` to confirm implementation aligns with the approved plan.
- Run `npm run build` to verify all pages compile and their imports from the library files resolve correctly
- If the build fails: fix the errors in the page files (or in the library files they import from) before proceeding. After fixing, re-run `npm run build` to confirm.
- If the build still fails after 2 fix attempts, proceed to the next step without retrying further at this checkpoint — Step 8 (final verification in `.claude/patterns/verify.md`) has its own 3-attempt retry budget that will catch any remaining issues.

### Step 4b: Evaluate external dependencies

Before generating API routes, assess whether idea.yaml features require external services not covered by `stack`:

1. Read idea.yaml `features`. For each feature, assess: does it require credentials for an external service (OAuth, API key, webhook secret) that is NOT already handled by a `stack` category (database, auth, payment, email, analytics)?
   - Examples: "Connect Xero and import invoices" → Xero OAuth, "Send SMS via Twilio" → Twilio API key, "Sync with Google Sheets" → Google OAuth
   - Stack-handled services don't count: Supabase, Stripe, Resend, PostHog are already managed by their stack files

2. If NO external dependencies detected → skip to Step 5.

3. If external dependencies detected → present to the user:

   > These features require external service credentials not covered by your stack:
   >
   > | Feature | Service | Credentials needed |
   > |---------|---------|-------------------|
   > | ... | ... | ... |
   >
   > For each service, choose:
   > - **Provide now** — give me the credentials and I'll implement the full integration
   > - **Skip** — I'll create a stub route (returns 501). Run `/change` later to implement.

4. For each service where the user chooses "provide now":
   - Provide brief setup instructions for obtaining the credentials:
     - Where to sign up or access the developer console (include URL)
     - How to create the app/key (3–5 concrete steps)
     - Which credential values to copy (Client ID, API Key, Secret, etc.)
     - Note if a free tier or sandbox is available for MVP testing
   - Then ask the user for the credential values
   - Add env vars to `.env.local` (real values) and `.env.example` (placeholder values only — never real credentials)
   - Step 5 implements the full integration using the credentials (OAuth flow, API calls, etc.)

5. For skipped services:
   - Step 5 generates stub routes with a descriptive TODO comment explaining what credentials are needed
   - Add a note to the PR body under a "## Stub Routes" section listing which features are stubs and what credentials are needed to implement them

### Step 5: API routes
- Create the API routes directory per the framework stack file
- Create `/api/health` endpoint per the hosting stack file's Health Check template. Add service-specific checks based on active stack: database connectivity check when `stack.database` is present, auth service check when `stack.auth` is present, analytics reachability check when `stack.analytics` is present, payment config check when `stack.payment` is present.
- If idea.yaml features imply mutations (creating records, payments, etc.), create corresponding API route handlers. If `stack.payment` is present: for payment routes, use the templates from the payment stack file's "API Routes" section — these include auth-integration checks and webhook signature verification patterns that must not be omitted.
- For the webhook handler's `// TODO: Update user's payment status in database` comment: resolve it using the database schema you planned in Phase 1. If no payments/subscriptions table was planned, add one to the migration in Step 6 and return here to wire the webhook update after the table exists.
- Every API route: validate input with zod, return proper HTTP status codes. If `stack.database` is present, use the server-side database client for data access.
- Follow the hosting stack file for rate limiting guidance in auth and payment API route handlers. Mention any limitations in the PR body so the user knows to address them before production

### Step 6: Database schema (if needed)
If `stack.database` is present and idea.yaml features require persistent data:
- Follow the schema management approach from the database stack file
- Create the initial migration with all tables needed for idea.yaml features. Migration numbering is based on the current branch state — concurrent branches may create conflicting numbers, which should be resolved by renumbering at merge time.
- If `stack.payment` is present and a payments/subscriptions table was created: return to the webhook handler (`src/app/api/webhooks/stripe/route.ts`) and resolve the `// TODO: Update user's payment status in database` using the new table before proceeding to Step 7.
- If `stack.email` is present and the nudge route requires activation tracking: add `activated_at timestamptz` and `nudge_sent_at timestamptz` columns to the user-related table (or create a `user_status` table if no user table exists beyond Supabase auth). The nudge cron queries this to find un-activated, un-nudged users.
- Also create `src/lib/types.ts` with TypeScript types matching the table schemas
- Include post-merge database setup instructions in the PR body (see database stack file's "PR Instructions" section)

If no features require database tables, skip this step.

### Step 7: Environment config
- Generate `.env.example` by combining all environment variables from active stack files (framework, database, analytics, and any others that define env vars)

### Step 7b: Test scaffolding (if stack.testing is present)

If `stack.testing` is present in idea.yaml:
- Read the testing stack file at `.claude/stacks/testing/<value>.md`
- Check assumes: for each `category/value` in the testing stack file's `assumes` list, verify
  it matches idea.yaml `stack`. If all match → use full templates. If any unmet → use No-Auth
  Fallback templates.
- Install packages: `npm install -D @playwright/test && npx playwright install chromium`
- If using the full-auth path: install Supabase CLI (`npm install -D supabase`) and if
  `supabase/config.toml` does not exist, run `npx supabase init`
- Create files per the chosen template path:
  - `playwright.config.ts` (full or no-auth)
  - `e2e/helpers.ts` (full or no-auth)
  - If full-auth path: `e2e/global-setup.ts` and `e2e/global-teardown.ts`
- Generate `e2e/smoke.spec.ts` with one page-load test per idea.yaml page:
  ```ts
  test("[page name] loads", async ({ page }) => {
    await page.goto("/[route]");
    await expect(page).toHaveTitle(/.+/);
  });
  ```
  These are page-load smoke tests only — not full funnel tests with selectors.
- If idea.yaml has `variants`, also generate a smoke test per variant route:
  ```ts
  test("variant [slug] loads", async ({ page }) => {
    await page.goto("/v/[slug]");
    await expect(page).toHaveTitle(/.+/);
  });
  ```
- If `stack.testing` is present, generate `e2e/funnel.spec.ts` with a comprehensive funnel test:
  - Read the funnel test template from the testing stack file
  - Read idea.yaml pages and EVENTS.yaml to determine funnel sequence
  - Read actual page source files (created in Step 4) to extract real selectors
  - Generate tests: landing content → activate action (if applicable) → login → core value pages
  - For landing page CTA and success-message selectors, use `.first()` — the CTA Repeat section (messaging.md Section B) produces duplicate buttons and messages. Other pages have unique selectors and don't need `.first()`.
  - Use timestamped emails for form submissions to avoid duplicates
  - Skip retain_return (untestable in E2E)
- Add `.gitignore` entries per testing stack file
- Add `test:e2e` and `test:e2e:ui` scripts to `package.json`
- If the existing CI e2e job in `.github/workflows/ci.yml` does not match the chosen
  template path (full-auth vs. no-auth fallback), replace the `e2e:` job with the
  testing stack file's correct CI Job Template for that path.
- Add env vars from testing stack file to `.env.example` (based on chosen template path)
- NOTE: Tests are NOT run during bootstrap — only created

If `stack.testing` is NOT present in idea.yaml: skip this step entirely.

### Step 8: Verify before shipping
- Follow the FULL verification procedure in `.claude/patterns/verify.md`:
  1. Build & lint loop (max 3 attempts)
  2. Save notable patterns (if you fixed errors)
  3. Template observation review (ALWAYS — even if no errors were fixed)

### Step 8b: Spec compliance check

Re-read `.claude/current-plan.md` and `idea/idea.yaml` now. Verify each of these before proceeding to the PR:
- For each page in `pages`: confirm `src/app/<page-name>/page.tsx` exists (or root page for `landing`)
- For each feature in `features`: confirm the implementation addresses it
- For each standard_funnel event in `EVENTS.yaml`: confirm a tracking call exists in the appropriate page
- If `stack.payment` is present: confirm the webhook handler does not contain `// TODO: Update user's payment status` (this compiles silently — verify it was resolved in Step 5/6)
- If `stack.email` is present: confirm `vercel.json` contains the cron config, email routes exist, and welcome email is wired to auth callback
- If anything is missing, implement it now. Do not proceed with gaps.

### Step 9: Commit, push, open PR
- You are already on a feature branch (created in Step 0). Do not create another branch.
- Stage all new files and commit: "Bootstrap MVP scaffold from idea.yaml"
- Push and open PR using the `.github/PULL_REQUEST_TEMPLATE.md` format:
  - **Summary**: plain-English explanation — "Full MVP scaffold generated from idea.yaml" with key highlights
  - **How to Test**: "After merging: 1) Import your repo at vercel.com/new, 2) Connect Supabase via the Vercel integration (vercel.com/integrations/supabase) — it walks you through creating a Supabase project; database migrations are applied automatically during the first build, [If stack.payment is present: add Stripe env vars manually in Vercel Project → Settings → Environment Variables,] 3) Verify: visit your production URL and check each page, 4) For local verification: run `/verify` in Claude Code (auto-fixes failures), or `make verify-local` from terminal"
  - **What Changed**: list every file created and its purpose
  - **Why**: reference the idea.yaml problem/solution
  - **Checklist — Scope**: check all boxes (only built what's in idea.yaml)
  - **Checklist — Analytics**: list every event wired and which page fires it
  - **Checklist — Build**: confirm build passes, no hardcoded secrets, .env.example created
- Add a prominent note at the top of the PR body with post-merge instructions: database setup (from database stack file), environment variable setup (from .env.example)
- Fill in **every** section of the PR template. Empty sections are not acceptable. If a section does not apply, write "N/A" with a one-line reason.
- If `git push` or `gh pr create` fails: show the error and tell the user to check their GitHub authentication (`gh auth status`) and remote configuration (`git remote -v`), then retry the push and PR creation.
- Delete `.claude/current-plan.md` — the plan is now captured in the PR description.
- Tell the user: "Bootstrap PR created and ready to merge. Next: review the PR, merge to `main`, then run `/verify` to validate locally, and `/deploy` to set up cloud infrastructure and launch your app."

## Do NOT
- Add pages not listed in idea.yaml `pages`
- Add features not listed in idea.yaml `features`
- Add libraries not in idea.yaml `stack` (small utilities like clsx are fine)
- Add tests beyond the funnel happy path — bootstrap generates smoke tests and one funnel test; use /change for edge cases
- Violate the restrictions listed in the framework stack file
- Add placeholder "lorem ipsum" text — use real copy derived from idea.yaml
- Skip the build verification step
- Commit to main directly
