import http from "k6/http";
import { sleep } from "k6";

const HOST = __ENV.HOST;

export const options = {
  duration: "10s",
  vus: 10,
};

export default function () {
  http.get(`${HOST}/healthcheck`);
  sleep(1);
}
