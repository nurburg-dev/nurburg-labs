# Specification for experiment

## What is an experiment ?

An experiment is a backend system design definition and its evaluation scenario that you define in your git repository. It specifies the infrastructure to deploy (your service and any databases it depends on) and the test tasks to run against it (load tests, API tests, chaos injection). nurburg.dev runs each experiment in an isolated environment, captures performance metrics, and produces a set of scores that let you compare results across experiments.

To get started, create a folder for your project. By convention, prefix the folder name with your intent — `challenge-my-project` for a challenge submission or `experiment-my-project` for an exploration. This is a soft naming convention for convenience, not enforced by the platform.

Inside that folder, create a `.nurburgdev/` directory. An experiment lives in `.nurburgdev/` at the root of your repository and consists of:

- **Components** — long-running infrastructure: your service and supporting databases (Postgres, MySQL, Redis, Kafka, Temporal)
- **Tasks** — short-lived jobs that run after components are ready: load tests, API tests, data seeders, and failure injection (server failure, network partitioning)
- **Scores** — tell how you want to evaluate the performance of the system design
- **Telemetry** - tells which telemetry metrics to display in report on nurburg.dev

## Format of an experiment

An experiment is defined in `.nurburgdev/experiment.toml`
(or `.nurburgdev/experiment.yaml`) at the root of your repository.

### Top-level fields

| Field         | Type                   | Required | Description                         |
| ------------- | ---------------------- | -------- | ----------------------------------- |
| `description` | string (max 256 chars) | No       | Short description of the experiment |

### Components

Components are the long-running infrastructure services that form your test environment. At least one `[[service]]` is required.

#### `[[service]]`

Your application under test.

| Field            | Type    | Required | Constraints                                  | Description                                                    |
| ---------------- | ------- | -------- | -------------------------------------------- | -------------------------------------------------------------- |
| `name`           | string  | Yes      | Lowercase alphanumeric + hyphens, 3–30 chars | Unique name for this service                                   |
| `runtime`        | string  | Yes      | `nodejs`, `go`, `python`, `java`             | Language runtime                                               |
| `port`           | integer | Yes      | ≥ 1000                                       | Port your service listens on                                   |
| `healthCheckUrl` | string  | Yes      |                                              | HTTP path used to verify the service is ready (e.g. `/health`) |
| `cpuCores`       | float   | Yes      | 0 < value ≤ 2                                | CPU allocation                                                 |
| `memoryMB`       | integer | Yes      | 0 < value ≤ 4096                             | Memory allocation in MB                                        |
| `instances`      | integer | Yes      | 1–5                                          | Number of replicas to run                                      |
| `directory`      | string  | No       | Defaults to `.`                              | Path to the service source relative to the repo root           |
| `env`            | table   | No       |                                              | Environment variables injected into the service                |

```toml
[[service]]
name = "app"
runtime = "nodejs"
port = 3000
healthCheckUrl = "/health"
cpuCores = 0.5
memoryMB = 256
instances = 1

[service.env]
REDIS_URL = "redis://redis:6379"
```

#### Procfile

Each service is started via a `Procfile` in its source directory (the path specified by `directory`, defaulting to the repo root). nurburg.dev reads two process types from it:

| Process | Required | Description                                                       |
| ------- | -------- | ----------------------------------------------------------------- |
| `build` | No       | Runs once before `web` to compile the application                 |
| `web`   | Yes      | Starts the long-running server process on the configured `port`   |

`build` always runs to completion before `web` is started. If `build` exits with a non-zero code the service is marked as failed and `web` is never started.

```Procfile
build: go build -o ./app .
web: ./app
```

```Procfile
build: mvn package -q
web: java -jar target/app.jar
```

For runtimes that don't require a compile step, omit `build` and define only `web`:

```Procfile
web: node server.js
```

#### `[[postgres]]`

| Field       | Type    | Required | Constraints         | Description                                 |
| ----------- | ------- | -------- | ------------------- | ------------------------------------------- |
| `name`      | string  | Yes      |                     | Unique name, referenced by other components |
| `cpuCores`  | float   | Yes      | 0 < value ≤ 2       |                                             |
| `memoryMB`  | integer | Yes      | ≤ 4096              |                                             |
| `storageGB` | integer | Yes      | ≤ 100               |                                             |
| `dbName`    | string  | Yes      |                     | Database name                               |
| `user`      | string  | Yes      |                     | Database user                               |
| `password`  | string  | Yes      |                     | Database password                           |
| `type`      | string  | No       | `standard`, `citus` | Defaults to `standard`                      |

#### `[[mysql]]`

| Field       | Type    | Required | Constraints           | Description            |
| ----------- | ------- | -------- | --------------------- | ---------------------- |
| `name`      | string  | Yes      |                       |                        |
| `cpuCores`  | float   | Yes      | 0 < value ≤ 2         |                        |
| `memoryMB`  | integer | Yes      | ≤ 4096                |                        |
| `storageGB` | integer | Yes      | ≤ 100                 |                        |
| `dbName`    | string  | Yes      |                       |                        |
| `user`      | string  | Yes      |                       |                        |
| `password`  | string  | Yes      |                       |                        |
| `type`      | string  | No       | `standard`, `mariadb` | Defaults to `standard` |

#### `[[redis]]`

| Field       | Type    | Required | Constraints             | Description                              |
| ----------- | ------- | -------- | ----------------------- | ---------------------------------------- |
| `name`      | string  | Yes      |                         |                                          |
| `cpuCores`  | float   | Yes      | 0 < value ≤ 2           |                                          |
| `memoryMB`  | integer | Yes      | ≤ 4096                  |                                          |
| `storageGB` | integer | Yes      | ≤ 100                   |                                          |
| `password`  | string  | Yes      |                         | Leave empty string for no password       |
| `followers` | integer | No       | 0 or 1                  | Number of read replicas. Defaults to `0` |
| `type`      | string  | No       | `standalone`, `cluster` | Defaults to `standalone`                 |

#### `[[kafka]]`

| Field                        | Type    | Required | Constraints   | Description                                            |
| ---------------------------- | ------- | -------- | ------------- | ------------------------------------------------------ |
| `name`                       | string  | Yes      |               |                                                        |
| `cpuCores`                   | float   | Yes      | 0 < value ≤ 2 |                                                        |
| `memoryMB`                   | integer | Yes      | ≤ 4096        |                                                        |
| `storageGB`                  | integer | Yes      | ≤ 100         |                                                        |
| `brokers`                    | integer | No       | 1–9           | Number of Kafka brokers. Defaults to `1`               |
| `topics`                     | array   | No       | At least 1    | Topic definitions. Defaults to a single `events` topic |
| `topics[].name`              | string  | Yes      |               | Topic name                                             |
| `topics[].partition`         | integer | No       |               | Number of partitions. Defaults to `3`                  |
| `topics[].replicationFactor` | integer | No       |               | Defaults to `1`                                        |

#### `[[memcached]]`

| Field           | Type    | Required | Constraints   | Description                                                                        |
| --------------- | ------- | -------- | ------------- | ---------------------------------------------------------------------------------- |
| `name`          | string  | Yes      |               | Unique name, referenced by other components                                        |
| `cpuCores`      | float   | Yes      | 0 < value ≤ 2 |                                                                                    |
| `memoryMB`      | integer | Yes      | ≤ 4096        |                                                                                    |
| `replicas`      | integer | No       | 1–16          | Number of shards. Defaults to `1`                                                  |
| `maxItemSizeMB` | integer | No       | 0–128         | Max size of a single item (`-I` flag). Defaults to `0` (memcached default of 1 MB) |

#### `[[temporal]]`

| Field         | Type    | Required | Constraints   | Description                                                           |
| ------------- | ------- | -------- | ------------- | --------------------------------------------------------------------- |
| `name`        | string  | Yes      |               |                                                                       |
| `cpuCores`    | float   | Yes      | 0 < value ≤ 2 |                                                                       |
| `memoryMB`    | integer | Yes      | ≤ 4096        |                                                                       |
| `storageGB`   | integer | Yes      | ≤ 100         |                                                                       |
| `storageName` | string  | Yes      |               | Name of a `[[postgres]]` component to use as Temporal's backing store |
| `replicas`    | integer | No       |               | Defaults to `1`                                                       |

### Tasks

Tasks run after all components are healthy. They are short-lived jobs.

#### `[[traffic]]`

Runs a [k6](https://k6.io/) load test script.

| Field      | Type    | Required | Constraints   | Description                                                                      |
| ---------- | ------- | -------- | ------------- | -------------------------------------------------------------------------------- |
| `file`     | string  | Yes      |               | Path to the k6 script, relative to the repo root (e.g. `.nurburgdev/traffic.js`) |
| `cpuCores` | float   | Yes      | 0 < value ≤ 2 |                                                                                  |
| `memoryMB` | integer | Yes      | ≤ 4096        |                                                                                  |
| `env`      | table   | No       |               | Environment variables injected into the k6 runner                                |

```toml
[[traffic]]
file = ".nurburgdev/traffic.js"
cpuCores = 0.5
memoryMB = 256

[traffic.env]
TARGET_URL = "http://app:3000"
```

#### `apitest`

Path(s) to [Tavern](https://tavern.readthedocs.io/) YAML API test files. The file `.nurburgdev/apitest.tavern.yaml` is auto-discovered if present.

```toml
apitest = [".nurburgdev/apitest.tavern.yaml"]
```

#### `[[dataseeder]]`

Seeds a database component with data before tasks run.

| Field         | Type   | Required | Description                                      |
| ------------- | ------ | -------- | ------------------------------------------------ |
| `targetName`  | string | Yes      | Name of the database component to seed           |
| `file`        | string | No       | Path to a SQL file in the repository             |
| `url`         | string | No       | URL to an external dataset                       |
| `targetTable` | string | No       | Target table (required for some dataset formats) |

Either `file` or `url` must be set.

#### `[[serverFailure]]`

Kills pods of a component during the test to simulate crashes.

| Field              | Type    | Required | Description                                            |
| ------------------ | ------- | -------- | ------------------------------------------------------ |
| `targetName`       | string  | Yes      | Name of the component to target                        |
| `delaySeconds`     | integer | No       | Seconds to wait before starting. Defaults to `0`       |
| `periodSeconds`    | integer | No       | How often (in seconds) to kill pods. Defaults to `10`  |
| `targetedReplicas` | integer | No       | Number of replicas to kill per period. Defaults to `1` |

#### `[[networkPartitioning]]`

Isolates network between components to simulate a network partition.

| Field           | Type             | Required | Description                                                  |
| --------------- | ---------------- | -------- | ------------------------------------------------------------ |
| `targetNames`   | array of strings | Yes      | Names of the components to partition from each other (min 1) |
| `delaySeconds`  | integer          | No       | Seconds to wait before starting. Defaults to `0`             |
| `periodSeconds` | integer          | No       | Duration of the partition in seconds. Defaults to `10`       |

### Scores

Scores are named metrics evaluated at the end of the experiment. Each score references either a task or a component.

| Field           | Type   | Required | Description                                                                                                                                                                              |
| --------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | string | Yes      | Score identifier (see valid names below)                                                                                                                                                 |
| `taskName`      | string | No       | Name of the task to measure (e.g. `traffic`, `apitest-0`)                                                                                                                                |
| `componentName` | string | No       | Name of the component to measure                                                                                                                                                         |
| `threshold`     | float  | Yes      | The metric value at which the score passes. For lower-is-better scores the metric must be at or below this value; for higher-is-better scores the metric must be at or above this value. |

Exactly one of `taskName` or `componentName` must be set.

```toml
[[score]]
name = "ERR_RATE"
taskName = "traffic"
threshold = 50.0

[[score]]
name = "SERVICE_CPU"
componentName = "app"
threshold = 50.0
```

### Telemetry

Defines additional time-series metrics to collect during the run.

| Field           | Type            | Required | Description                                                                 |
| --------------- | --------------- | -------- | --------------------------------------------------------------------------- |
| `name`          | string or array | Yes      | Metric name(s) to collect (e.g. `"POD_CPU"` or `["POD_CPU", "POD_MEMORY"]`) |
| `taskName`      | string          | No       | Collect from this task                                                      |
| `componentName` | string          | No       | Collect from this component                                                 |

Exactly one of `taskName` or `componentName` must be set.

## `.nurburgdev/README.md` format

The README is the writeup that accompanies your experiment on nurburg.dev. It is a standard Markdown file with a YAML frontmatter block at the top.

### Frontmatter

```markdown
---
title: "Your experiment title"
author: "Author Name"
authorLink: "https://github.com/your-handle"
authorTitle: "Software Engineer"
summary: "One-sentence description shown in listings"
publishedOn: 2024-06-01
tags: [redis, scalability]
intent: "experiment"
video: "https://youtube.com/..." # optional
heroImage: "hero.png" # optional
draft: false
---
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

| Field                        | Type    | Required                        | Description                                              |
| ---------------------------- | ------- | ------------------------------- | -------------------------------------------------------- |
| `title`                      | string  | Yes                             | Display title of the experiment                          |
| `author`                     | string  | Yes                             | Author's display name                                    |
| `authorLink`                 | URL     | Yes                             | Link to the author's profile (e.g. GitHub)               |
| `authorTitle`                | string  | Yes                             | Author's job title or role                               |
| `summary`                    | string  | Yes                             | Short description shown in experiment listings           |
| `publishedOn`                | date    | Yes                             | Publication date (`YYYY-MM-DD`)                          |
| `tags`                       | array   | Yes                             | At least 2 tags (see valid values below)                 |
| `intent`                     | string  | Yes                             | `experiment` or `challenge`                              |
| `challengeDetails`           | object  | Yes (when `intent: challenge`)  | Challenge-specific metadata                              |
| `challengeDetails.id`        | integer | Yes                             | Numeric challenge ID (1–9999)                            |
| `challengeDetails.difficulty`| string  | Yes                             | `easy`, `medium`, or `hard`                              |
| `challengeDetails.points`    | integer | Yes                             | Points awarded for completing the challenge              |
| `challengeDetails.language`  | string  | Yes                             | `python`, `typescript`, `go`, or `java`                  |
| `video`                      | string  | No                              | URL to a companion video                                 |
| `heroImage`                  | string  | No                              | Path to a hero image file                                |
| `draft`                      | boolean | No                              | Set to `true` to hide from listings. Defaults to `false` |

**Valid tags:** `mysql`, `postgres`, `redis`, `memcached`, `kafka`, `temporal`, `scalability`, `debugging`, `analytics`, `distributed-systems`

### Code blocks

Always specify the language identifier.

````markdown
```javascript
function hello(name) {
    return `Hello, ${name}!`;
}
```
````

To link a snippet to its source on GitHub, add `Source:` and `File:` comments:

````markdown
```typescript
// Source: https://github.com/owner/repo/blob/main/src/server/api/users.ts
// File: src/server/api/users.ts
export async function getUserById(id: string) { ... }
```
````

To highlight a specific line range, also add `Lines:`:

````markdown
```typescript
// Source: https://github.com/owner/repo/blob/main/src/server/api/users.ts
// File: src/server/api/users.ts
// Lines: 45-65
export async function getUserById(id: string) { ... }
```
````

To show line numbers in the rendered output, add `// show-line-numbers`:

````markdown
```typescript
// Source: https://github.com/owner/repo/blob/main/src/server/api/users.ts
// File: src/server/api/users.ts
// Lines: 45-65
// show-line-numbers
export async function getUserById(id: string) { ... }
```
````

### Sidenotes

Sidenotes are inline annotations rendered in the margin. Use the `^[...]` syntax directly after the word or sentence you want to annotate:

```markdown
Writes are replicated to at least one follower before being acknowledged.^[The tradeoff here is latency vs. durability. Synchronous replication adds a full network round-trip to every write.]
```

The sidenote content appears beside the paragraph, not at the bottom of the page.

### Fork badge

Add a shields.io badge in your README to give readers a one-click CTA to fork the experiment and attempt it on nurburg.dev.

The fork URL is `https://nurburg.dev/fork/{owner}/{repo}` where `{owner}` and `{repo}` match your GitHub repository.

```markdown
[![Fork to Attempt](https://img.shields.io/badge/Fork_to_Attempt-nurburg.dev-6366f1?style=for-the-badge&logo=github&logoColor=white)](https://nurburg.dev/fork/your-username/your-repo)
```

## Appendix

### Score names

Scores evaluate experiment outcomes. Each score name is only valid for the component or task type listed.

| Name             | Applies to            | Unit   | Direction        | Description                                               |
| ---------------- | --------------------- | ------ | ---------------- | --------------------------------------------------------- |
| `ERR_RATE`       | `traffic` task        | %      | Lower is better  | Peak HTTP error rate during the load test                 |
| `LATENCY_95`     | `traffic` task        | ms     | Lower is better  | Peak 95th percentile request latency during the load test |
| `FUNC_TEST`      | `apitest` task        | %      | Higher is better | Percentage of API test cases that passed                  |
| `CODE_QUALITY`   | `sonarqube` task      | rating | Higher is better | Code quality rating from SonarQube analysis               |
| `SERVICE_CPU`    | `service` component   | %      | Lower is better  | Peak CPU usage across service pods                        |
| `SERVICE_MEMORY` | `service` component   | MB     | Lower is better  | Peak memory usage across service pods                     |
| `REDIS_CPU`      | `redis` component     | %      | Lower is better  | Peak CPU usage across Redis pods                          |
| `MYSQL_CPU`      | `mysql` component     | %      | Lower is better  | Peak CPU usage across MySQL pods                          |
| `POSTGRESQL_CPU` | `postgres` component  | %      | Lower is better  | Peak CPU usage across PostgreSQL pods                     |
| `MEMCACHED_CPU`  | `memcached` component | %      | Lower is better  | Peak CPU usage across Memcached pods                      |

> `apitest` tasks are named `apitest-0`, `apitest-1`, … based on their position in the `apitest` array.

---

### Telemetry metric names

Telemetry defines which time-series metrics appear in the experiment report. Metric names are scoped to the component or task type they are collected from.

#### Traffic task (`taskName = "traffic"`)

| Name               | Unit    | Dimensions                                       | Description                               |
| ------------------ | ------- | ------------------------------------------------ | ----------------------------------------- |
| `PEAK_ERROR_RATE`  | %       | `Error rate (%)`                                 | Peak HTTP error rate                      |
| `PEAK_P95_LATENCY` | ms      | `P95 latency (ms)`                               | Peak P95 latency                          |
| `ERROR_RATE`       | %       | `Timestamp (mins from start)`, `Error Rate (%)`  | HTTP API error rate over time             |
| `P95_DURATION`     | ms      | `Timestamp (mins from start)`, `Latency (ms)`    | 95th percentile request latency over time |
| `P99_DURATION`     | ms      | `Timestamp (mins from start)`, `Latency (ms)`    | 99th percentile request latency over time |
| `AVG_DURATION`     | ms      | `Timestamp (mins from start)`, `Latency (ms)`    | Average request latency over time         |
| `REQUEST_PER_MIN`  | req/min | `Timestamp (mins from start)`, `Requests/min`    | Requests per minute                       |
| `VUS`              | count   | `Timestamp (mins from start)`, `Number of users` | Number of active virtual users over time  |

#### API test task (`taskName = "apitest-0"`, etc.)

| Name      | Unit | Dimensions                                          | Description                          |
| --------- | ---- | --------------------------------------------------- | ------------------------------------ |
| `SUMMARY` | %    | `pass_percent`                                      | Percentage of test cases that passed |
| `REPORT`  | —    | `test_name`, `outcome`, `duration`, `error_message` | Per-test case results                |

#### Service component (`componentName = "<service-name>"`)

| Name          | Unit | Dimensions                                         | Description       |
| ------------- | ---- | -------------------------------------------------- | ----------------- |
| `PEAK_CPU`    | %    | `CPU usage (%)`                                    | Peak CPU usage    |
| `PEAK_MEMORY` | MB   | `Memory usage (MB)`                                | Peak memory usage |
| `POD_CPU`     | %    | `Timestamp (mins from start)`, `CPU Usage (%)`     | CPU usage         |
| `POD_MEMORY`  | MB   | `Timestamp (mins from start)`, `Memory usage (MB)` | Memory usage      |

#### PostgreSQL component (`componentName = "<postgres-name>"`)

| Name                 | Unit        | Dimensions                                          | Description                  |
| -------------------- | ----------- | --------------------------------------------------- | ---------------------------- |
| `PEAK_CPU`           | %           | `CPU usage (%)`                                     | Peak CPU usage               |
| `POD_CPU`            | %           | `Timestamp (mins from start)`, `CPU Usage (%)`      | CPU usage                    |
| `POD_MEMORY`         | MB          | `Timestamp (mins from start)`, `Memory usage (MB)`  | Memory usage                 |
| `QUERY_RATE`         | queries/sec | `Timestamp (mins from start)`, `Queries/sec`        | Query throughput             |
| `ACTIVE_CONNECTIONS` | count       | `Timestamp (mins from start)`, `Active Connections` | Number of active connections |

#### MySQL component (`componentName = "<mysql-name>"`)

| Name                           | Unit        | Dimensions                                            | Description                  |
| ------------------------------ | ----------- | ----------------------------------------------------- | ---------------------------- |
| `PEAK_CPU`                     | %           | `CPU usage (%)`                                       | Peak CPU usage               |
| `POD_CPU`                      | %           | `Timestamp (mins from start)`, `CPU Usage (%)`        | CPU usage                    |
| `POD_MEMORY`                   | MB          | `Timestamp (mins from start)`, `Memory usage (MB)`    | Memory usage                 |
| `QUERY_RATE`                   | queries/sec | `Timestamp (mins from start)`, `Queries/sec`          | Query throughput             |
| `SLOW_QUERY_RATE`              | queries/sec | `Timestamp (mins from start)`, `Slow Queries/sec`     | Slow query rate              |
| `CONNECTION_USAGE`             | %           | `Timestamp (mins from start)`, `Connection Usage (%)` | Connection pool utilization  |
| `INNODB_BUFFER_POOL_HIT_RATIO` | %           | `Timestamp (mins from start)`, `Hit Ratio (%)`        | InnoDB buffer pool hit ratio |

#### Redis component (`componentName = "<redis-name>"`)

| Name                  | Unit     | Dimensions                                         | Description                 |
| --------------------- | -------- | -------------------------------------------------- | --------------------------- |
| `PEAK_CPU`            | %        | `CPU usage (%)`                                    | Peak CPU usage              |
| `POD_CPU`             | %        | `Timestamp (mins from start)`, `CPU Usage (%)`     | CPU usage                   |
| `POD_MEMORY`          | MB       | `Timestamp (mins from start)`, `Memory usage (MB)` | Memory usage                |
| `MEMORY_USAGE`        | MB       | `Timestamp (mins from start)`, `Memory Usage (MB)` | Redis memory in use         |
| `CONNECTED_CLIENTS`   | count    | `Timestamp (mins from start)`, `Connected Clients` | Number of connected clients |
| `COMMANDS_PER_SECOND` | cmds/sec | `Timestamp (mins from start)`, `Commands/sec`      | Redis command throughput    |

#### Kafka component (`componentName = "<kafka-name>"`)

| Name                          | Unit         | Dimensions                                                                | Description                           |
| ----------------------------- | ------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| `POD_CPU`                     | %            | `Timestamp (mins from start)`, `CPU Usage (%)`                            | Broker CPU usage                      |
| `POD_MEMORY`                  | MB           | `Timestamp (mins from start)`, `Memory (MB)`                              | Broker memory usage                   |
| `JVM_HEAP_USED`               | MB           | `Timestamp (mins from start)`, `Heap (MB)`                                | JVM heap used by the broker           |
| `BYTES_IN_RATE`               | bytes/sec    | `Timestamp (mins from start)`, `Bytes/sec`, `topic`                       | Bytes produced per second             |
| `BYTES_OUT_RATE`              | bytes/sec    | `Timestamp (mins from start)`, `Bytes/sec`, `topic`                       | Bytes consumed per second             |
| `MESSAGES_IN_RATE`            | messages/sec | `Timestamp (mins from start)`, `Messages/sec`, `topic`                    | Messages produced per second          |
| `PRODUCE_REQUEST_RATE`        | requests/sec | `Timestamp (mins from start)`, `Requests/sec`, `pod`                      | Produce request rate                  |
| `FETCH_REQUEST_RATE`          | requests/sec | `Timestamp (mins from start)`, `Requests/sec`, `pod`                      | Consumer fetch request rate           |
| `REQUEST_LATENCY_P99`         | ms           | `Timestamp (mins from start)`, `Latency (ms)`, `pod`                      | P99 produce request latency           |
| `CONSUMER_GROUP_LAG`          | messages     | `Timestamp (mins from start)`, `Lag (messages)`, `consumergroup`, `topic` | Consumer group lag                    |
| `TOPIC_PARTITION_OFFSET`      | count        | `Timestamp (mins from start)`, `Offset`                                   | Current partition offset              |
| `UNDER_REPLICATED_PARTITIONS` | count        | `Timestamp (mins from start)`, `Partition count`                          | Partitions with insufficient replicas |
| `OFFLINE_PARTITIONS`          | count        | `Timestamp (mins from start)`, `Partition count`                          | Number of offline partitions          |
| `ACTIVE_CONTROLLER`           | count        | `Timestamp (mins from start)`, `Count`                                    | Active controller count (should be 1) |
| `LOG_FLUSH_RATE`              | flushes/sec  | `Timestamp (mins from start)`, `Flushes/sec`                              | Log flush rate                        |

#### Memcached component (`componentName = "<memcached-name>"`)

| Name                  | Unit     | Dimensions                                         | Description                  |
| --------------------- | -------- | -------------------------------------------------- | ---------------------------- |
| `PEAK_CPU`            | %        | `CPU usage (%)`                                    | Peak CPU usage               |
| `POD_CPU`             | %        | `Timestamp (mins from start)`, `CPU Usage (%)`     | CPU usage                    |
| `POD_MEMORY`          | MB       | `Timestamp (mins from start)`, `Memory usage (MB)` | Memory usage                 |
| `MEMORY_USAGE`        | MB       | `Timestamp (mins from start)`, `Memory usage (MB)` | Memcached memory in use      |
| `COMMANDS_PER_SECOND` | cmds/sec | `Timestamp (mins from start)`, `Commands/sec`      | Memcached command throughput |
| `HIT_RATIO`           | ratio    | `Timestamp (mins from start)`, `Hit Ratio`         | Cache get hit ratio (0–1)    |

#### Temporal component (`componentName = "<temporal-name>"`)

| Name                                  | Unit            | Dimensions                                                 | Description                                 |
| ------------------------------------- | --------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `POD_CPU`                             | %               | `Timestamp (mins from start)`, `CPU Usage (%)`             | Server CPU usage                            |
| `POD_MEMORY`                          | MB              | `Timestamp (mins from start)`, `Memory (MB)`               | Server memory usage                         |
| `SERVICE_REQUEST_RATE`                | requests/sec    | `Timestamp (mins from start)`, `Requests/sec`, `operation` | Frontend request throughput                 |
| `WORKFLOW_COMPLETION_RATE`            | completions/sec | `Timestamp (mins from start)`, `Completions/sec`           | Workflow completion throughput              |
| `SERVICE_LATENCY_P99`                 | ms              | `Timestamp (mins from start)`, `Latency (ms)`, `operation` | P99 frontend request latency                |
| `WORKFLOW_TASK_SCHEDULE_TO_START_P99` | ms              | `Timestamp (mins from start)`, `Latency (ms)`              | P99 workflow task schedule-to-start latency |
| `ACTIVITY_SCHEDULE_TO_START_P99`      | ms              | `Timestamp (mins from start)`, `Latency (ms)`              | P99 activity schedule-to-start latency      |
| `PERSISTENCE_LATENCY_P99`             | ms              | `Timestamp (mins from start)`, `Latency (ms)`, `operation` | P99 persistence layer latency               |
| `SERVICE_ERROR_RATE`                  | errors/sec      | `Timestamp (mins from start)`, `Errors/sec`, `error_type`  | Frontend error rate                         |
| `WORKFLOW_FAILURE_RATE`               | failures/sec    | `Timestamp (mins from start)`, `Failures/sec`              | Workflow failure and timeout rate           |
