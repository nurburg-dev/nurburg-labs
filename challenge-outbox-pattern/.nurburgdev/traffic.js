import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "60s", target: 20 },
    { duration: "15s", target: 0 },
  ],
};

const BASE_URL = __ENV.HOST_ORDER || "http://localhost:3000";

const customers = [
  "customer-1",
  "customer-2",
  "customer-3",
  "customer-4",
  "customer-5",
];

export default function () {
  const payload = JSON.stringify({
    customerId: customers[Math.floor(Math.random() * customers.length)],
    amount: parseFloat((Math.random() * 500 + 10).toFixed(2)),
    currency: "USD",
  });

  http.post(`${BASE_URL}/orders`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  sleep(0.1);
}
