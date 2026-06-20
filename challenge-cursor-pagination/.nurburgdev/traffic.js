import http from 'k6/http';
import { check, sleep } from 'k6';

const HOST = __ENV.HOST;

export const options = {
    vus: 10,
    duration: '60s',
};

export default function () {
    // Cursor values 20000-25000 force the OFFSET implementation to skip 400k-500k rows
    // (nearly the entire table) on every request.
    // A correct keyset implementation resolves the same cursor with a single index seek.
    const cursor = String(Math.floor(Math.random() * 5000) + 20000);

    const res = http.get(`${HOST}/products?cursor=${cursor}&limit=20`);
    check(res, { 'status 200': (r) => r.status === 200 });

    sleep(0.5);
}
