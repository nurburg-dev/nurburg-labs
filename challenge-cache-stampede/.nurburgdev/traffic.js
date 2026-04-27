import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const HOST = __ENV.HOST || "http://localhost:3000";

// Ramp from low concurrency to high, then sustain to let the 60-second TTL
// expire mid-test and expose the stampede.
export const options = {
  stages: [
    { duration: "30s", target: 50 },    // warm up
    { duration: "60s", target: 500 },   // ramp — cache TTL expires here
    { duration: "90s", target: 1000 },  // peak load post-expiry
    { duration: "30s", target: 50 },    // cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<300"],
    errors: ["rate<0.05"],
  },
};

// Product IDs — product 1 is the hot key targeted by all traffic.
const PRODUCT_IDS = [1, 1, 1, 1, 1, 2, 3, 4, 5];

export default function () {
  const id = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
  const res = http.get(`${HOST}/product/${id}`);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "has id": (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  sleep(0.1);
}
