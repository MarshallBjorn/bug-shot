import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test('homepage loads', async ({ page }) => {
  const res = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeLessThan(400);
});

test('API healthz', async ({ request }) => {
  const api = process.env.API_URL || 'http://localhost:8080';
  const res = await request.get(`${api}/healthz`);
  expect(res.status()).toBe(200);
});

test('login page accessible', async ({ page }) => {
  const res = await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeLessThan(400);
});
