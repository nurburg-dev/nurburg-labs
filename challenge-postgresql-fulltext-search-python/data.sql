
INSERT INTO tickets (id, title, body, tags, status, created_at, updated_at)
VALUES
  (1,
   'Payment gateway timeout on checkout',
   'Users are reporting timeouts when attempting to complete purchases. '
   'The payment gateway returns a 504 after approximately 30 seconds. '
   'This started after the 2.4.1 deploy. Rollback did not resolve the issue. '
   'Stripe dashboard shows elevated error rates. Affecting ~12% of transactions.',
   ARRAY['payment', 'gateway', 'timeout', 'stripe', 'checkout'],
   'open',
   now() - interval '20 days',
   now() - interval '18 days'),

  (2,
   'Postgres connection pool exhausted under load',
   'Production database is crashing under peak traffic. Connection pool '
   'hits max_connections (100) within 5 minutes of load spike. '
   'Application logs show "too many clients" errors. '
   'PgBouncer is configured but appears to be bypassed by the new auth service. '
   'Intermittent 500s affecting the dashboard and reporting endpoints.',
   ARRAY['postgres', 'database', 'connection-pool', 'pgbouncer', 'performance'],
   'in_progress',
   now() - interval '25 days',
   now() - interval '22 days'),

  (3,
   'Worker service leaking memory on image processing jobs',
   'The image processing worker is leaking memory. RSS grows by ~50MB per hour '
   'and never recovers. OOM killer terminates the process every 6–8 hours, '
   'causing job queue backlog. Heap snapshots taken on v3.1.2 show uncollected '
   'Buffers accumulating in the sharp module. Node 18.17 LTS.',
   ARRAY['memory-leak', 'worker', 'nodejs', 'image-processing', 'oom'],
   'open',
   now() - interval '30 days',
   now() - interval '28 days'),

  (4,
   'JWT tokens expiring prematurely, users logged out unexpectedly',
   'Multiple users report being logged out mid-session. Investigation shows '
   'JWT expiry is set to 15 minutes instead of 15 hours due to a config '
   'parsing bug introduced in env-config v2.0.0. The duration field was '
   'interpreted as seconds not minutes. Affects all sessions created after '
   'the 3rd. SSO users are not affected.',
   ARRAY['auth', 'jwt', 'session', 'logout', 'security'],
   'resolved',
   now() - interval '35 days',
   now() - interval '33 days'),

  (5,
   'Kafka consumer group lagging 2M+ messages on events topic',
   'The analytics consumer group is lagging over 2 million messages on the '
   'events topic. Lag started growing 48h ago following a redeployment that '
   'changed deserialization logic. Consumer is not crashing — throughput dropped '
   'from 40k msg/s to ~800 msg/s. Schema registry shows no compatibility errors. '
   'Dead letter queue is empty.',
   ARRAY['kafka', 'consumer-lag', 'events', 'analytics', 'throughput'],
   'open',
   now() - interval '40 days',
   now() - interval '38 days'),
  (6,
   'Redis cache evicting hot keys under memory pressure',
   'Redis is evicting frequently-accessed keys due to maxmemory policy set '
   'to allkeys-lru. The session cache and rate-limit counters are being '
   'evicted together. This causes cascading database hits and latency spikes. '
   'Memory usage sits at 98% of the 4GB limit. No TTL set on session keys — '
   'they accumulate indefinitely. Switching to volatile-lru is not safe '
   'without adding TTLs first.',
   ARRAY['redis', 'cache', 'eviction', 'memory', 'session'],
   'in_progress',
   now() - interval '45 days',
   now() - interval '43 days');

INSERT INTO tickets (id, title, body, tags, status)
VALUES (7,
  'SSL certificate renewal failed silently in staging',
  'The automated certificate renewal via certbot failed in staging without '
  'alerting. The certificate expired 3 days ago. HTTPS connections are falling '
  'back to HTTP in some client configurations. Production cert expires in 11 days. '
  'Renewal failure root cause: DNS-01 challenge timing out due to a Route53 '
  'API rate limit hit during a bulk zone update.',
  ARRAY['ssl', 'certificate', 'tls', 'certbot', 'devops'],
  'open');

INSERT INTO tickets (id, title, body, tags, status)
VALUES (8,
  'API rate limiting not applying to internal service accounts',
  'The rate limiter middleware correctly throttles external API consumers '
  'but internal service-to-service calls bypass the limit check entirely. '
  'A misconfigured allow-list treats all requests with a valid service token '
  'as exempt. During a runaway retry loop this caused 40k req/s to hit the '
  'recommendations service, causing cascading timeouts downstream.',
  ARRAY['rate-limit', '429', 'api', 'internal', 'middleware'],
  'open');

INSERT INTO tickets (id, title, body, tags, status)
VALUES (9,
  'Deployment rollback not restoring previous ConfigMap values',
  'When a deployment is rolled back via kubectl rollout undo, the application '
  'pods revert to the previous image but the ConfigMap is not reverted. '
  'Environment variables from the broken release persist. This was observed '
  'during the 2.5.0 incident last week. Helm rollback does restore ConfigMaps '
  'correctly — issue is specific to the raw kubectl workflow.',
  ARRAY['kubernetes', 'deployment', 'configmap', 'helm', 'devops'],
  'resolved');

INSERT INTO tickets (id, title, body, tags, status)
VALUES (10,
  'Scheduled job skipping runs after timezone config change',
  'The nightly report generation job started skipping executions after the '
  'server timezone was changed from UTC to IST. Cron expression is correct '
  'but the scheduler interprets it in local time. We attempted a deployment '
  'rollback but the scheduler config is baked into the image, not the '
  'ConfigMap, so the timezone persisted across rollbacks.',
  ARRAY['scheduler', 'cron', 'timezone', 'jobs', 'reporting'],
  'open');

