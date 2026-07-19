/**
 * test-idm-vton.js
 *
 * Standalone validation script for the IDM-VTON Gradio Space.
 * Run with:
 *
 *   node src/demo/test-idm-vton.js
 *
 * Or override the default image paths:
 *
 *   node src/demo/test-idm-vton.js ^
 *     --person path/to/person.jpg ^
 *     --garment path/to/garment.jpg ^
 *     --desc "a red cotton t-shirt"
 *
 * What this script does:
 *   1. Connects to yisol/IDM-VTON on Hugging Face Spaces
 *   2. Passes the person + garment images via handle_file() (correct Node path)
 *   3. Calls /tryon with the defaults specified in the milestone brief
 *   4. Prints the complete raw response
 *   5. Downloads and saves the output image locally
 */

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs/promises');
const https = require('node:https');
const http = require('node:http');

// ---------------------------------------------------------------------------
// CLI argument parsing (no extra deps)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

// Default to two upper-body assets that exist in the repo.
// For a real try-on you want a clear front-facing photo of the person and a
// flat-lay / catalogue image of the garment on a clean background.
const PERSON_IMAGE = path.resolve(args.person ?? path.join(__dirname, 'assets', 'white-linen-shirt.png'));
const GARMENT_IMAGE = path.resolve(args.garment ?? path.join(__dirname, 'assets', 'navy-denim-jacket.png'));
const GARMENT_DESC = args.desc ?? 'a navy denim jacket';

const OUTPUT_DIR = path.join(__dirname, 'generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `idm-vton-test-${Date.now()}.png`);

// ---------------------------------------------------------------------------
// Helper: download a URL → Buffer (follows one redirect)
// ---------------------------------------------------------------------------
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} while downloading: ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // @gradio/client is an ESM-only package — use dynamic import
  const { Client, handle_file } = await import('@gradio/client');

  console.log('='.repeat(60));
  console.log('IDM-VTON Gradio API — standalone validation');
  console.log('='.repeat(60));
  console.log('Space      :', 'yisol/IDM-VTON');
  console.log('Person     :', PERSON_IMAGE);
  console.log('Garment    :', GARMENT_IMAGE);
  console.log('Description:', GARMENT_DESC);
  console.log('-'.repeat(60));

  // Verify local files exist before touching the network
  await fs.access(PERSON_IMAGE);
  await fs.access(GARMENT_IMAGE);
  console.log('✅ Input files found on disk');

  // 1. Connect
  console.log('\n⏳ Connecting to yisol/IDM-VTON ...');
  const client = await Client.connect('yisol/IDM-VTON');
  console.log('✅ Connected');

  // 2. Build inputs
  //
  // handle_file(absolutePathString) in Node.js returns a Command("upload_file")
  // object that @gradio/client resolves automatically when predict() is called.
  // This is the correct approach for local files in Node — do NOT use
  // client.upload() which is a browser-side API expecting File objects with
  // a .size property.
  //
  // /tryon parameter schema (from https://yisol-idm-vton.hf.space/info):
  //
  //  param 0  dict          — ImageEditor  { background: FileData, layers: [], composite: null }
  //  param 1  garm_img      — Image        FileData
  //  param 2  garment_des   — Textbox      string
  //  param 3  is_checked    — Checkbox     bool   (auto-mask)
  //  param 4  is_checked_crop — Checkbox   bool
  //  param 5  denoise_steps — Number       number
  //  param 6  seed          — Number       number
  //
  // The ImageEditor (dict) wraps the person image as the "background" layer.
  // handle_file on a plain Image component can be passed directly.

  const personFileHandle = handle_file(PERSON_IMAGE);
  const garmentFileHandle = handle_file(GARMENT_IMAGE);

  console.log('\n--- handle_file() debug ---');
  console.log('personFileHandle  :', JSON.stringify(personFileHandle, null, 2));
  console.log('garmentFileHandle :', JSON.stringify(garmentFileHandle, null, 2));
  console.log('---------------------------');

  // The ImageEditor component expects an object with background / layers / composite.
  // We set background to the handle_file result and leave the rest empty/null.
  const dictInput = {
    background: personFileHandle,
    layers: [],
    composite: null,
  };

  // 3. Call /tryon
  console.log('\n⏳ Calling /tryon (may take 30–120 s on a cold Space) ...');
  const startMs = Date.now();

  const result = await client.predict('/tryon', {
    dict: dictInput,
    garm_img: garmentFileHandle,
    garment_des: GARMENT_DESC,
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42,
  });

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`✅ /tryon completed in ${elapsedSec}s`);

  // 4. Print the complete raw response
  console.log('\n=== COMPLETE RAW RESPONSE ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(60));

  // 5. Extract and save the output image
  const output = result?.data;
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error(`Unexpected response shape — result.data is: ${JSON.stringify(result)}`);
  }

  const tryOnResult = output[0];   // primary try-on image
  const maskedResult = output[1];   // masked debug image (may be null)

  console.log('\noutput[0] type    :', typeof tryOnResult);
  console.log('output[0] value   :', JSON.stringify(tryOnResult));
  console.log('output[1] value   :', JSON.stringify(maskedResult));

  // The output can be a URL string OR a FileData object { url, path, ... }
  const imageUrl =
    typeof tryOnResult === 'string'
      ? tryOnResult
      : tryOnResult?.url ?? tryOnResult?.path;

  if (!imageUrl) {
    throw new Error(`Cannot extract image URL from output[0]: ${JSON.stringify(tryOnResult)}`);
  }

  console.log('\n⏳ Downloading result from:', imageUrl);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const imageBytes = await downloadBuffer(imageUrl);
  await fs.writeFile(OUTPUT_FILE, imageBytes);

  console.log(`✅ Saved → ${OUTPUT_FILE}  (${(imageBytes.length / 1024).toFixed(1)} KB)`);
  console.log('\n🎉 Validation complete — IDM-VTON API is reachable and working.');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err.message ?? err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
