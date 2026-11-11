const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { setTimeout: hold } = require('node:timers/promises');
const { parseArgs } = require('node:util');

const root = resolve(__dirname, '..');
const modelSettings = ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'];
const sandboxSettings = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', ...modelSettings];
const reason = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const evidenceLabel = 'Carrier acceptance scan';
const evidence = 'The carrier accepted the test parcel for shipment on November 4. The scan does not confirm delivery.';
const finalResponse = 'The carrier accepted the test parcel for shipment on November 4 [E1]. We are checking for delivery confirmation.';
const viewport = { width: 1280, height: 720 };

async function waitForServer(server, port) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PayCrew did not start on port ' + port + '.')), 8000);
    server.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('PayCrew could not start on port ' + port + '. Check whether the port is available.'));
    });
    server.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Could not launch the PayCrew server.'));
    });
    server.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function apiResult(response, operation, source) {
  const payload = await response.json();
  if (!response.ok()) throw new Error(operation + ' failed. ' + (payload.error || 'HTTP ' + response.status()));
  assert.equal(payload.source, source, operation + ' returned an unexpected case source.');
  return payload;
}

async function addRecordingOverlay(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #recording-caption {
        position: fixed; z-index: 20; bottom: 16px; left: 16px; right: 16px;
        padding: 13px 18px; border: 1px solid #68768e; border-radius: 9px;
        background: #182439; color: #f7f8fc; box-shadow: 0 5px 20px #18243933;
        font: 550 16px/1.4 system-ui, sans-serif;
        display: flex; align-items: baseline; gap: 16px; pointer-events: none;
      }
      #recording-caption strong {
        color: #d0c7ff; border-right: 1px solid #68768e; padding-right: 16px; white-space: nowrap;
      }
      #recording-pointer {
        position: fixed; z-index: 21; top: 0; left: 0; width: 19px; height: 19px;
        margin: -9px; border: 2px solid #5941c3; border-radius: 50%; background: #b6a9ff47;
        box-shadow: 0 0 0 2px #fff; pointer-events: none;
      }
      #recording-packet {
        position: fixed; z-index: 19; inset: 72px max(42px, calc((100vw - 760px)/2)) 88px;
        display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dce3ee;
        border-radius: 12px; background: #fff; box-shadow: 0 0 0 200vmax #18243999;
      }
      #recording-packet h2 {
        padding: 17px 23px; color: #182439; border-bottom: 1px solid #dce3ee; font-size: 17px;
      }
      #recording-packet pre {
        overflow: auto; white-space: pre-wrap; padding: 6px 23px; color: #26334b; line-height: 1.55;
      }
    `;
    const caption = document.createElement('aside');
    caption.id = 'recording-caption';
    caption.append(document.createElement('strong'), document.createElement('span'));
    const pointer = document.createElement('div');
    pointer.id = 'recording-pointer';
    pointer.hidden = true;
    document.addEventListener('pointermove', event => {
      pointer.style.transform = 'translate(' + event.clientX + 'px, ' + event.clientY + 'px)';
      pointer.hidden = false;
    });
    document.addEventListener('pointerdown', () => {
      pointer.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], 400);
    });
    document.head.append(style);
    document.body.append(caption, pointer);
  });
}

function caption(page, title, description) {
  return page.locator('#recording-caption').evaluate((element, values) => {
    element.firstChild.textContent = values.title;
    element.lastChild.textContent = values.description;
  }, { title, description });
}

async function focusView(locator, block = 'center') {
  await locator.evaluate((element, block) => element.scrollIntoView({ block, behavior: 'smooth' }), block);
  await hold(550);
  await locator.hover();
}

async function capture(page, address, source) {
  const loadQueue = page.waitForResponse(response => response.url() === address + '/api/disputes', { timeout: 28_000 });
  await page.goto(address);
  const { items } = await apiResult(await loadQueue, 'Loading the dispute queue', source);
  const selected = items.find(item => item.reason === reason);
  assert(selected, source === 'sandbox'
    ? 'The Sandbox queue has no item-not-received test dispute. Create one through the buyer’s Sandbox Resolution Center.'
    : 'The item-not-received demo case is missing.');
  const sourceName = source === 'sandbox' ? 'PayPal Sandbox' : 'Demo data';
  await page.waitForFunction(label => document.querySelector('#source').textContent === label, sourceName);
  await page.locator('#detail-body').waitFor({ timeout: 15_000 });

  await addRecordingOverlay(page);
  await caption(page, 'PayCrew · Disputes', source === 'sandbox'
    ? 'PayPal Sandbox test cases. This walkthrough uses sample evidence.'
    : 'Synthetic demo data. This walkthrough uses an example draft without a model call.');
  await page.locator('#source').hover();
  await hold(4200);
  await page.locator('#queue-title').hover();
  await hold(3900);

  const caseRow = page.getByRole('button', { name: 'Item not received' }).filter({ hasText: selected.dispute_id }).first();
  await caseRow.hover();
  await caption(page, 'Open a case', 'Check the dispute reason, status, amount, and seller response deadline when available.');
  await hold(900);
  const loadDetail = await caseRow.getAttribute('aria-pressed') === 'true' ? null :
    page.waitForResponse(response => response.url() === address + '/api/disputes/' + selected.dispute_id, { timeout: 13_000 });
  await caseRow.click();
  if (loadDetail) await apiResult(await loadDetail, 'Loading the test dispute', source);
  await page.locator('#detail-body').waitFor();
  assert.equal(await page.locator('#detail-id').textContent(), selected.dispute_id);
  await page.locator('#detail-amount').hover();
  await hold(3000);
  await page.locator('#detail-due').hover();
  await hold(3500);

  await caption(page, 'Add evidence', 'This sample carrier scan documents shipment. The evidence label gives the excerpt its E1 reference.');
  const label = page.getByLabel('Evidence label · E1');
  const details = page.getByLabel('Details', { exact: true });
  await focusView(label);
  await label.pressSequentially(evidenceLabel, { delay: 32 });
  await details.hover();
  await details.pressSequentially(evidence, { delay: 20 });
  await hold(3600);

  const generate = page.getByRole('button', { name: 'Generate draft' });
  await generate.hover();
  await caption(page, 'Draft a response', source === 'sandbox'
    ? 'The configured model drafts a response from the case and evidence excerpt.'
    : 'PayCrew builds an example draft from the case and evidence excerpt.');
  await hold(1200);
  const loadDraft = page.waitForResponse(response => response.url() === address + '/api/disputes/' + selected.dispute_id + '/draft', { timeout: 48_000 });
  await generate.click();
  const { draft, model } = await apiResult(await loadDraft, 'Generating the response draft', source);
  assert.equal(model, source === 'sandbox' ? process.env.AI_MODEL : 'Example draft (no model called)');
  assert(draft.citations.includes('E1') && draft.proposedResponse.includes('[E1]'), 'The draft did not cite the supplied excerpt.');
  assert(draft.missingEvidence.length > 0, 'The draft did not identify evidence to verify.');

  await caption(page, 'Trace the draft', 'Review the missing records and match the [E1] citation to the carrier scan.');
  await focusView(page.locator('#draft-missing'));
  await hold(4300);
  await focusView(page.locator('#draft-citations'));
  await hold(4700);

  await caption(page, 'Edit the response', 'The reviewer can make the shipment wording precise and keep the evidence reference.');
  const review = page.getByRole('textbox', { name: 'Final response', exact: true });
  const downloadButton = page.getByRole('button', { name: 'Download evidence packet' });
  await focusView(review);
  assert(await downloadButton.isDisabled(), 'The evidence packet can be exported before review.');
  await hold(1900);
  await review.fill('');
  await review.pressSequentially(finalResponse, { delay: 23 });
  await hold(3400);

  await caption(page, 'Confirm the review', 'In this walkthrough, checking the review box enables export of the edited response.');
  const confirmation = page.locator('#review-confirmation');
  await focusView(confirmation);
  await hold(1300);
  await confirmation.check();
  await hold(4000);

  await caption(page, 'Export the packet', 'Download the evidence, draft, and reviewer-approved response in one text file.');
  await focusView(downloadButton);
  await hold(1200);
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadEvent;
  const packet = await readFile(await download.path(), 'utf8');
  assert(packet.includes('Source: ' + sourceName) && packet.includes('[E1] ' + evidenceLabel) &&
    packet.includes('Reviewer-approved response\n' + finalResponse) && /Reviewed at \(UTC\): \d{4}-/.test(packet),
    'The downloaded evidence packet did not include the case source, cited evidence, and confirmed edit.');

  await page.evaluate(({ filename, packet }) => {
    const preview = document.createElement('section');
    preview.id = 'recording-packet';
    const title = document.createElement('h2');
    title.textContent = filename;
    const contents = document.createElement('pre');
    contents.textContent = packet;
    preview.append(title, contents);
    document.body.append(preview);
  }, { filename: download.suggestedFilename(), packet });
  await hold(4400);
  await page.locator('#recording-packet pre').evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }));
  await hold(6800);
}

async function main() {
  const { values } = parseArgs({ options: { sandbox: { type: 'boolean' }, output: { type: 'string' } } });
  const source = values.sandbox ? 'sandbox' : 'fixture';
  const missing = sandboxSettings.filter(name => !process.env[name]?.trim());
  if (values.sandbox && missing.length) throw new Error('Sandbox recording requires ' + missing.join(', ') + '.');
  const { chromium } = require('playwright');
  const env = { ...process.env, PORT: process.env.PORT || '4173' };
  if (!values.sandbox) {
    for (const name of [...sandboxSettings, 'OPENAI_API_KEY', 'OPENAI_MODEL']) delete env[name];
  }
  const output = resolve(values.output || 'paycrew-demo.webm');
  if (!output.endsWith('.webm')) throw new Error('Choose a .webm output path.');
  const temporary = await mkdtemp(join(tmpdir(), 'paycrew-recording-'));
  const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'ignore'] });
  let browser;
  try {
    await waitForServer(server, env.PORT);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
    const context = await browser.newContext({ viewport, recordVideo: { dir: temporary, size: viewport } });
    context.setDefaultTimeout(7000);
    const page = await context.newPage();
    await capture(page, 'http://127.0.0.1:' + env.PORT, source);
    const video = page.video();
    await context.close();
    await mkdir(dirname(output), { recursive: true });
    await video.saveAs(output);
    console.log('Recorded ' + source + ' walkthrough to ' + output);
  } finally {
    await browser?.close();
    server.kill();
    await rm(temporary, { force: true, recursive: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
