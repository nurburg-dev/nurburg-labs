import http from "k6/http";
import { sleep } from "k6";

export const options = {
  duration: "10s",
  vus: 10,
};

const BASE_URL = __ENV.TARGET_URL || "http://localhost:3000";

export default function () {
  http.get(`${BASE_URL}/healthcheck`);
  sleep(0.1);
}
