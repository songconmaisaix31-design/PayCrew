const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { setTimeout: hold } = require('node:timers/promises');
const { parseArgs } = require('node:util');

const root = resolve(__dirname, '..');
const modelSettings = ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'];
const sandboxSettings = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'];
const exampleModel = 'Example draft (no model called)';
const reason = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const evidenceLabel = 'Carrier acceptance scan';
const evidence = 'The carrier accepted the test parcel for shipment on November 4. The scan does not confirm delivery.';
const instruction = 'Draft a response and flag missing proof.';
const composerPrompt = instruction + '\n\n' + evidenceLabel + ': ' + evidence;
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
        padding: 13px 18px; border: 1px solid #648373; border-radius: 9px;
        background: #142c24; color: #f2f8f2; box-shadow: 0 5px 20px #142c2433;
        font: 550 16px/1.4 system-ui, sans-serif;
        display: flex; align-items: baseline; gap: 16px; pointer-events: none;
      }
      #recording-caption strong {
        color: #d1ecd5; border-right: 1px solid #648373; padding-right: 16px; white-space: nowrap;
      }
      #recording-pointer {
        position: fixed; z-index: 21; top: 0; left: 0; width: 19px; height: 19px;
        margin: -9px; border: 2px solid #205640; border-radius: 50%; background: #a4d7b247;
        box-shadow: 0 0 0 2px #fff; pointer-events: none;
      }
      #recording-packet {
        position: fixed; z-index: 19; inset: 72px max(42px, calc((100vw - 760px)/2)) 88px;
        display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dce4dd;
        border-radius: 12px; background: #fff; box-shadow: 0 0 0 200vmax #142c2499;
      }
      #recording-packet h2 {
        padding: 17px 23px; color: #142c24; border-bottom: 1px solid #dce4dd; font-size: 17px;
      }
      #recording-packet pre {
        overflow: auto; white-space: pre-wrap; padding: 6px 23px; color: #263a2f; line-height: 1.55;
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

async function capture(page, address, { source, liveAI, expectedModel }) {
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
  const opening = source === 'sandbox' ? 'PayPal Sandbox test cases with sample evidence.' : 'Synthetic demo disputes with sample evidence.';
  await caption(page, 'PayCrew · Disputes', opening + (liveAI
    ? ' Live AI model · ' + expectedModel + '.'
    : ' This walkthrough uses an example draft without a model call.'));
  await page.locator('#source').hover();
  await hold(4200);
  await page.locator('#queue-title').hover();
  await hold(3900);

  const caseRow = page.getByRole('button', { name: 'Item not received' }).filter({ hasText: selected.dispute_id }).first();
  await caseRow.hover();
  await caption(page, 'Open a case', 'Check the dispute reason, status, amount, and seller response deadline when available.');
  await hold(900);
  const detailAddress = address + '/api/disputes/' + encodeURIComponent(selected.dispute_id);
  const loadDetail = await caseRow.getAttribute('aria-pressed') === 'true' ? null :
    page.waitForResponse(response => response.url() === detailAddress, { timeout: 13_000 });
  await caseRow.click();
  if (loadDetail) await apiResult(await loadDetail, 'Loading the test dispute', source);
  await page.locator('#detail-body').waitFor();
  assert.equal(await page.locator('#detail-id').textContent(), selected.dispute_id);
  await page.locator('#detail-amount').hover();
  await hold(3000);
  await page.locator('#detail-due').hover();
  await hold(3500);

  await caption(page, 'Ask the assistant', 'Paste the drafting request and a labeled evidence excerpt into the same message.');
  const composer = page.locator('#composer');
  await focusView(composer);
  await hold(800);
  await composer.fill(composerPrompt);
  await hold(3600);

  const generate = page.locator('#generate');
  await generate.hover();
  await caption(page, 'Draft a response', liveAI
    ? 'The configured AI model drafts from the case and the pasted evidence.'
    : 'PayCrew builds an example draft from the case and the pasted evidence.');
  await hold(1200);
  const loadDraft = page.waitForResponse(response => response.url() === detailAddress + '/draft', { timeout: 48_000 });
  await generate.click();
  const draftResponse = await loadDraft;
  const { draft, model } = await apiResult(draftResponse, 'Generating the response draft', source);
  const draftInput = draftResponse.request().postDataJSON();
  assert.equal(draftInput.instruction, instruction, 'The drafting request did not reach the assistant.');
  assert.deepEqual(draftInput.evidence, [{ label: evidenceLabel, text: evidence }]);
  assert.equal(model, expectedModel);
  assert(draft.citations.includes('E1') && draft.proposedResponse.includes('[E1]'), 'The draft did not cite the supplied excerpt.');
  assert(draft.missingEvidence.length > 0, 'The draft did not identify evidence to verify.');

  await page.locator('#draft-output').waitFor();
  await caption(page, 'Trace the draft', 'Check what proof is missing, then follow [E1] to the carrier scan.');
  await focusView(page.locator('#draft-missing'));
  await hold(4300);
  const citation = page.locator('#draft-citations').getByRole('link', { name: 'E1', exact: true });
  await focusView(citation);
  await hold(650);
  await citation.click();
  const draftEvidence = page.locator('#source-E1');
  await focusView(draftEvidence);
  const sourceExcerpt = await draftEvidence.textContent();
  assert(sourceExcerpt.includes(evidenceLabel) && sourceExcerpt.includes(evidence), 'The draft did not show the source excerpt.');
  await hold(4200);

  await caption(page, 'Edit the response', 'The reviewer can make the shipment wording precise and keep the evidence reference.');
  const review = page.locator('#final-response');
  const downloadButton = page.locator('#download-packet');
  await focusView(review);
  await hold(1900);
  await review.fill('');
  assert(await downloadButton.isDisabled(), 'A blank response can be approved.');
  await review.pressSequentially(finalResponse, { delay: 23 });
  await hold(3400);

  await caption(page, 'Approve and download', 'Confirm your reviewed response and export the evidence packet in one action.');
  await focusView(downloadButton);
  assert(await downloadButton.isEnabled(), 'The edited response cannot be approved.');
  await hold(2700);
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadEvent;
  const packet = await readFile(await download.path(), 'utf8');
  assert(packet.includes('Source: ' + sourceName) && packet.includes('Model: ' + expectedModel) &&
    packet.includes('[E1] ' + evidenceLabel + '\n' + evidence) &&
    packet.includes('Reviewer-approved response\n' + finalResponse) && /Reviewed at \(UTC\): \d{4}-/.test(packet),
    'The downloaded evidence packet did not include the case source, draft model, cited evidence, and confirmed edit.');

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
  const { values } = parseArgs({ options: { sandbox: { type: 'boolean' }, 'live-ai': { type: 'boolean' }, output: { type: 'string' } } });
  const source = values.sandbox ? 'sandbox' : 'fixture';
  const liveAI = values.sandbox || values['live-ai'];
  const requiredSettings = values.sandbox ? [...sandboxSettings, ...modelSettings] : liveAI ? modelSettings : [];
  const missing = requiredSettings.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    const mode = values.sandbox ? 'Sandbox recording' : 'Live AI fixture recording';
    throw new Error(mode + ' requires ' + missing.join(', ') + '.');
  }
  const { chromium } = require('playwright');
  const env = { ...process.env, PORT: process.env.PORT || '4173' };
  if (!values.sandbox) {
    for (const name of sandboxSettings) delete env[name];
  }
  if (!liveAI) {
    for (const name of [...modelSettings, 'AI_JSON_MODE', 'OPENAI_API_KEY', 'OPENAI_MODEL']) delete env[name];
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
    await capture(page, 'http://127.0.0.1:' + env.PORT, {
      source,
      liveAI,
      expectedModel: liveAI ? env.AI_MODEL : exampleModel
    });
    const video = page.video();
    await context.close();
    await mkdir(dirname(output), { recursive: true });
    await video.saveAs(output);
    const mode = source === 'fixture' && liveAI ? 'fixture-live-ai' : source;
    console.log('Recorded ' + mode + ' walkthrough to ' + output);
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
