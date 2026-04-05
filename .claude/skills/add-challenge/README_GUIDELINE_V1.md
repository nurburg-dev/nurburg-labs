# Proposed challenge writeup format for nurburg

The headings specified in this guideline shouldnt be used verbatim. The headings only specify the structure of the content. The heading can be changed and related sections can be merged.

## The situation

A realistic narrative — not "implement a queue", but "your payments service is processing 50k events/min and consumers are falling behind. The on-call engineer just got paged." Sets stakes and context before any technical framing.

## Your dev environment on nurburg.dev

What's pre-provisioned: Kafka cluster config, Redis nodes, Postgres replica setup, etc. What the learner actually has access to. This is where nurburg's infrastructure moat becomes visible — other platforms can't show this.

Also provide step by step instruction on how to get started with the dev environment. This means

1. how to start server using `npm` or `make` commands
2. how to connect to db using `npm` or `make` commands which contains the cli command to connect to db with all the details including dev database's password.
3. any key schema file which contains db schema. also include `npm` or `make` task to import data to db if applicable.
4. `npm` task or `make` task containing the curl calls.

## Observable symptoms

Forces issue reproduction before solution. Add `npm` task or `makefile` to specify how to hit the issue describe in the situation. Describe the reproduction in ordered list.

## The task

Concrete, narrow goal with a clear success condition. "Reduce p99 consumer lag below 500ms within your session window." Not open-ended.

## Constraints

What they can't do - This forces real tradeoffs rather than just throwing resources at it or find workarounds defaating the purpose of the challenge. Make this an ordered list.

1. Examples - no schema changes for particular tables in some sql file, or always use `nurburg-libs` for testing
2. Always specify that any change in `.nurburgdev` directly is offlimits.

## Evaluation criteria - critical section

Explicit, observable, automated checks. "Consumer lag metric drops below threshold for 60 consecutive seconds." "No messages dropped (confirmed via offset comparison)." The more specific this is, the more the eval engine feels fair rather than opaque.

## Hints / guided Path - collapsible, optional

Progressive hints— not the answer, but the right question to ask next. Mirrors TryHackMe's approach of letting learners choose their difficulty. Syntax for hints

```md
<details>
<summary>Click to reveal a hint</summary>
This is the hint content
</details>
```

## What you're actually learning

Named concepts linked out to docs or your own markdown articles. "Partition rebalancing," "consumer group coordinator," etc.
Connects the hands-on to the theoretical, and seeds your SEO content.

__Linking the right way__ the URL should have the following format `https://nurburg.dev/nurburg-dev/nurburg-labs:{{blog-folder-name}}` where `blog-folder-name` is the folder in this nurburg-labs - git repository.
