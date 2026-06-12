/**
 * Capture README screenshots and an authoring-workflow GIF.
 * Prerequisites: API on :3000, web UI on :5173 (see scripts/capture-screenshots.ps1).
 *
 * Usage: node scripts/capture-screenshots.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'docs', 'screenshots');
const webBase = process.env.WEB_URL ?? 'http://localhost:5173';
const apiBase = process.env.API_URL ?? 'http://localhost:3000/v1';
const apiKey = process.env.MCP_DEFINER_API_KEY ?? 'dev-api-key';

const WIZARD_STEP_LABELS = [
  'Import spec',
  'Preview operations',
  'Curate tools',
  'Configure auth',
  'Validate',
  'Test',
  'Publish',
];

const petstoreSpec = readFileSync(join(repoRoot, 'fixtures/openapi/petstore.yaml'), 'utf8');

async function fetchPetstoreMeta() {
  const res = await fetch(`${apiBase}/mcps`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(`API /mcps failed: ${res.status}`);
  const data = await res.json();
  const petstore = (data.items ?? []).find((m) => m.slug === 'petstore');
  if (!petstore) throw new Error('Seeded petstore MCP not found — is MOCK_MODE enabled?');
  return { id: petstore.id, version: '1.0.0' };
}

async function seedLocalStorage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('mcp-definer-api-key', 'dev-api-key');
    localStorage.setItem('mcp-definer-role', 'owner');
  });
}

async function waitForApp(page) {
  await page.goto(webBase, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=MCP Definer', { timeout: 30_000 });
}

async function screenshot(page, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  saved ${name}.png`);
  return path;
}

async function startCreateWizard(page) {
  await page.goto(`${webBase}/mcps/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h2:has-text("Import OpenAPI spec")');
  await page.fill('#slug', 'readme-demo');
  await page.fill('#name', 'Petstore Demo');
  await page.fill('#content', petstoreSpec);
  await page.getByRole('button', { name: /Parse & continue/i }).click();
  await page.waitForSelector('h2:has-text("Preview operations")', { timeout: 30_000 });
}

async function clickWizardStep(page, stepLabel) {
  await page
    .locator('nav[aria-label="Wizard progress"] button')
    .filter({ hasText: stepLabel })
    .click();
  await page.waitForTimeout(700);
}

function loadRgba(path) {
  const img = PNG.sync.read(readFileSync(path));
  return {
    width: img.width,
    height: img.height,
    data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
  };
}

function blendRgba(a, b, t) {
  const out = new Uint8Array(a.length);
  const u = 1 - t;
  for (let i = 0; i < a.length; i += 4) {
    out[i] = Math.round(a[i] * u + b[i] * t);
    out[i + 1] = Math.round(a[i + 1] * u + b[i + 1] * t);
    out[i + 2] = Math.round(a[i + 2] * u + b[i + 2] * t);
    out[i + 3] = Math.round(a[i + 3] * u + b[i + 3] * t);
  }
  return out;
}

/** Hold each frame 3s (5s on last), crossfade 0.5s between steps, then loop back to first. gifenc delay is in ms. */
function buildCrossfadeGif(framePaths, outputPath) {
  const HOLD_DELAY_MS = 3000;
  const LAST_HOLD_DELAY_MS = 5000;
  const CROSSFADE_FRAMES = 10;
  const CROSSFADE_FRAME_DELAY_MS = 50;

  const images = framePaths.map(loadRgba);
  const { width, height } = images[0];
  const enc = GIFEncoder();

  const writeRgba = (rgba, delayMs) => {
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    enc.writeFrame(index, width, height, { palette, delay: delayMs });
  };

  const writeCrossfade = (from, to) => {
    for (let step = 1; step <= CROSSFADE_FRAMES; step++) {
      writeRgba(blendRgba(from, to, step / CROSSFADE_FRAMES), CROSSFADE_FRAME_DELAY_MS);
    }
  };

  for (let i = 0; i < images.length; i++) {
    const isLast = i === images.length - 1;
    writeRgba(images[i].data, isLast ? LAST_HOLD_DELAY_MS : HOLD_DELAY_MS);

    if (isLast) {
      writeCrossfade(images[i].data, images[0].data);
    } else {
      writeCrossfade(images[i].data, images[i + 1].data);
    }
  }

  enc.finish();
  writeFileSync(outputPath, Buffer.from(enc.bytes()));
  console.log(`  saved ${outputPath.split(/[/\\]/).pop()}`);
}

async function recordWizardGif(page) {
  const slug = `gifdemo${Date.now()}`;

  await page.goto(`${webBase}/mcps/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h2:has-text("Import OpenAPI spec")');
  await page.fill('#slug', slug);
  await page.fill('#name', 'Petstore Demo');
  await page.fill('#content', petstoreSpec);

  const frames = [];

  frames.push(await screenshot(page, '_frame-import-spec'));

  await page.getByRole('button', { name: /Parse & continue/i }).click();
  await page.waitForSelector('h2:has-text("Preview operations")', { timeout: 30_000 });
  frames.push(await screenshot(page, '_frame-preview-operations'));

  await page.getByRole('button', { name: /Continue to curation/i }).click();
  await page.waitForSelector('h2:has-text("Curate tools")', { timeout: 15_000 });
  frames.push(await screenshot(page, '_frame-curate-tools'));

  await Promise.all([
    page.waitForResponse(
      (r) => /\/mcps$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST' && r.ok(),
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: /Save draft & continue/i }).click(),
  ]);
  await page.waitForSelector('h2:has-text("Configure authentication")', { timeout: 15_000 });
  await page.fill('#secret', 'demo-screenshot-key');
  frames.push(await screenshot(page, '_frame-configure-auth'));

  await page.getByRole('button', { name: /Save & continue/i }).click();
  await page.waitForSelector('h2:has-text("Validate manifest")', { timeout: 30_000 });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/validate') && r.request().method() === 'POST' && r.ok(),
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: /Run validation/i }).click(),
  ]);
  await page.waitForSelector('text=Manifest is valid', { timeout: 15_000 });
  frames.push(await screenshot(page, '_frame-validate'));

  await clickWizardStep(page, 'Test');
  frames.push(await screenshot(page, '_frame-test'));

  await clickWizardStep(page, 'Publish');
  await page.fill('#changelog', 'Initial Petstore MCP — getPetById and listPets tools.');
  frames.push(await screenshot(page, '_frame-publish'));

  buildCrossfadeGif(frames, join(outDir, 'authoring-workflow.gif'));
  for (const frame of frames) {
    const { unlink } = await import('node:fs/promises');
    await unlink(frame).catch(() => {});
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const { chromium } = await import('playwright');

  const { id: petstoreId } = await fetchPetstoreMeta();
  console.log(`Using petstore MCP ${petstoreId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await seedLocalStorage(page);

  console.log('Capturing static screenshots...');

  await waitForApp(page);
  await page.waitForSelector('text=Petstore', { timeout: 15_000 });
  await screenshot(page, '01-catalog');

  await page.goto(`${webBase}/mcps/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h2:has-text("Import OpenAPI spec")');
  await screenshot(page, '02-import-spec');

  await startCreateWizard(page);
  await screenshot(page, '03-preview-operations');

  await page.getByRole('button', { name: /Continue to curation/i }).click();
  await page.waitForSelector('h2:has-text("Curate tools")', { timeout: 15_000 });
  await screenshot(page, '04-curate-tools');

  await page.goto(`${webBase}/mcps/${petstoreId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Petstore API', { timeout: 15_000 });
  await screenshot(page, '05-mcp-detail');

  await page.getByRole('button', { name: 'Test console' }).click();
  await page.waitForURL(`**/mcps/${petstoreId}/test`, { timeout: 15_000 });
  await page.waitForSelector('text=Tools', { timeout: 30_000 });
  const toolBtn = page.getByRole('button', { name: 'getPetById' }).first();
  if (await toolBtn.count()) {
    await toolBtn.click();
    await page.waitForTimeout(400);
  }
  await screenshot(page, '06-test-console');

  await page.goto(`${webBase}/registry`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Registry")', { timeout: 15_000 });
  await screenshot(page, '07-registry-browse');

  console.log('Building authoring workflow GIF...');
  await recordWizardGif(page);

  await browser.close();
  console.log('\nDone — assets in docs/screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
