'use strict';

/**
 * test-fal-vton.js
 *
 * Standalone smoke-test for FalCatVtonProvider.
 * Calls fal.ai CatVTON directly — no Twilio, no scheduler, no ReminderRunner.
 *
 * Usage:
 *   node test-fal-vton.js
 *
 * Optional overrides via CLI flags:
 *   --person   <absolute path to person image>
 *   --garment  <absolute path to garment image>
 *   --prompt   <garment description>
 *   --out      <output file path>
 */

require('dotenv').config();

const path = require('node:path');
const fs   = require('node:fs/promises');

const { FalCatVtonProvider } = require('./src/infrastructure/imagegen/FalCatVtonProvider');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const UPLOADS_DIR = path.join(__dirname, 'demo', 'uploads');
const ASSETS_DIR  = path.join(__dirname, 'src', 'demo', 'assets');
const OUTPUT_DIR  = path.join(__dirname, 'src', 'demo', 'generated');

// ---------------------------------------------------------------------------
// CLI argument parsing
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

// Most-recent uploaded profile photo (by filename timestamp — sort descending)
const DEFAULT_PERSON_IMAGE  = path.join(UPLOADS_DIR, 'demo-user-1784050445827-d662dee2.jpeg');
const DEFAULT_GARMENT_IMAGE = path.join(ASSETS_DIR,  'navy-denim-jacket.png');
const DEFAULT_PROMPT        = 'navy denim jacket';
const DEFAULT_OUTPUT        = path.join(OUTPUT_DIR, 'test-output.png');

const profilePhotoPath = path.resolve(args.person  ?? DEFAULT_PERSON_IMAGE);
const garmentImagePath = path.resolve(args.garment ?? DEFAULT_GARMENT_IMAGE);
const prompt           = args.prompt ?? DEFAULT_PROMPT;
const outputPath       = path.resolve(args.out    ?? DEFAULT_OUTPUT);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(56));
  console.log('FalCatVtonProvider — standalone test');
  console.log('='.repeat(56));
  console.log('Person image :', profilePhotoPath);
  console.log('Garment image:', garmentImagePath);
  console.log('Prompt       :', prompt);
  console.log('Output       :', outputPath);
  console.log('-'.repeat(56));

  // Verify input files exist before touching the network
  await fs.access(profilePhotoPath).catch(() => {
    throw new Error(`Person image not found: ${profilePhotoPath}`);
  });
  await fs.access(garmentImagePath).catch(() => {
    throw new Error(`Garment image not found: ${garmentImagePath}`);
  });

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is not set in .env');
  }

  const provider = new FalCatVtonProvider({ apiKey: process.env.FAL_KEY });

  console.log('\n⏳ Starting generation (uploading images to fal.ai) ...');
  const startMs = Date.now();

  const { imageBytes, mimeType } = await provider.generateImage({
    profilePhotoPath,
    garmentImagePath,
    prompt,
  });

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n✅ Generation completed in ${elapsed}s  (${mimeType}, ${(imageBytes.length / 1024).toFixed(1)} KB)`);

  // Save output
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, imageBytes);

  console.log(`💾 Saved → ${outputPath}`);
  console.log('='.repeat(56));
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err.message ?? err);
  process.exit(1);
});
