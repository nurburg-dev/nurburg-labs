---
title: "Distributed Transaction with Saga and Kafka"
author: "Anunay Biswas"
authorLink: "https://github.com/anunaybiswas"
authorTitle: "Software Engineer"
summary: "Implement the Saga pattern to coordinate a distributed transaction across PostgreSQL and MySQL services using Kafka for messaging."
publishedOn: 2026-04-03
tags: [kafka, postgres, mysql, distributed-systems]
intent: "challenge"
draft: true
challengeDetails:
  id: 0003
  difficulty: "hard"
  points: 300
  language: "typescript"
---

## Overview

In this challenge you will implement the Saga pattern to coordinate a distributed transaction spanning two databases — PostgreSQL and MySQL — using Kafka as the messaging backbone. Each service owns its local database and communicates exclusively through Kafka events.

## Goal

A single business operation (e.g. placing an order) must update records in both services atomically. If any step fails, compensating transactions must roll back the already-completed steps to leave the system in a consistent state.

## Requirements

- The `/healthcheck` endpoint must always return `200 OK`.
- Initiating a saga must produce a command event to Kafka and persist a local record in the first service's database.
- Each participant service consumes the relevant Kafka topic, performs its local transaction, and emits a reply event.
- On failure, the orchestrator must publish compensating commands to roll back completed steps.
- The saga state must be durable — a service restart must not lose in-progress sagas.
- Under load, transient Kafka or database errors must not produce unrecoverable saga states.

## Scoring

Your solution is evaluated on:

- **Error rate** — HTTP error rate during the load test must stay below 5 %.
- **Latency** — P95 response latency must stay below 300 ms.
- **Functional tests** — all API tests must pass.
