# nurburg-labs

A community collection of backend system design experiments for [nurburg.dev](https://nurburg.dev) — a platform that deploys your service in an isolated environment, runs load tests and API tests against it, and scores the results so you can compare designs.

## What's in this repo

Each top-level folder is a self-contained experiment. An experiment defines:

- The **service** to deploy (Node.js, Go, Python, or Java)
- Any **databases** it depends on (Postgres, MySQL, Redis, Kafka, Temporal)
- **Tasks** to run against it (load tests, API tests, chaos injection)
- **Scores** that evaluate the outcome

```
nurburg-labs/
├── redis-cache-aside/          # example experiment
│   ├── .nurburgdev/
│   │   ├── experiment.toml     # experiment definition
│   │   ├── traffic.js          # k6 load test script
│   │   └── README.md           # writeup published on nurburg.dev
│   └── src/                    # service source code
├── docs/
│   ├── getting-started.md
│   └── specification-for-experiments.md
└── README.md
```

## Getting started

See [docs/getting-started.md](docs/getting-started.md) for a step-by-step guide to adding your own experiment.

The full experiment format reference is in [docs/specification-for-experiments.md](docs/specification-for-experiments.md).

## Contributing

1. Fork this repository.
2. Create a new folder at the repo root for your experiment (e.g. `my-experiment/`).
3. Follow the structure described in [getting-started.md](docs/getting-started.md).
4. Open a pull request.

## License

MIT
