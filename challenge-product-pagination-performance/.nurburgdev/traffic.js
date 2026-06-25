import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const HOST = __ENV.HOST;
const CATEGORY_ID = 1;
const LIMIT = 100;
const MAX_BOOTSTRAP_PAGES = 1000;
const MEDIUM_TOKEN_CAPTURE_START = 120;
const MEDIUM_TOKEN_CAPTURE_END = 360;
const MEDIUM_TOKEN_CAPTURE_EVERY = 30;
const DEEP_TOKEN_CAPTURE_START = 500;
const DEEP_TOKEN_CAPTURE_EVERY = 40;

export const options = {
    vus: 13,
    duration: '120s',
    setupTimeout: '180s',
};

function buildUrl(pageToken = null) {
    const base = `${HOST}/products?category_id=${CATEGORY_ID}&limit=${LIMIT}`;
    return pageToken ? `${base}&page_token=${encodeURIComponent(pageToken)}` : base;
}

function pickSeedToken(seedTokens) {
    const vuId = exec.vu.idInTest || 1;
    return seedTokens[(vuId - 1) % seedTokens.length];
}

function pickSession(data) {
    const roll = Math.random();

    if (roll < 0.2) {
        return { token: null, pagesToWalk: 2 };
    }

    if (roll < 0.5) {
        return { token: pickSeedToken(data.mediumTokens), pagesToWalk: 3 };
    }

    return { token: pickSeedToken(data.deepTokens), pagesToWalk: 4 };
}

export function setup() {
    let setupToken = null;
    const mediumTokens = [];
    const deepTokens = [];

    for (let page = 1; page <= MAX_BOOTSTRAP_PAGES; page++) {
        const res = http.get(buildUrl(setupToken));
        if (res.status !== 200) {
            throw new Error(`setup failed while walking category feed: status ${res.status} at page ${page}`);
        }

        const nextToken = res.json('next_page_token');
        if (!nextToken) {
            break;
        }

        if (
            page >= MEDIUM_TOKEN_CAPTURE_START &&
            page <= MEDIUM_TOKEN_CAPTURE_END &&
            page % MEDIUM_TOKEN_CAPTURE_EVERY === 0
        ) {
            mediumTokens.push(nextToken);
        }

        if (page >= DEEP_TOKEN_CAPTURE_START && page % DEEP_TOKEN_CAPTURE_EVERY === 0) {
            deepTokens.push(nextToken);
        }

        setupToken = nextToken;
    }

    if (mediumTokens.length === 0 || deepTokens.length === 0) {
        throw new Error('setup did not collect enough pagination seed tokens');
    }

    return { mediumTokens, deepTokens };
}

export default function (data) {
    const session = pickSession(data);
    let token = session.token;

    for (let i = 0; i < session.pagesToWalk; i++) {
        const res = http.get(buildUrl(token));
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
            return;
        }

        token = res.json('next_page_token');
        if (!token) {
            return;
        }
    }
}
