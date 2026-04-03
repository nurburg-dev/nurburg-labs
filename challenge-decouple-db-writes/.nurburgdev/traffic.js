import http from "k6/http";

export const options = {
  scenarios: {
    ingest_events: {
      executor: "constant-arrival-rate",
      rate: 11,          // ~11 req/s × 90s ≈ 990 events
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 20,
    },
  },
};

const BASE_URL = __ENV.HOST;

const ELEMENTS = ["btn-signup", "btn-login", "nav-home", "link-docs", "img-hero"];
const PAGES = ["/home", "/about", "/pricing", "/docs", "/signup"];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  http.post(
    `${BASE_URL}/events`,
    JSON.stringify({
      session_id: `session-${Math.floor(Math.random() * 500)}`,
      element_id: rand(ELEMENTS),
      page_url: `https://example.com${rand(PAGES)}`,
      x: Math.floor(Math.random() * 1920),
      y: Math.floor(Math.random() * 1080),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
