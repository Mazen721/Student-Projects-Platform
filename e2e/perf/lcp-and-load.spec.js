import { expect, test } from '@playwright/test';
import { checkPublicBundleBudget } from './check-bundle-budget.js';
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4100/api/v1';

async function runConcurrentBurst({ url, concurrency = 500 }) {
  const latencies = [];
  let failures = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      try {
        const res = await fetch(url);
        if (!res.ok) failures += 1;
        await res.arrayBuffer();
      } catch {
        failures += 1;
      } finally {
        latencies.push(performance.now() - start);
      }
    })
  );

  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
  return {
    total: concurrency,
    failures,
    p95Ms: Math.round(latencies[p95Index] || 0),
    maxMs: Math.round(latencies[latencies.length - 1] || 0),
  };
}

test.describe('Performance (SC-005 Mobile 4G LCP) & 500-Concurrent-User Smoke (SC-012)', () => {
  test('meets mobile 4G LCP < 2000ms on public showcase and passes bundle budget', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Runs once on chromium-desktop');
    test.skip(browserName !== 'chromium', 'CDP network throttling requires Chromium');

    const distHtml = path.resolve(process.cwd(), 'client/dist/index.html');
    if (fs.existsSync(distHtml)) {
      const budget = await checkPublicBundleBudget();
      expect(budget.withinBudget).toBe(true);
    }

    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    // Regular 4G mobile profile (~4 Mbps down, 1.5 Mbps up, 50 ms RTT)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 50,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    });

    await page.addInitScript(() => {
      window.__lcpMs = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__lcpMs = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);

    const lcpMs = await page.evaluate(() => window.__lcpMs);
    expect(lcpMs).toBeGreaterThan(0);
    expect(lcpMs).toBeLessThan(2000);
  });

  test('handles 500 concurrent read requests with 0 failures', async ({ request: _request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Runs once on chromium-desktop');

    const result = await runConcurrentBurst({
      url: `${API_BASE}/public/home`,
      concurrency: 500,
    });

    expect(result.failures).toBe(0);
    expect(result.p95Ms).toBeLessThan(5000);
  });
});
