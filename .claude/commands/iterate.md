---
description: "Use when you have analytics data and want to decide what to do next. Analysis only — no code changes."
type: analysis-only
reads:
  - idea/idea.yaml
  - EVENTS.yaml
  - idea/ads.yaml
stack_categories: [analytics]
requires_approval: false
references: []
branch_prefix: chore
modifies_specs: false
---
Review the experiment's progress and recommend what to do next.

This skill does NOT write code. It helps you decide what action to take, then points you to the right skill to execute it.

## Step 1: Read the experiment definition

- Verify `idea/idea.yaml` exists. If not, stop and tell the user: "No experiment found. Create `idea/idea.yaml` from the template first, then run `/bootstrap`."
- If `package.json` does not exist, stop and tell the user: "No app found. Run `/bootstrap` first to create the app, then run `/iterate` to review its progress."
- Run `npm run build`. If it fails, stop and tell the user: "The app has build errors. Run `/change fix build errors` to repair the codebase first, then return to `/iterate`."
- Verify `EVENTS.yaml` exists. If not, stop and tell the user: "EVENTS.yaml not found. This file defines all analytics events and is required. Restore it from your template repo or re-create it following the format in the EVENTS.yaml section of the template."
- Read `idea/idea.yaml` — understand the hypothesis:
  - What are we building? (`title`, `solution`)
  - For whom? (`target_user`)
  - What does success look like? (`primary_metric`, `target_value`)
  - How long do we have? (`measurement_window`)
  - What features exist? (`features`)
  - What pages exist? (`pages`)
- Read `EVENTS.yaml` — understand what's being tracked (this is the canonical list of all events)

## Step 2: Gather funnel data and user feedback

### 2a: Attempt auto-query for funnel numbers

Read the analytics stack file (`.claude/stacks/analytics/<value>.md`). If it has an "Auto Query" section, follow its credential check and query procedure to automatically fetch funnel data.

If the auto-query succeeds, present the results for user verification:

```
## Auto-fetched Funnel Data (last <N> days)
| Event | Unique Users |
|-------|-------------|
| <first standard_funnel event> | <count> |
| <second standard_funnel event> | <count> |
| ... | ... |
Source: Analytics Query API (project_name = "<name>")
**Please verify.** Reply "looks good" to proceed, or provide corrections.
```

- Show all events from the query, including those with 0 counts
- Wait for user confirmation before proceeding to Step 3 verdict
- If the user replies "looks good" (or any affirmative), proceed to Step 3 with the auto-fetched data
- If the user provides corrections (e.g., "visit_landing should be 500"), update the affected counts and re-present the table for confirmation. Use the corrected values in Step 3.

### 2b: Fall back to manual input

If the analytics stack file has no "Auto Query" section, or credentials are missing, or the query fails, fall back to manual input.

Tell the user how to get the numbers. See the analytics stack file's "Dashboard Navigation" section for provider-specific instructions on how to pull funnel numbers. If no stack file exists or it lacks a "Dashboard Navigation" section, give general guidance.

> **How to get your funnel numbers:**
> Follow the dashboard instructions in your analytics stack file (`.claude/stacks/analytics/<value>.md`). Create a funnel using the events from EVENTS.yaml `standard_funnel` in the order listed, then append `payment_funnel` events if `stack.payment` is present. Filter by `project_name` equals your idea.yaml `name` value. Present the actual event names to the user so they can find them in their dashboard.
>
> If you haven't deployed yet, the app isn't collecting data — run `/deploy` first, then return to `/iterate` after a few days of live traffic. If you haven't set up analytics yet, rough estimates are fine too (e.g., "about 200 landing page visits, maybe 20 signups").

Ask the user to provide funnel numbers — for each event in EVENTS.yaml `standard_funnel` (and `payment_funnel` if `stack.payment` is present), how many users? Present the actual event names from EVENTS.yaml so the user knows what to look for in their dashboard.

### 2c: Ask for qualitative data

Whether funnel numbers came from auto-query (2a) or manual input (2b), also ask the user to provide whatever they have. Not all of these will be available — use what you get:

1. **Custom event numbers** — if EVENTS.yaml `custom_events` is non-empty and not already fetched in 2a, ask for counts of each custom event. Include these in the Step 4 diagnosis as supplementary data below the standard funnel table.

2. **Timeline** — how far into the `measurement_window` are we?

3. **Qualitative feedback** — any user quotes, complaints, feature requests, support messages?

4. **Observations** — anything the team has noticed (e.g., "users sign up but never create an invoice", "landing page bounce rate is high")

5. **Variant comparison (if idea.yaml has `variants`)** — per-variant metrics:
   - `visit_landing` count per variant (filter by `variant` property)
   - `signup_complete` count per variant (if available, filter by UTM content or variant context)
   - `activate` count per variant (if available)
   - Which variant is getting the most traffic and which has the best conversion?

6. **Ads data (if /distribute has been run)** — if `idea/ads.yaml` exists:
   - Total spend so far
   - Clicks and CTR
   - Cost per click (CPC)
   - Conversions attributed to ads (`activate` events filtered by `utm_source` matching the channel from ads.yaml)

   How to get ads data: Open the campaign dashboard for your distribution channel and check Clicks, CTR, Avg CPC/CPM, Cost. For conversions: filter events in the analytics dashboard by `utm_source` matching the channel (e.g., `"google"`, `"twitter"`, `"reddit"` — see ads.yaml `channel` field).

## Step 3: Experiment Verdict

Before diagnosing details, assess overall experiment health. This verdict is the headline — present it first, prominently.

### 3a: Calculate progress

From the data gathered in Step 2, determine:
- **Time elapsed**: parse `measurement_window` (e.g., "2 weeks" = 14 days) and ask the user how many days have passed (or derive from timeline data in 2c). Calculate `time_pct = elapsed_days / total_days`.
- **Target progress**: compare the user's reported metrics against `target_value` from idea.yaml. Extract the target number and the closest matching metric (e.g., `target_value: "10 paid invoices"` → compare against `activate` or `pay_success` count). Calculate `target_pct = achieved / target_number`.
- **Pace**: `pace = target_pct / time_pct`. A pace of 1.0 means exactly on track; >1.0 means ahead; <1.0 means behind.
- **Budget progress (if ads running)**: if the user provided ads spend data, calculate `budget_pct = spent / total_budget`.

### 3b: Apply verdict framework

Present the verdict table and determination:

| Dimension | Value |
|-----------|-------|
| Time | Day [N] of [total] ([time_pct]% elapsed) |
| Target | [achieved] of [target] [metric] ([target_pct]% achieved) |
| Pace | [pace]x ([interpretation]) |
| Budget | $[spent] of $[total] ([budget_pct]%) — only if ads running |

Then apply the decision tree:

| Condition | Verdict |
|-----------|---------|
| time_pct < 25% AND total visits < 30 | **TOO EARLY** — not enough data for a verdict. Keep running, check back in a few days. |
| pace >= 0.7 | **GO** — on track. Continue and optimize conversion at the biggest bottleneck. |
| pace 0.3–0.7 AND time_pct < 60% | **MONITOR** — behind pace but recoverable. Focus on the biggest funnel bottleneck identified in Step 4. |
| pace < 0.3 AND time_pct > 50% | **NO-GO** — unlikely to reach target. Consider stopping or major pivot. |
| 0 activations AND time_pct > 30% | **NO-GO** — zero demand signal. Stop spending, re-evaluate positioning. |
| target_pct > 0 AND pace < 0.3 AND funnel has clear bottleneck | **PIVOT** — there's signal, but the angle is wrong. Change messaging or target user. |

Output the verdict prominently:

> ### Verdict: [GO / NO-GO / PIVOT / MONITOR / TOO EARLY]
>
> **[One-line reasoning]**

### 3c: Verdict caveats

- The verdict is a **guideline, not an order** — the user makes the final call
- Qualitative signals (user feedback, feature requests) can override quantitative pace
- If `target_value` is not cleanly numeric (e.g., "validate that freelancers will pay"), use the closest measurable proxy and note the approximation
- For experiments without ads (organic only), budget dimension is omitted

## Step 4: Diagnose the funnel

Analyze the data to find where the funnel breaks. Present a funnel visualization:

```
## Funnel Analysis

| Stage | Count | Conversion | Diagnosis |
|-------|-------|-----------|-----------|
| [1st standard_funnel event] | [count] | — | [diagnosis] |
| [2nd standard_funnel event] | [count] | [%] | ⚠️/✅/❌ [specific diagnosis] |
| ... (one row per EVENTS.yaml standard_funnel event) | ... | ... | ... |
| [payment_funnel events if stack.payment present] | ... | ... | ... |
| [retain_return] | [count] | — | [retention diagnosis] |

If `stack.payment` is absent from idea.yaml, omit the `pay_start` and `pay_success` rows from the funnel table.

> Note: `retain_return` is a retention metric, not a conversion step. Show it below the funnel or as a separate row — it does not have a meaningful conversion rate relative to the row above it.

## Biggest Bottleneck
Activation (signup → first value): 22% conversion
Users sign up but don't [complete the core action].
```

Focus on the **biggest drop-off** in the funnel. That's where effort has the highest leverage.

### Ads Performance (if ads.yaml exists)

If `idea/ads.yaml` exists and the user provided ads data in Step 2, include this table:

```
## Ads Performance

| Metric | Actual | Threshold | Status |
|--------|--------|-----------|--------|
| CTR | [%] | >1% | [status] |
| CPC | [$] | <$[max_cpc from ads.yaml guardrails.max_cpc_cents / 100] | [status] |
| Spend | [$] | /$[total_budget from ads.yaml budget.total_budget_cents / 100] | [status] |
| Paid activations | [N] | >=[thresholds.expected_activations from ads.yaml] | [status] |
```

Read `idea/ads.yaml` to populate threshold values. Use the user-provided ads data for actual values.

### Variant Winner Analysis (if idea.yaml has `variants`)

If the user provided per-variant metrics in Step 2, present a comparison:

```
## Variant Comparison

| Variant | Visits | Signups | Activations | Visit→Signup | Signup→Activate |
|---------|--------|---------|-------------|--------------|-----------------|
| [slug]  | [N]    | [N]     | [N]         | [%]          | [%]             |
| [slug]  | [N]    | [N]     | [N]         | [%]          | [%]             |

**Winner:** [slug] — [reason]
**Confidence:** [Clear (2x+ difference and 50+ visits per variant) | Likely (1.5x+ and 30+ visits) | Too early (<30 visits per variant — extend the test)]
```

- **Clear winner (2x+ conversion rate, 50+ visits per variant)**: recommend consolidating on the winning variant — remove the losing variant, update root `/` to the winner's messaging
- **Likely winner (1.5x+, 30+ visits)**: recommend extending the test for more data, or consolidating if time is short
- **Too early (<30 visits per variant)**: recommend extending the test duration or increasing traffic — no reliable signal yet
- **No winner (similar conversion rates)**: recommend testing a new messaging angle — current variants may not differentiate enough

## Step 5: Recommend actions

Based on the diagnosis, recommend 1-3 specific actions. For each:
- **What**: concrete description of the change
- **Why**: how it addresses the bottleneck
- **Skill to use**: which /command to run
- **Expected impact**: what metric should improve

Common patterns:

| Bottleneck | Typical Actions |
|-----------|----------------|
| Low visit → signup | `/change improve landing page copy and CTA` |
| Low signup_start → complete | `/change fix signup errors` or `/change reduce signup form friction` |
| Low activation | `/change simplify [first-value action]` |
| Low pay conversion | `/change improve pricing/payment UX` |
| Low retention | `/change add [engagement hook]` |
| Everything low | Reconsider `target_user` or `distribution` — may be a positioning problem, not a product problem |
| One variant clearly wins | `/change` to consolidate — remove losing variant, make winner the sole landing page |
| No variant winner | Extend test for more data, or `/change` to try a new messaging angle |

Present recommendations in priority order (highest impact first).

### Ads Decision (if ads.yaml exists and day 7 or budget exhausted)

If `idea/ads.yaml` exists but the user reported no ads data in Step 2 (campaign not yet launched), skip this section and instead note: "Ads config generated but campaign not yet launched. Create the campaign in your distribution channel's platform using `idea/ads.yaml`, then return to `/iterate` after a few days of data."

If `idea/ads.yaml` exists and the campaign has been running for the full `budget.duration_days` or `budget.total_budget_cents` is exhausted, present a go/no-go decision:

| Signal | Interpretation | Action |
|--------|---------------|--------|
| 3+ paid activations | Demand validated | Continue: increase budget or `/change` to improve conversion |
| 1-2 paid activations | Weak signal | Extend 3 days or improve landing page, then re-evaluate |
| 0 activations, >10 signups | Activation problem | `/change` to reduce activation friction |
| 0 activations, >50 clicks, <3 signups | Landing page problem | `/change` to improve landing page |
| 0 activations, <50 clicks, <1% CTR | Targeting problem | Revise targeting in ads.yaml, re-run `/distribute` |
| 0 activations, <50 clicks, >1% CTR | Budget/time problem | Extend budget or measurement window |

Read `thresholds.go_signal` and `thresholds.no_go_signal` from `idea/ads.yaml` and use them as the primary decision criteria. The table above provides additional diagnostic detail.

## Step 6: Update the experiment plan (if needed)

If the diagnosis reveals a need to change direction:

### Minor pivot (keep same target user, adjust features)
- Propose the changes to the user and list the specific edits to idea.yaml
- The user should edit idea.yaml manually, then run `/change ...` to implement the changes (or `make clean` followed by `/bootstrap` to rebuild from scratch)

### Pivot (verdict is PIVOT — signal exists but wrong angle)
- Identify what IS working (which funnel stage converts well)
- Propose messaging or positioning changes that preserve what works
- The user should run `/change` to adjust copy/CTA/targeting, NOT rebuild from scratch

### Major pivot or stop (verdict is NO-GO)
- Present the case: "The Step 3 verdict is NO-GO. The data suggests [current approach] isn't working because [reason]. Consider targeting [new user] or solving [different problem]."
- Do NOT update idea.yaml for major pivots — the user should think about this and manually edit idea.yaml
- Remind them: "After updating idea.yaml, run `make clean` then `/bootstrap` to start a new experiment (or in a fresh repo), or `/change ...` to iteratively shift the existing one."

### On track (verdict is GO)
- Say so clearly: "The Step 3 verdict is GO. You're on track. [X] of [target_value] achieved with [Y days] remaining."
- Recommend: keep going, focus on distribution, or run `/change improve conversion` to improve conversion

## Step 7: Summarize next steps

End with a clear, numbered action list. Prepend the verdict from Step 3:

```
## Recommended Next Steps

**Verdict: [GO/NO-GO/PIVOT/MONITOR/TOO EARLY]** — [one-line summary]

1. Run `/change sharpen landing page headline to address [specific user pain]`
2. Run `/change add onboarding checklist after signup`
3. Post in [distribution channel from idea.yaml] — drive more top-of-funnel traffic

Your measurement window ends in [X days]. [Verdict-specific guidance].
```

### Retro reminder
If the experiment is near the end of its `measurement_window` or the user is considering stopping:
> Your measurement window ends in [X days]. When you're ready to wrap up, run **`/retro`** to generate a structured retrospective and file it as feedback on the template repo.

### Next Check-in

Based on the measurement window and current progress, provide a concrete schedule:

```
## Next Check-in

| Milestone | Date | Action |
|-----------|------|--------|
| Next data check | [3 days from now] | Run `/iterate` again |
| Decision point | [when time_pct hits 50%] | Verdict becomes actionable — MONITOR/NO-GO verdicts require decision |
| Window closes | [measurement_window end date] | Run `/retro` to file retrospective |
```

- Calculate dates from `measurement_window` and the elapsed days reported in Step 3
- If verdict is TOO EARLY, set next check-in to 3 days or when 30+ visits are expected
- If verdict is NO-GO, the next check-in is NOW — recommend immediate decision
- Tell the user: "Set a calendar reminder for [next check-in date] to run `/iterate` again."

## Do NOT
- Write code or modify source files — this skill is analysis only
- Recommend more than 3 actions — focus is more valuable than breadth
- Recommend actions outside the defined commands (bootstrap, change, iterate, retro, distribute, verify)
- Be vague — every recommendation must be specific enough to act on
- Ignore the data — don't recommend features if the funnel shows a landing page problem
- Recommend adding features when the real problem is distribution or positioning
