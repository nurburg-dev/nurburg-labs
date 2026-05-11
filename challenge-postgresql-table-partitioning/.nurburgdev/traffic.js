import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const HOST = __ENV.HOST || "http://localhost:3000";

export const options = {
  vus: 50,
  duration: "5m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    errors: ["rate<0.05"],
  },
};

const dateRanges = [
  { start: "2023-01-01", end: "2023-01-31" },
  { start: "2023-04-01", end: "2023-06-30" },
  { start: "2023-07-01", end: "2023-09-30" },
  { start: "2023-10-01", end: "2023-12-31" },
  { start: "2024-01-01", end: "2024-03-31" },
  { start: "2024-04-01", end: "2024-06-30" },
];

const transactionTypes = ["purchase", "refund", "transfer"];

export function setup() {
  const res = http.get(`${HOST}/healthcheck`);
  if (res.status !== 200) {
    throw new Error(`Healthcheck failed with status ${res.status}`);
  }
}

export default function () {
  const range = dateRanges[Math.floor(Math.random() * dateRanges.length)];

  let url = `${HOST}/transactions?start_date=${range.start}&end_date=${range.end}&limit=100`;

  // randomly add transaction_type filter to vary query shapes
  if (Math.random() < 0.4) {
    const txType =
      transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
    url += `&transaction_type=${txType}`;
  }

  const res = http.get(url);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "has transactions array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.transactions);
      } catch {
        return false;
      }
    },
    "has stats": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.stats && body.stats.total_count !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);
  sleep(0.1);
}
