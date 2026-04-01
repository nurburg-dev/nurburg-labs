---
title: "Outbox Pattern"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Implement the transactional outbox pattern to reliably publish events to Kafka after a database write."
publishedOn: 2026-04-01
tags: [kafka, postgres, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 1002
  difficulty: "medium"
  points: 100
  language: "typescript"
---

## Overview

In this challenge you will implement the transactional outbox pattern to guarantee that events are reliably published to Kafka whenever a database write occurs, even in the presence of failures.

## Goal

When a write request arrives, persist the record and an outbox entry in the same PostgreSQL transaction. A background relay process polls the outbox table and publishes pending events to Kafka, marking them as processed after successful delivery.

## Requirements

- The `/healthcheck` endpoint must always return `200 OK`.
- On a write request, insert the domain record and an outbox row atomically in a single transaction.
- A relay (same or separate process) reads unpublished outbox rows and produces them to Kafka.
- Successfully published rows must be marked as processed so they are not re-sent.
- Under load, Kafka unavailability must not cause HTTP 5xx responses.

## Scoring

Your solution is evaluated on:

- **Error rate** — HTTP error rate during the load test must stay below 5 %.
- **Latency** — P95 response latency must stay below 200 ms.
- **Functional tests** — all API tests must pass.
