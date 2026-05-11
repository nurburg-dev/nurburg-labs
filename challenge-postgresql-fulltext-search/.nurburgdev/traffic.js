import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const HOST = __ENV.HOST || "http://localhost:3000";

export const options = {
  vus: 50,
  duration: "5m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.1"],
  },
};

const QUERIES = [
  "payment gateway",
  "database connection",
  "memory leak",
  "authentication",
  "kafka consumer",
  "redis cache",
  "ssl certificate",
  "rate limit",
  "kubernetes deployment",
  "scheduler cron",
  "timeout",
  "error",
  "crash",
  "performance",
  "latency",
];

export default function () {
  const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const res = http.get(`${HOST}/tickets/search?q=${encodeURIComponent(q)}`);

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "has data": (r) => JSON.parse(r.body).data !== undefined,
  });

  errorRate.add(!success);

  if (!success) {
    console.log(`Request failed: status=${res.status} q=${q}`);
  }

  sleep(0.5);
}
