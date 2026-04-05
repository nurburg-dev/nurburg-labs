---
title: "The books didn't balance. Here's how the outbox pattern saved our distributed transaction"
author: Anunay Biswas
authorLink: https://github.com/anunaybiswas
authorTitle: Software Engineer
summary: "How the outbox pattern eliminates phantom transactions between your database and event stream — and why at-least-once delivery with idempotent consumers is the right tradeoff."
publishedOn: 2026-03-28
tags: [postgres, kafka, distributed-systems]
intent: experiment
draft: false
---

It's 11 PM, three days before the tax filing deadline. You're staring at two numbers that should be equal. They aren't. The total value of committed orders in the database is ₹2,31,18,650. The total in the ledger is ₹2,34,71,840. The ledger is higher — it contains transactions for orders that don't exist in the database. Somewhere over the past year, Kafka events reached the ledger for orders whose database commits had already failed and rolled back. Ghost orders, fully accounted for, attached to nothing.

This is the end-of-financial-year reconciliation failure that nobody plans for. Your company is about to pay taxes on ₹3,53,190 of revenue it never actually collected.

## How did this happen?

The order placement service was written simply and reasonably. When a customer placed an order, it did two things: committed the order to the database, then notified the ledger service via Kafka.

```text
[TODO CODE SNIPPET: order placement service — db commit followed by kafka.Publish]
```

Look at what happens when the commit fails at step X. The Kafka event has already been sent. The ledger records a transaction for an order that no longer exists in the database. Or flip it: the commit succeeds, the process crashes before Kafka.Publish runs, and the ledger never hears about a real order at all. Either way, your books are wrong — and you won't know until the next reconciliation run.

This isn't a bug in the usual sense. The code is doing exactly what it was written to do. The problem is structural: two separate systems need to agree on something, and there is no mechanism ensuring they either both succeed or both fail.

## The outbox pattern

The fix isn't clever. It's almost embarrassingly simple once you see it.

The problem was treating the Kafka publish as a side effect that could be separated from the database write. The solution is to make it structurally impossible to separate them — by writing the event into the same database transaction as the order itself.

Instead of publishing to Kafka directly, the order service inserts a row into an outbox table. This insert happens inside the same transaction as the order insert. If the transaction commits, both the order and the outbox row exist. If it rolls back, neither does. Kafka never enters the picture at this stage.

```text
[TODO CODE SNIPPET: order insert + outbox insert inside single transaction]
```

A separate background process — the relay — polls the outbox table periodically. When it finds unpublished rows, it forwards them to Kafka, then deletes them from the outbox, inside a single transaction.

```text
[TODO CODE SNIPPET: relay process — select from outbox, kafka.Publish, delete from outbox, commit]
```

![Outbox pattern architecture diagram](https://res.cloudinary.com/dclydguc9/image/upload/v1774677754/OutboxPatternDiagram_ManimCE_v0.19.2_tafwll.png)

![Outbox pattern architecture diagram gif](https://res.cloudinary.com/dclydguc9/image/upload/v1774677923/OutboxPatternDiagram_ManimCE_v0.19.2_bogxzm.gif)

The ledger now only ever receives events for orders that actually committed to the database. The phantom transaction problem is gone.

### But there's a new, narrower problem

Consider what happens when the relay crashes after publishing to Kafka but before the delete commits. The outbox row survives. On the next poll, the relay publishes the same event again. The ledger service receives the same order twice.

This is called at-least-once delivery — and it's not a bug in the outbox pattern, it's a structural property of any system that must guarantee no events are lost. You cannot have both "never lose an event" and "never deliver twice" without coordination that's more expensive than what we're building here. So we accept at-least-once and solve the duplicate problem on the consumer side.

### Idempotency on the ledger

The ledger service needs to track which orders it has already processed. When an event arrives, it checks whether that order ID exists in its processed set before doing anything. If it does, it returns success without re-processing. If it doesn't, it records the transaction and adds the order ID to the processed set — in the same database transaction.

```text
[CODE SNIPPET: ledger service — idempotency check by order_id before processing event]
```

The order ID here is the idempotency key — the identifier the ledger uses to recognise duplicates. The guarantee is: no matter how many times the relay delivers the same event, the ledger records it exactly once.

At-least-once delivery plus idempotent consumers gives you effective exactly-once processing, without the complexity of distributed transactions.

## Postgres already knew about your changes before you did

Everything we just built — the outbox table, the relay, the delete-on-publish — is actually reimplementing something Postgres tracks internally.

The Write-Ahead Log is Postgres's durability backbone. Before any change touches the actual data files, Postgres writes a description of that change to the WAL — a sequential, append-only log on disk. If the process crashes mid-write, Postgres replays the WAL on restart to recover to a consistent state. "Write-ahead" means the log entry always lands before the data page. This sequentiality is also why WAL is fast — sequential disk writes are far cheaper than random page updates. Everything Postgres builds on top — leader-follower replication, point-in-time recovery, logical decoding — is ultimately reading from this one log.

Which means you can use the WAL itself as the outbox — streaming change events directly from Postgres's internal log, without an outbox table at all. The relay reads from the WAL instead of polling a table, removing the extra write load entirely.

### Challenge

If you want to implement to outbox pattern why not try this challenge on [nurburg.dev](https://nurburg.dev).

[![Try Challenge](https://nurburg.dev/cta/challenge/typescript/view)](https://nurburg.dev/nurburg-labs:challenge-outbox-pattern)

> **Note:** The scenario in this post is fictional but inspired by patterns seen in real production systems
