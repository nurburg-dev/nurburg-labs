---
title: "Decouple DB Writes"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Decouple database writes from the request path using Kafka as an intermediate buffer."
publishedOn: 2026-04-01
tags: [kafka, postgres, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 0002
  difficulty: "easy"
  points: 100
  language: "typescript"
---

## Overview

In this challenge you will decouple synchronous database writes from the HTTP request path by publishing events to Kafka and consuming them in a separate worker that persists data to PostgreSQL.

## Goal

Replace the direct database write in the HTTP handler with a Kafka produce call. A background consumer reads from the topic and performs the actual `INSERT` into PostgreSQL.

## Requirements

- The `/healthcheck` endpoint must always return `200 OK`.
- On a write request the service must publish a message to a Kafka topic instead of writing to PostgreSQL directly.
- A Kafka consumer (can run in the same process) reads from the topic and writes to PostgreSQL.
- Under load, database errors must not cause HTTP 5xx responses.

## Scoring

Your solution is evaluated on:

- **Error rate** — HTTP error rate during the load test must stay below 5 %.
- **Latency** — P95 response latency must stay below 200 ms.
- **Functional tests** — all API tests must pass.
