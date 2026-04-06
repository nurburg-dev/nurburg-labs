# datagen

`ctl datagen` generates fake CSV datasets from a YAML schema and uploads them to S3. Use it to seed databases for experiments without managing static fixture files.

## Usage

```sh
nd datagen [flags]
```

| Flag           | Default                    | Description                                   |
| -------------- | -------------------------- | --------------------------------------------- |
| `-f, --file`   | `.nurburgdev/datagen.yaml` | Path to the datasets YAML file                |
| `-b, --bucket` | `nurburg-dev-fluentbit`    | S3 bucket to upload to                        |
| `-r, --region` | `eu-central-1`             | AWS region                                    |
| `--dry-run`    | `false`                    | Generate CSVs locally without uploading to S3 |

**Required environment variables** (unless `--dry-run`):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## S3 key structure

Uploaded files land at:

```text
datagen/{github-user}/{github-repo}/{relative-folder-path}/{dataset-name}.csv
```

The path is derived automatically from the `git remote origin` and the location of the YAML file within the repo.

## Schema file

The YAML file contains one or more dataset documents separated by `---`. Each document defines a table of fake data to generate.

```yaml
name: <dataset-name>
rows: <number of rows>
columns:
    - name: <column-name>
      type: <string|int|float|date>
      faker: <faker-type> # optional, see Faker types
      format: <date-format> # optional, date columns only
      settings:
          nullable: <bool> # 10% chance of empty value when true
          int_range: [min, max] # int columns only
          float_range: [min, max] # float columns only
          date_range: [start, end] # date columns only (RFC3339 in YAML)
constraints:
    - type: unique
      columns: [col1, col2]
    - type: reference
      columns: [local_col]
      foreign_columns: [other_dataset.col]
```

### Column types

| Type     | Description                                          |
| -------- | ---------------------------------------------------- |
| `string` | Random word, or a faker value if `faker` is set      |
| `int`    | Random integer, optionally bounded by `int_range`    |
| `float`  | Random float, optionally bounded by `float_range`    |
| `date`   | Random date/time, optionally bounded by `date_range` |

### Faker types

Use `faker` on a `string` column to generate realistic data instead of random words.

| Value            | Example output             |
| ---------------- | -------------------------- |
| `first_name`     | `Jane`                     |
| `last_name`      | `Doe`                      |
| `full_name`      | `Jane Doe`                 |
| `email`          | `jane@example.com`         |
| `phone`          | `555-123-4567`             |
| `uuid`           | `a1b2c3d4-...`             |
| `username`       | `jane_doe`                 |
| `password`       | 16-char random password    |
| `url`            | `https://example.com/path` |
| `ipv4`           | `192.168.1.1`              |
| `city`           | `Berlin`                   |
| `country`        | `Germany`                  |
| `street_address` | `Main St`                  |
| `zip_code`       | `10115`                    |
| `company`        | `Acme Corp`                |
| `job_title`      | `Software Engineer`        |
| `credit_card`    | `4111111111111111`         |
| `currency`       | `EUR`                      |
| `sentence`       | 8-word sentence            |
| `paragraph`      | 3-sentence paragraph       |

### Date formats

Applies to `date` columns via the `format` field.

| Value       | Layout                 | Use case          |
| ----------- | ---------------------- | ----------------- |
| `postgres`  | `2006-01-02 15:04:05`  | PostgreSQL COPY   |
| `mysql`     | `2006-01-02 15:04:05`  | MySQL LOAD DATA   |
| `rfc3339`   | `2006-01-02T15:04:05Z` | APIs / JSON       |
| `date_only` | `2006-01-02`           | Date-only columns |

Defaults to `mysql` format when unset.

### Constraints

**`unique`** — ensures the combination of listed columns has no duplicate rows across the dataset.

**`reference`** — values in the local column are sampled from an already-generated dataset's column. Use dot notation for `foreign_columns`: `<dataset-name>.<column-name>`. The referenced dataset must appear before the referencing one in the file (or the tool handles ordering automatically via topological sort).

## Example

```yaml
name: users
rows: 100
columns:
    - name: id
      type: int
      settings:
          int_range: [1, 10000]
    - name: email
      type: string
      faker: email
    - name: score
      type: float
      settings:
          float_range: [0.0, 100.0]
constraints:
    - type: unique
      columns: [id]
---
name: orders
rows: 500
columns:
    - name: order_id
      type: int
      settings:
          int_range: [1, 99999]
    - name: user_id
      type: int
      settings:
          int_range: [1, 10000]
    - name: amount
      type: float
      settings:
          float_range: [1.0, 9999.99]
constraints:
    - type: unique
      columns: [order_id]
    - type: reference
      columns: [user_id]
      foreign_columns: [users.id]
```

Run locally without uploading:

```sh
nd datagen --dry-run
```

Upload to S3:

```sh
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... nd datagen
```
