---
description: "Generate distribution campaign config from idea.yaml. Requires a deployed MVP."
type: code-writing
reads:
  - idea/idea.yaml
  - EVENTS.yaml
  - idea/ads.yaml
stack_categories: [analytics, hosting, distribution]
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
  - .claude/patterns/messaging.md
branch_prefix: chore
modifies_specs: true
---
Generate a distribution campaign configuration from idea.yaml and implement distribution tracking.

This skill generates `idea/ads.yaml` with targeting, ad creative, budgets, and thresholds, then adds UTM/click ID capture and a feedback widget to the deployed app. The channel is selected at runtime — each channel has a stack file at `.claude/stacks/distribution/<channel>.md` with format constraints, targeting model, policy restrictions, and config schema. Phase 1 is manual — the human creates the campaign in the channel's ad platform using the generated config.

## Step 0: Branch setup

Follow `.claude/patterns/branch.md`. Branch: `chore/distribute`.

## Step 1: Validate preconditions

1. Verify `idea/idea.yaml` exists and is complete. If not, stop: "No experiment found. Create `idea/idea.yaml` from the template first, then run `/bootstrap`."
2. Verify `EVENTS.yaml` exists. If not, stop: "EVENTS.yaml not found. This file defines all analytics events and is required."
3. Verify `EVENTS.yaml` contains a `custom_events` key that is a list (empty list `[]` is valid). If not, stop: "EVENTS.yaml is malformed — the `custom_events` key is missing or not a list. Run `make validate` to diagnose, or restore the file from the template."
4. Verify `package.json` exists. If not, stop: "No app found. Run `/bootstrap` first to create the app, deploy it, then run `/distribute`."
5. Verify the app is deployed: check `landing_url` in existing `idea/ads.yaml`, or ask the user for the deployed URL.
6. **Channel selection:**
   1. List available channels by scanning `.claude/stacks/distribution/*.md` (strip the `.md` extension to get channel names)
   2. Ask: "Which distribution channel? Available: [channels]. Enter channel name:"
   3. Read the selected channel's stack file at `.claude/stacks/distribution/<channel>.md`
7. **Policy check:**
   1. Read idea.yaml `problem` and `solution`
   2. Match against restricted-industry keywords: `crypto`, `DeFi`, `token`, `ICO`, `blockchain`, `NFT`, `yield`, `staking`, `liquidity`, `protocol`, `wallet`, `exchange`, `mining`, `DAO`
   3. If match found, read the selected channel's "Policy Restrictions" section
   4. If the channel restricts or bans the category, warn the user: "⚠ Your experiment mentions [keyword]. [Channel] [restricts/bans] this category: [details]. Consider switching to [alternative channels that allow it]."
   5. Non-blocking — the user can confirm to proceed or switch channel
8. Verify `stack.analytics` is present in idea.yaml. If not, stop: "Analytics is required for distribution tracking. Add `analytics: posthog` (or another provider) to idea.yaml `stack` and run `/bootstrap` first."
9. Verify the analytics stack is configured: read the analytics stack file's `env` frontmatter. If `env.client` lists a client env var, check that it appears in `.env.example`. If the env var is not found in `.env.example`, stop: "Analytics is not configured. Verify `.env.example` contains the analytics client key, or run `/bootstrap` first to scaffold the app with analytics." If `env.client` is empty, the stack uses hardcoded keys (e.g., PostHog's shared publishable key) — skip this check.
10. If `idea/ads.yaml` already exists, ask: "An ads config already exists. Generate a new version (v2)?"

## Step 2: Research targeting

Read `idea/idea.yaml`: `problem`, `solution`, `target_user`, `title`, `features`.

Read the selected channel's stack file "Targeting Model" section, then generate targeting research appropriate for the channel:

**For keyword-based channels (e.g., google-ads):**

```
## Keyword Research

**Target user intent:** [what the target_user would search for when experiencing the problem]
**Competitor landscape:** [known alternatives mentioned in problem statement]
**Search volume estimate:** [high/medium/low for this niche]

**Recommended keywords:**
- Exact match: [5-8 keywords] — highest intent, most specific
- Phrase match: [3-5 keywords] — moderate intent
- Broad match: [2-3 keywords] — discovery, wider net
- Negative: [5+ keywords] — exclude irrelevant traffic (enterprise, existing tools, etc.)
```

Keyword rules (google-ads):
- Minimum 3 exact, 2 phrase, 1 broad, 2 negative
- Exact match keywords target users actively looking for this type of solution
- Phrase match captures related searches with moderate intent
- Broad match casts a wider net for discovery
- Negative keywords exclude enterprise, existing well-known tools, and irrelevant traffic

**For interest/audience-based channels (e.g., twitter):**

```
## Audience Research

**Target user profile:** [who the target_user is on this platform]
**Competitor/influencer accounts:** [relevant handles to target]

**Recommended targeting:**
- Interests: [3-5 interest categories]
- Follower lookalikes: [3-5 competitor/influencer handles]
- Timeline keywords: [3-5 keywords users tweet about]
```

**For community-based channels (e.g., reddit):**

```
## Community Research

**Target communities:** [where the target_user congregates]
**Community tone:** [how this community expects to be addressed]

**Recommended targeting:**
- Subreddits: [3-5 relevant subreddits]
- Interest categories: [2-3 Reddit interest categories]
```

## Step 3: Generate ad creative

Derive from idea.yaml `title`, `solution`, and `primary_metric`.

### Ad format constraints

Read the selected channel's stack file "Ad Format Constraints" section for character limits, creative format, and minimum variations. Apply these constraints when generating ad copy.

### Copy principles
- Headline = outcome for target_user (what they get)
- Description/body = proof + CTA (why believe + what to do next)
- Include the landing URL with UTM parameters — read the channel's stack file "UTM Parameters" section for `utm_source` and `utm_medium` values: `?utm_source={channel_source}&utm_medium={channel_medium}&utm_campaign={campaign_name}`

### Message match
Follow the message match rules in `.claude/patterns/messaging.md`. Ad headlines must be shortened versions of the landing page headline (the value proposition, not the product name). If the app has already been bootstrapped, read `src/app/page.tsx` to extract the actual landing headline and derive ad headlines from it. Note that character constraints are channel-specific — read the stack file's "Ad Format Constraints" for the channel's limits.

### Variant ad groups (when idea.yaml has `variants`)
When idea.yaml has a `variants` field, generate per-variant creative:
- Create a separate ad group/creative set per variant
- Each variant's creative is derived from that variant's `headline` field (not from the shared `solution`)
- Each variant's landing URL includes `utm_content={slug}` (e.g., `?utm_source={source}&utm_medium={medium}&utm_campaign={campaign_name}&utm_content=speed`)
- Each variant's landing URL points to `/v/{slug}` (e.g., `https://example.vercel.app/v/speed?...`)
- Follow messaging.md Section D: ad headlines for a variant match that variant's landing page headline
- See `idea/ads.example.yaml` for schema format examples

## Step 4: Generate thresholds

Read the channel's stack file "Cost Model" section to understand the pricing model, then use first-principles reasoning specific to this MVP:

**For CPC channels (e.g., google-ads):**
1. Parse `budget.total_budget_cents` and estimate CPC for the targeting category
2. Calculate: expected clicks = budget / CPC
3. Estimate funnel conversion rates:
   - Landing → signup: 5-15% for cold paid traffic
   - Signup → activate: 20-40% depending on activation friction
4. Calculate expected volume at each stage

**For CPM channels (e.g., twitter, reddit):**
1. Parse `budget.total_budget_cents` and estimate CPM for the targeting category
2. Calculate: expected impressions = budget / (CPM / 1000)
3. Calculate: expected clicks = impressions × estimated CTR
4. Estimate funnel conversion rates (same as above)
5. Calculate expected volume at each stage

Show the reasoning chain, not just the numbers:

```
## Threshold Reasoning

Budget: $100 over 7 days
Estimated [CPC/CPM] for [targeting category]: ~$X.XX
Expected [clicks/impressions]: [calculation]
Expected signups: [clicks * landing-to-signup rate] ([rate]% — [reasoning])
Expected activations: [signups * signup-to-activate rate] ([rate]% — [reasoning])

Go signal: [N]+ activations from paid traffic in [measurement_window]
No-go signal: 0 activations after $[half-budget] spend, or <1% CTR after 500 impressions
```

4. Define go/no-go signals based on idea.yaml `target_value` and `measurement_window`

### Schema rules for ads.yaml
- `channel`: the selected distribution channel (e.g., `google-ads`, `twitter`, `reddit`)
- `campaign_name`: auto-generated following the channel's config schema pattern (e.g., `{idea.name}-search-v{N}` for google-ads, `{idea.name}-twitter-v{N}` for twitter)
- `budget.total_budget_cents`: defaults to 10000 ($100), max 50000 ($500) without explicit override
- `budget.duration_days`: defaults to idea.yaml `measurement_window` parsed to days
- `guardrails`: channel-specific — CPC channels require `max_cpc_cents`; other channels may use `max_cpe_cents` or just `auto_pause_rules`
- `thresholds`: AI-generated from idea.yaml context using first-principles reasoning

## Step 5: Generate ads.yaml

Write the complete `idea/ads.yaml` file. Include `channel: <selected-channel>` as the first field. Follow the selected channel's stack file "Config Schema" section for the channel-specific structure. See `idea/ads.example.yaml` for full schema examples across channels.

Present the full config for review.

## Step 6: STOP for approval

> Review the ads config above. Reply **approve** to proceed, or tell me what to change.
> After approval, I'll set up conversion tracking and open a PR.

**Do not proceed until the user approves.**

## Step 7: Implement (after approval)

### 7a: UTM capture on landing page

- Read the analytics stack file (`.claude/stacks/analytics/<value>.md`) to understand the tracking API
- Ensure `visit_landing` event captures `utm_source`, `utm_medium`, `utm_campaign` from URL params
- EVENTS.yaml has these as optional properties on `visit_landing` — the landing page must parse them from `window.location.search` and pass them to the tracking call
- Update the landing page to parse URL params and include them in the visit tracking call

- When idea.yaml has `variants`, also capture `utm_content` from URL params alongside UTM params. This maps to the variant slug and enables per-variant attribution in analytics (e.g., filter `visit_landing` by `utm_content = "speed"` to see paid traffic for the speed variant).

### 7b: Add click ID capture

- Read the selected channel's stack file "Click ID" section to get the parameter name (e.g., `gclid` for google-ads, `twclid` for twitter, `rdt_cid` for reddit)
- Capture the channel's click ID from URL params on landing page load alongside UTM params
- Store the value as the generic `click_id` property in the `visit_landing` analytics event (EVENTS.yaml defines `click_id` as an optional property)
- Also capture `gclid` separately for backward compatibility (it remains an optional property on `visit_landing`)
- This enables conversion attribution in the channel's ad platform

### 7c: Feedback widget (post-activation)

Add `feedback_submitted` to EVENTS.yaml `custom_events`:

```yaml
custom_events:
  - event: feedback_submitted
    trigger: User submits post-activation feedback widget
    properties:
      source:
        type: string
        required: false
        description: "How the user found the product (e.g., google, friend, social)"
      feedback:
        type: string
        required: false
        description: Free-text feedback from the user
      activation_action:
        type: string
        required: true
        description: What activation action preceded this (from idea.yaml primary_metric)
```

Add a `FeedbackWidget` component at `src/components/feedback-widget.tsx`:

- Uses shadcn `Dialog`, `Button`, `Label`, `Textarea`, and `Select` components (read the UI stack file for import conventions)
- Appears after the user completes the activation action (triggered via prop callback)
- Stores "shown" flag in localStorage to show only once per user
- Fires `feedback_submitted` custom event via `track()` from the analytics library (see analytics stack file for the import path and `track()` usage)
- Fields: "How did you find us?" (select: Google Search, Social Media, Friend/Referral, Other), "Any feedback?" (textarea)
- Non-blocking: user can dismiss without submitting

### 7d: Demo mode recommendation

If the app requires signup/auth before the user can see value, add a note to the PR body recommending a demo/preview mode. This is a recommendation only — implementing the demo is a separate `/change` task.

### 7e: Conversion sync setup instructions

Add a `## Distribution Setup` section to the PR body with step-by-step instructions. Read the selected channel's stack file "Setup Instructions" section and include those steps. Also read the analytics stack file for provider-specific destination/integration instructions.

Also include analytics dashboard setup instructions (read the analytics stack file's Dashboard Navigation section for provider-specific terminology):

### Ads Dashboard Setup

1. Go to the analytics dashboard -> New dashboard -> "Ads Performance: {project_name}"
2. Add these insights (read the channel's stack file "UTM Parameters" section for the correct `utm_source` value):
   - **Traffic by Source**: Trend chart, event `visit_landing`, breakdown by `utm_source`, last 7 days
   - **Paid Funnel**: Funnel chart, events `visit_landing` (filtered: utm_source = {channel_source}) -> `signup_complete` -> `activate`, last 7 days
   - **Cost per Activation**: Number (manual calculation) — Total channel spend / activate count where utm_source = {channel_source}
   - **Feedback Summary**: Trend chart, event `feedback_submitted`, breakdown by `source` property, last 7 days

## Step 8: Verify and open PR

Run the verification procedure per `.claude/patterns/verify.md`.

Commit, push, and open a PR with:
- **Summary**: what was generated and why (include the selected channel)
- **Distribution Setup**: step-by-step channel + analytics setup instructions (from stack file)
- **What Changed**: files modified (landing page UTM capture, EVENTS.yaml, ads.yaml, FeedbackWidget)
- The full `ads.yaml` content in the PR body for easy review

## Step 9: Post-merge campaign creation

After the PR is merged, attempt automated campaign creation if the channel supports it.

### 9a: Check API support

1. Read `channel` from `idea/ads.yaml`
2. Read the channel's stack file at `.claude/stacks/distribution/<channel>.md`
3. If the stack file contains an "API Campaign Creation" section → proceed to **9b**
4. If not (e.g., reddit) → skip to **9f** (manual fallback)

### 9b: Check for existing campaign

1. If `idea/ads.yaml` has a `campaign_id` field → campaign already created (idempotent), skip to **9g**
2. If not → proceed to **9c**

### 9c: Check credentials

1. Read the "Credential Files" subsection from the channel's "API Campaign Creation" section
2. For each credential file listed, check if it exists: `test -f <path>`
3. If **ALL** files exist → proceed to **9d**
4. If **ANY** are missing → guide the user through credential setup:
   1. Show which credential files are missing
   2. Read the "Setup" subsection from the channel's "API Campaign Creation" section
   3. Walk the user through each setup step interactively
   4. As each credential is provided, save it: `mkdir -p <dir> && echo "$VALUE" > <path>`
   5. After all credentials are saved → proceed to **9d**
   6. No "skip" option — credentials are required for campaign creation. If the user cannot set up credentials now, they should re-run `/distribute` later when ready.

### 9d: STOP for approval

Show a campaign creation preview:

> **Ready to create campaign via API**
> - **Channel:** {channel}
> - **Campaign name:** {campaign_name}
> - **Budget:** ${total_budget_cents / 100} over {duration_days} days
> - **Targeting summary:** {keyword count or audience summary}
> - **Ad count:** {number of ads/tweets}
> - **Status:** Campaign will be created in **PAUSED** status (you enable it after verifying tracking)
>
> This will use real ad platform credentials. Reply **approve** to create the campaign, or tell me what to change.

**Do not proceed until the user approves.** This is a second approval gate — Step 6 approves the config, Step 9d approves actual campaign creation with real credentials.

### 9e: Create campaign via API

1. Read the "API Procedure" subsection from the channel's "API Campaign Creation" section
2. Follow the procedure step-by-step, using the credentials from **9c** and the config from `idea/ads.yaml`
3. Campaign is created in **PAUSED** status (safety — user enables after verifying tracking)
4. On success:
   - Extract the campaign ID and dashboard URL from the response (see "Response Handling" subsection)
   - Add `campaign_id: <id>` and `campaign_url: <url>` to `idea/ads.yaml`
   - Commit the updated `idea/ads.yaml` to `main`
5. On failure:
   - Read the "Error Handling" subsection for guidance on the specific error
   - Report the error to the user
   - Fall through to **9f**

### 9f: Manual fallback

Only reached when:
- (a) The channel's stack file has no "API Campaign Creation" section (e.g., reddit), or
- (b) The API call in **9e** failed

> Create the campaign manually using the config in `idea/ads.yaml`.
> See the channel's stack file "Setup Instructions" section for step-by-step guidance.

### 9g: Next steps

> Your distribution campaign is ready. Next steps:
> 1. **Enable the campaign** — it was created in PAUSED status. After verifying conversion tracking, enable it in the ad platform dashboard.
> 2. **Verify conversion tracking** by clicking your own ad and completing the activation flow — confirm the event appears in your analytics dashboard.
> 3. **Monitor performance** — after the campaign runs for a few days, run `/iterate` to analyze your metrics and decide what to change next.

## Do NOT

- Create a campaign via API without showing the approval preview (Step 9d) — real money is at stake
- Create a campaign if `campaign_id` already exists in `idea/ads.yaml` — campaigns are idempotent
- Skip credential setup — if credentials are missing, guide the user through setup; do not fall back to manual campaign creation
- Hardcode credential file paths — read from the channel's stack file "Credential Files" subsection
- Modify idea.yaml — this skill reads it but does not change it
- Add new packages — the feedback widget uses existing shadcn components and the analytics library
- Skip the config approval step (Step 6) — the operator must review targeting, ad creative, and budget before proceeding
- Hardcode analytics import paths or provider names — always read the analytics stack file for the correct imports
- Hardcode channel-specific constraints (char limits, click ID params, UTM values) — always read the distribution stack file for the selected channel
