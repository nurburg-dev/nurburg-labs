---
title: "Implementing the SAGA Pattern with Temporal"
author: Anunay Biswas
authorLink: https://github.com/anunaybiswas
authorTitle: Software Engineer
summary: "The SAGA pattern solves distributed consistency — but wiring it with Kafka requires a lot of plumbing you have to get right yourself. Temporal handles reliable execution, retries, and compensation in the workflow runtime, so you can focus on the business logic."
publishedOn: 2026-03-31
tags: [temporal, postgres, distributed-systems]
intent: experiment
draft: false
---

Most backend engineers learn transactions in the context of a single database: begin, do some work, commit or rollback. The database handles isolation, atomicity, and durability. You don't have to think much about partial failure — either everything lands or nothing does.

This approach is not possible in a few cases.

1. When your data lives in more than one place — for example, a system that books a multi-leg airline ticket where each leg is operated by a different airline.
2. When your data is so large that 1 SQL database wont be able to store all the data on 1 server ^[In some cases sharding SQL database is not scalable due to nature of the data stored.].

## The problem with distributed state changes

A customer in Allahabad needs to reach Mangalore. There is no direct flight — the itinerary connects through Mumbai. The first leg is on IndiGo, the second on Air India. To confirm the booking, three things must happen in order:

![SAGA workflow](https://res.cloudinary.com/dclydguc9/image/upload/v1774953021/KafkaSaga_ManimCE_v0.19.2_ywtfka.gif)

Each operation lives in a different system. There is no single transaction that spans all three.

If step 1 succeeds but step 2 fails, IndiGo is holding a seat for a passenger with no onward connection. If both seats are confirmed but payment fails at step 3, two airlines are holding inventory for a booking that will never be paid. Partial success leaves inconsistent state with no clean way out.

This is the problem distributed transactions are designed to solve. And the SAGA pattern is one of the more practical approaches to solving it.

## What is the SAGA pattern?

A SAGA breaks a distributed operation into a sequence of local transactions — one per service. Each step publishes an event on success, triggering the next. If any step fails, __compensating transactions__ are run in reverse to undo what was already committed.

### Example 1 — no seats available on the Air India leg

![Saga](https://res.cloudinary.com/dclydguc9/image/upload/v1774952665/KafkaSagaStep2Fail_ManimCE_v0.19.2_v6mtrp.gif)

### Example 2 If no seats available in Indigo

![Saga 2](https://res.cloudinary.com/dclydguc9/image/upload/v1774953022/KafkaSagaCompensation_ManimCE_v0.19.2_eaihqy.gif)

> __Important point to keep in mind__: Each step is a local transaction. This is extremely important otherwise the larger SAGA will not transactional at all.

## Outbox pattern vs SAGA

Before reaching for a SAGA, ask whether you need one at all.

The outbox pattern handles the simpler case: one primary service, one downstream service. The upstream service writes its main record and an outbox event in a single local transaction. A relay delivers the event downstream. There is exactly one point of failure — the initial write. If it succeeds, the downstream will eventually catch up.

[outbox pattern](https://nurburg.dev/nurburg-dev/nurburg-labs:blog-outbox-pattern)

The airline booking can't use this model. There is no single primary write — all three steps are peers, each owning their own data. Any of the three can fail after the others have already committed.

Use the outbox pattern if there is only 1 transaction which can have non-retryable error for example validation error. All the other transactions will eventually succeed on retry. Reach for a SAGA only when there are multiple independent transactions which will always succeed on first show or on retry.

## Constraints a correct SAGA must satisfy

SAGAs trade away the clean guarantees of a database transaction. Two constraints must be enforced explicitly to compensate.

### Semantic locks for isolation

A database transaction is invisible to others until it commits. A SAGA in progress is not — its intermediate state is visible for as long as the workflow takes. Without a guard, another process can observe and act on partial state.

In the airline booking, once the IndiGo seat is reserved but before payment is captured, a seat availability query could see an inconsistently low count. A fraud check could see a payment mid-flight and not know what to do with it.

The fix is a semantic lock: mark the seats on AirIndia and indigo as `BLOCKED` at the start and hold it there until the SAGA either confirms or fails. Other processes treat `BLOCKED` seats as off-limits.

![semantic lock](https://res.cloudinary.com/dclydguc9/image/upload/v1774957862/KafkaSagaSemanticLock_ManimCE_v0.19.2_vhrxk6.gif)
This is enforced by application code, not the database. Compensating transactions must release the lock in every failure path — a missed release leaves records stuck in `PENDING` permanently.

### Reliable execution

All the steps in a SAGA must execute to completion. Let's say we do a naive implementation by writing all the steps in a single service. Such an approach will not ensure transactionality — if the server crashes while booking the IndiGo ticket, we end up with seats booked but payment not processed. We need to make sure all steps resume after the server comes back up. This property is called _reliable execution_.

![naive implementation](https://res.cloudinary.com/dclydguc9/image/upload/v1774963334/NaiveSagaScene_ManimCE_v0.20.1_g5t4qw.png)

Reliable execution can be implemented with Kafka or RabbitMQ. If each step is published as a task to message brokers, then they will be persistent to storage. So when the server comes back up the task will be picked up again and will be executed again

### At-least-once execution and idempotency

All the message broker ensure at least once delivery. This means Kafka/RabbitMQ is assuring you that all the message will be delivered once but may be delivered again and again in some edge cases ^[A consumer crash mid-processing or a rebalance can cause a re-delivery].

To work around this every step must be idempotent. The standard approach is a processed-events table — each step records the SAGA ID before acting, and skips the operation if it has already seen that ID. The check and the recording the SAGA ID must be in the same local transaction. If they're separate, it may break transactionality in some edge cases.

## Ordering Saga steps: the point of no return

Some steps cannot be compensated. Issuing a ticket number to a government system, sending a booking confirmation email — once these happen, they cannot be undone.

This is not a constraint to enforce but a property to exploit when ordering steps. Reversible steps come first. Irreversible steps come last. By the time the Saga reaches an irreversible step, all prior steps have committed — the only direction is forward, and that step is expected to eventually succeed.

Steps after the point of no return have no compensation path. The system retries them until they succeed.

![Point of not return](https://res.cloudinary.com/dclydguc9/image/upload/v1774952667/KafkaSagaRetry_ManimCE_v0.19.2_o0cfuk.gif)

## Implementing Saga with Temporal

Temporal is a workflow engine that provides a natural fit for SAGA implementation. Instead of services communicating through Kafka topics, a central workflow function coordinates the steps directly — calling each activity in sequence, catching failures, and running compensations. Temporal persists the full execution history, so worker crashes, network partitions, and process restarts are transparent to the workflow code; execution simply resumes from where it left off.

The airline booking maps cleanly onto a Temporal workflow:

```python
@workflow.defn
class BookingWorkflow:
    @workflow.run
    async def run(self, booking: BookingRequest) -> None:
        compensations = []

        # Step 1: Reserve IndiGo seat (reversible)
        await workflow.execute_activity(reserve_indigo_seat, booking)
        compensations.append(lambda: workflow.execute_activity(release_indigo_seat, booking))

        try:
            # Step 2: Reserve Air India seat (reversible)
            await workflow.execute_activity(reserve_air_india_seat, booking)
            compensations.append(lambda: workflow.execute_activity(release_air_india_seat, booking))
        except ActivityError:
            for compensation in reversed(compensations):
                await compensation()  # releases IndiGo seat
            raise

        # Step 3: Capture payment — point of no return, retried until success
        await workflow.execute_activity(capture_payment, booking)
```

The compensation list grows as each reversible step commits. If a step fails, `runCompensations` walks the list in reverse. Steps after the point of no return are not added to the list — they have no compensation path and Temporal retries them until they succeed.

* __At-least-once delivery and idempotency__ — Temporal guarantees each activity executes at least once. Within a single workflow execution, activity IDs prevent double-execution. For cross-workflow deduplication (e.g. a retried booking), services should record processed workflow IDs in a local table, checked and written in the same transaction as the state change.

* __Compensation__ is code, not configuration. There are no separate compensation topics to set up or retain — the workflow function is the complete record of what runs and in what order.

The tradeoff relative to Kafka is coupling: the workflow code becomes the single place that knows the full step ordering. In a Kafka-based SAGA each service only knows its own input and output topic — the choreography is implicit in topic wiring. In Temporal the orchestration is explicit, which makes the flow easier to read and debug but concentrates change in one place when the sequence evolves.

## Hands-on challenge

Reading about SAGAs is not the same as wiring one up and watching it fail. The guarantees only become intuitive once you've seen what breaks when they're missing.

The challenge is built around a simplified airline booking flow — the same 3-step sequence from this post, running on a real Temporal cluster with a chaos layer that injects failures at random points in the workflow. Sample Temporal workflows are provided as a starting point; your job is to complete the compensation logic and make the SAGA consistent under any failure pattern.

![Try Challenge](https://res.cloudinary.com/dclydguc9/image/upload/v1774678575/nurburg-challenge-button_imj0bu.svg)
