# Getting started

This guide walks you through adding a new experiment to nurburg-labs.

## Prerequisites

- A GitHub account and a fork of this repository
- Your service source code (Node.js, Go, Python, or Java)

## Using AI coding agents

AI coding agents (Claude Code, Copilot, etc.) can scaffold your experiment for you. This repo includes an `AGENT.md` file at the root that instructs agents on the correct structure, file paths, and rules for this repository.

To get started with an agent, describe your experiment idea and ask it to scaffold the experiment folder, `experiment.toml`, k6 script, and README.

**IMPORTANT** - once code is scaffolded please use the good-old human intelligence to develop the experiment and writeup as much as possible to ensure quality.

## 1. Create a folder for your experiment

At the repo root, create a folder with a short, descriptive, hyphenated name. By convention, prefix the folder name with your intent — `challenge-` for a challenge submission or `experiment-` for an exploration:

```text
experiment-my-project/
```

## 2. Write the README writeup (most important step)

Write `experiment-my-project/.nurburgdev/README.md` inside the folder you created in step 1. This is the article that appears on nurburg.dev — it is the most important part of your experiment. A well-written experiment explains the problem clearly, motivates the design choices, and gives readers something to learn from. The benchmark results are only meaningful if the writeup provides the context to interpret them.

A good README should cover:

- **What problem you're solving** — what bottleneck, failure mode, or design question motivated the experiment
- **How the system is designed** — architecture, key components, and why you made the choices you did
- **What the results mean** — interpret the scores and charts, not just report them
- **What a reader should take away** — the insight or lesson the experiment demonstrates

The README requires a YAML frontmatter block at the top:

```markdown
---
title: "Cache-aside with Redis"
author: "Your Name"
authorLink: "https://github.com/your-handle"
authorTitle: "Software Engineer"
summary: "Benchmark a cache-aside pattern to reduce database read load."
publishedOn: 2026-03-24
tags: [redis, scalability]
intent: "experiment"
video: "https://youtube.com/..." # optional
heroImage: "hero.png" # optional
draft: true
---

Describe the system design you're testing and why it's interesting...
```

For challenges, set `intent: "challenge"` and include a `challengeDetails` block:

```markdown
---
...
intent: "challenge"
challengeDetails:
  id: 1234
  difficulty: "medium"
  points: 100
  language: "go"
---
```

> **Set `draft: true` when submitting your PR.** After the PR is merged, a final round of testing is run on nurburg.dev. Once results look good, update the frontmatter to `draft: false` to publish the experiment publicly.

**Valid tags:** `mysql`, `postgres`, `redis`, `memcached`, `kafka`, `temporal`, `scalability`, `debugging`, `analytics`, `distributed-systems`

See [specification-for-experiments.md](specification-for-experiments.md) for the full README format including sidenotes, code block annotations, and the fork badge.

## 3. Add a devcontainer

Your experiment folder should include a `.devcontainer/` directory so contributors can open the project in a consistent development environment. Rather than writing one from scratch, copy the `.devcontainer/` folder from an existing experiment in this repo that uses the same runtime as your service.

```text
my-experiment/
├── .devcontainer/
│   └── devcontainer.json
└── src/
```

## 5. Add your service source code

Put your service source inside the experiment folder. The layout is up to you — a common convention is a `src/` subdirectory:

```text
my-experiment/
└── src/
    └── main.go   # or index.js, main.py, Main.java, etc.
```

## 6. Create the `.nurburgdev/` directory

Inside your experiment folder, create a `.nurburgdev/` directory. This is where the experiment definition and your README live:

```text
my-experiment/
├── .nurburgdev/
│   ├── experiment.toml
│   ├── traffic.js        # if you're running a load test
│   └── README.md
└── src/
```

## 7. Write `experiment.toml`

Create `.nurburgdev/experiment.toml`. At minimum you need one `[[service]]` and one task.

```toml
description = "Cache-aside pattern with Redis"

[[service]]
name = "app"
runtime = "go"
port = 8080
healthCheckUrl = "/health"
cpuCores = 0.5
memoryMB = 256
instances = 1
directory = "my-experiment/src"

[service.env]
REDIS_URL = "redis://cache:6379"

[[redis]]
name = "cache"
cpuCores = 0.5
memoryMB = 256
storageGB = 1
password = ""

[[traffic]]
file = "my-experiment/.nurburgdev/traffic.js"
cpuCores = 0.5
memoryMB = 256

[traffic.env]
TARGET_URL = "http://app:8080"

[[score]]
name = "ERR_RATE"
taskName = "traffic"
threshold = 1.0

[[score]]
name = "LATENCY_95"
taskName = "traffic"
threshold = 200.0

[[telemetry]]
name = ["POD_CPU", "POD_MEMORY"]
componentName = "app"

[[telemetry]]
name = ["ERROR_RATE", "P95_DURATION", "REQUEST_PER_MIN"]
taskName = "traffic"
```

For the full list of fields, component types, score names, and telemetry metrics, see the [specification](specification-for-experiments.md).

## 8. Write a k6 load test script

Create `.nurburgdev/traffic.js`. A minimal script:

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m",  target: 20 },
    { duration: "30s", target: 0  },
  ],
};

export default function () {
  http.get(`${__ENV.TARGET_URL}/api/items`);
  sleep(1);
}
```

## 9. Open a pull request

Push your branch and open a PR against `main`. The folder structure for a finished experiment looks like this:

```text
my-experiment/
├── .devcontainer/
│   └── devcontainer.json
├── .nurburgdev/
│   ├── experiment.toml
│   ├── traffic.js
│   └── README.md
└── src/
    └── ...
```

## Next steps

- [Specification reference](specification-for-experiments.md) — all fields, score names, and telemetry metrics
- [nurburg.dev](https://nurburg.dev) — run your experiment using nd cli as specified in [specifications](specification-for-experiments.md)
