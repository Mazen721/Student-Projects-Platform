import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../../client/dist');
const MAX_GZIP_BYTES = 180 * 1024;

export async function checkPublicBundleBudget(distDir = DIST_DIR) {
  const html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const preloadMatches = [
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ].map((m) => m[1]);

  const assetsDir = path.join(distDir, 'assets');
  const assetFiles = await fs.readdir(assetsDir);
  const publicRouteChunk = assetFiles.find((f) => /^PublicHomePage-.*\.js$/.test(f));

  const targets = new Set([
    ...scriptMatches,
    ...preloadMatches,
    ...(publicRouteChunk ? [`/assets/${publicRouteChunk}`] : []),
  ]);

  let totalGzipBytes = 0;
  const breakdown = [];
  for (const relPath of targets) {
    const cleanRel = relPath.replace(/^\//, '');
    const buf = await fs.readFile(path.join(distDir, cleanRel));
    const gzipBytes = zlib.gzipSync(buf, { level: 9 }).length;
    totalGzipBytes += gzipBytes;
    breakdown.push({ file: cleanRel, gzipKb: Number((gzipBytes / 1024).toFixed(2)) });
  }

  return {
    totalGzipBytes,
    totalGzipKb: Number((totalGzipBytes / 1024).toFixed(2)),
    limitKb: Number((MAX_GZIP_BYTES / 1024).toFixed(2)),
    withinBudget: totalGzipBytes <= MAX_GZIP_BYTES,
    breakdown,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkPublicBundleBudget();
  console.log(JSON.stringify(result, null, 2));
  if (!result.withinBudget) {
    console.error(
      `Public bundle gzip budget exceeded: ${result.totalGzipKb} KB > ${result.limitKb} KB`
    );
    process.exit(1);
  }
}
