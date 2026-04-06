import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const HOST = __ENV.HOST || "http://localhost:3006";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.1"],
  },
};

const TEST_EMAILS = [
  "yvette52@example.org",
  "james37@example.org",
  "kevinball@example.net",
  "qrichard@example.net",
  "gharris@example.org",
  "ahorton@example.com",
  "rhendricks@example.org",
  "marie68@example.net",
  "matthewsdennis@example.net",
  "holtgerald@example.net",
  "murphychase@example.net",
  "crystalbrewer@example.net",
  "carlosherrera@example.org",
  "morrowjoshua@example.net",
  "catherinesutton@example.org",
];

export default function () {
  // Select a random email from the test set
  const email = TEST_EMAILS[Math.floor(Math.random() * TEST_EMAILS.length)];

  const payload = JSON.stringify({
    email: email,
    password: "password123",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Send login request
  const res = http.post(`${HOST}/auth/login`, payload, params);

  // Check response
  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "has token": (r) => JSON.parse(r.body).token !== undefined,
  });

  errorRate.add(!success);

  if (res.status === 200) {
    console.log("user logged in");
  } else {
    console.log(`Request failed with status ${res.status}`);
  }

  sleep(0.5);
}
