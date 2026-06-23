import http from 'k6/http';
import { check, sleep } from 'k6';

const HOST = __ENV.HOST;

export const options = {
    vus: 10,
    duration: '60s',
};

export default function () {
    let token = null;

    for (let i = 0; i < 5; i++) {
        const url = token
            ? `${HOST}/products?page_token=${encodeURIComponent(token)}&limit=20`
            : `${HOST}/products?limit=20`;

        const res = http.get(url);
        check(res, {
            'status 200': (r) => r.status === 200,
            'has products': (r) => {
                try {
                    return r.json('products').length > 0;
                } catch (_) {
                    return false;
                }
            },
        });

        if (res.status !== 200) {
            break;
        }

        token = res.json('next_page_token');
        if (!token) {
            break;
        }
    }

    sleep(0.5);
}
