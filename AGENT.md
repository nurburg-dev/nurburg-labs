# AGENT.md — nurburg-labs contributor guide for AI agents

This file instructs AI coding agents (Claude Code, Copilot, etc.) how to contribute experiments to this repository correctly.

## What this repo is

nurburg-labs is a collection of backend system design experiments for [nurburg.dev](https://nurburg.dev). Each top-level folder is a self-contained experiment: service source code plus a `.nurburgdev/` directory containing the experiment definition and a written writeup.

## How experiments are structured

```
my-experiment/
├── .nurburgdev/
│   ├── README.md          # the written article — most important file
│   ├── experiment.toml    # infrastructure and test definition
│   └── traffic.js         # k6 load test script (if applicable)
└── src/                   # service source code
```

All experiment files live inside their own top-level folder. Never place experiment files at the repo root.

## Specification

The full experiment format — all fields, component types, task types, score names, telemetry metrics, and README frontmatter — is defined in [`docs/specification-for-experiments.md`](docs/specification-for-experiments.md). Read it before generating any experiment files.

## Checklist before opening a PR

- [ ] `.nurburgdev/README.md`
- [ ] Frontmatter has all required fields; `draft: true`
- [ ] `experiment.toml` has no missing required fields
- [ ] All file paths in `experiment.toml` are relative to the repo root
- [ ] Score and telemetry names are valid per the specification
- [ ] Service builds and the health check endpoint is implemented
