---
name: add-blog
description: Scaffold a blog in this git repository
argument-hint: <blog-name>
---

# Add blog 

Scaffold a new blog in this git repository. Steps are as follows
1. create a folder with name format `blog-[id]` where id is a short `-` separated name derived from `blog-name` arguement
2. inside the folder created preceing create `.nurburgdev` directory and a file `.nurburgdev/README.md`
3. in `.nurburgdev/README.md` add frontmatter with the following format

```md
---
title: "The books didn't balance. Here's how the outbox pattern saved our distributed transaction"
author: Anunay Biswas
authorLink: https://github.com/anunaybiswas
authorTitle: Software Engineer
summary: "How the outbox pattern eliminates phantom transactions between your database and event stream — and why at-least-once delivery with idempotent consumers is the right tradeoff."
publishedOn: 2026-03-28
tags: [postgres, kafka, distributed-systems]
intent: experiment
draft: true
---
```
Complete list of tags can be found in `docs/specification-for-experiments.md` file

In body of the markdown never use `h1` or `#` heading. Use `##` or `###` or `####` or `#####` or `#####`  