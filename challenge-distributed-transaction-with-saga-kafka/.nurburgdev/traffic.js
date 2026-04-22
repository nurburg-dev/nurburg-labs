import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "60s", target: 20 },
    { duration: "15s", target: 0 },
  ],
};

const HOST = __ENV.HOST || "http://localhost:3000";

const customers = ["customer-1", "customer-2", "customer-3", "customer-4", "customer-5"];

export default function () {
  http.post(
    `${HOST}/bookings`,
    JSON.stringify({
      customerId: customers[Math.floor(Math.random() * customers.length)],
      amount: parseFloat((Math.random() * 500 + 100).toFixed(2)),
      seats: 1,
      date: "2026-04-10",
      flightLegs: [
        { airlines: "airline-1", flightNumber: "A1-101" },
        { airlines: "airline-2", flightNumber: "A2-201" },
      ],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  sleep(0.1);
}
