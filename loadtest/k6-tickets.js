import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─── config ──────────────────────────────────────────────────
const BASE_URL       = __ENV.BASE_URL       || 'http://localhost:8080';
const ADMIN_EMAIL    = __ENV.ADMIN_EMAIL    || 'admin@bug-shot.local';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'change-me-dev-only';
const PROJECT_KEY    = __ENV.PROJECT_KEY    || 'demo';
const ORIGIN         = __ENV.ORIGIN         || 'http://127.0.0.1:5500';

const QUICK    = __ENV.K6_QUICK === '1';
const DURATION = QUICK ? '1m'  : (__ENV.K6_DURATION || '5m');
const RATE     = QUICK ? 20    : parseInt(__ENV.K6_RATE || '100');
const VUS      = QUICK ? 30    : 150;
const MAX_VUS  = QUICK ? 60    : 300;

// ─── custom metrics ──────────────────────────────────────────
const postTicketDuration = new Trend('post_ticket_duration', true);
const getTicketsDuration = new Trend('get_tickets_duration', true);
const errorRate = new Rate('errors');

// ─── scenarios ───────────────────────────────────────────────
export const options = {
  scenarios: {
    post_tickets: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: VUS,
      maxVUs: MAX_VUS,
      exec: 'postTicket',
    },
    get_tickets: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: VUS,
      maxVUs: MAX_VUS,
      exec: 'getTickets',
      startTime: '5s',
    },
  },
  thresholds: {
    'post_ticket_duration{scenario:post_tickets}': ['p(95)<500'],
    'get_tickets_duration{scenario:get_tickets}':  ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

// ─── setup: login + resolve projectId ────────────────────────
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, { 'login ok': (r) => r.status === 200 });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const token = loginRes.json('accessToken');

  const projectsRes = http.get(`${BASE_URL}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const projects = projectsRes.json();
  const project = projects.find((p) => p.key === PROJECT_KEY);

  if (!project) {
    throw new Error(`Project "${PROJECT_KEY}" not found. Seed first: make seed SEED_COUNT=10000`);
  }

  console.log(`Setup OK: project=${project.id}, rate=${RATE} rps, duration=${DURATION}`);
  return { token, projectId: project.id };
}

// ─── POST /api/tickets ───────────────────────────────────────
export function postTicket(data) {
  const payload = JSON.stringify({
    projectKey: PROJECT_KEY,
    description: `Load test ticket ${randomString(12)}`,
    pageUrl: `https://acme.example/page-${randomIntBetween(1, 500)}`,
    userAgent: 'Mozilla/5.0 (k6 load test)',
  });

  const res = http.post(`${BASE_URL}/api/v1/tickets`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
  });

  postTicketDuration.add(res.timings.duration);
  const ok = check(res, { 'POST 201': (r) => r.status === 201 });
  errorRate.add(!ok);
}

// ─── GET /api/projects/{id}/tickets ──────────────────────────
const STATUSES = ['New', 'InProgress', 'Resolved', 'Rejected'];
const SORTS    = ['receivedAt:desc', 'receivedAt:asc', 'reportedAt:desc', 'reportedAt:asc'];

export function getTickets(data) {
  const status = STATUSES[randomIntBetween(0, STATUSES.length - 1)];
  const sort   = SORTS[randomIntBetween(0, SORTS.length - 1)];
  const limit  = randomIntBetween(20, 50);

  const url = `${BASE_URL}/api/v1/projects/${data.projectId}/tickets?status=${status}&sort=${sort}&limit=${limit}&withTotal=true`;

  const res = http.get(url, {
    headers: { Authorization: `Bearer ${data.token}` },
  });

  getTicketsDuration.add(res.timings.duration);
  const ok = check(res, { 'GET 200': (r) => r.status === 200 });
  errorRate.add(!ok);
}

// ─── report ──────────────────────────────────────────────────
export function handleSummary(data) {
  const now = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

  return {
    [`loadtest/reports/report-${now}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    [`loadtest/reports/report-${now}.json`]: JSON.stringify(data, null, 2),
  };
}
