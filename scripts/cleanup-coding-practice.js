/*
  Cleanup script for coding practice collections.
  Safe by design: does NOT run unless you pass CONFIRM_CLEANUP=true environment variable.

  Usage (PowerShell):
    $env:CONFIRM_CLEANUP = "true"; node scripts/cleanup-coding-practice.js

  Or single-line:
    cmd /c "set CONFIRM_CLEANUP=true&& node scripts/cleanup-coding-practice.js"

  The script reads MONGOURI2 or MONGODB_URI env var. It will attempt to drop the following collections if they exist:
    - coding_problems
    - student_submissions
    - problem_groups
    - problem_comments
    - student_doubts
    - problem_comments (fallback names)

  It prints actions and errors. Nothing is deleted unless CONFIRM_CLEANUP=true is set.
*/

// Load .env from project root so running `node` picks up variables from the .env file
try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
} catch (e) {
  // ignore if dotenv not installed; we'll still try environment variables
}

const { MongoClient } = require('mongodb');

// Allow explicit override of URI (useful when both MONGOURI2 and MONGODB_URI are present)
const uri = process.env.MONGODB_URI;
const confirm = (process.env.CONFIRM_CLEANUP || '').toLowerCase() === 'true';

const targetCollections = [
  'coding_problems',
  'student_submissions',
  'problem_groups',
  'problem_comments',
  'student_doubts',
  'problem_comments'
];

(async () => {
  if (!uri) {
    console.error('ERROR: No MONGOURI2 or MONGODB_URI environment variable found. Aborting.');
    process.exit(1);
  }

  console.log('Mongo URI provided (hidden). Preparing to connect...');

  if (!confirm) {
    console.log('\nDRY RUN: CONFIRM_CLEANUP is not set to true. No deletions will be performed.');
    console.log('To actually delete, set environment variable CONFIRM_CLEANUP=true and re-run the script.');
    console.log('\nCollections that WOULD be dropped (if present):');
    targetCollections.forEach(c => console.log(' -', c));
    process.exit(0);
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    console.log('Connected to MongoDB.');

    // Determine database name from URI if present, otherwise prompt uses the default DB
    const dbNameFromUri = (() => {
      try {
        // parse after last "/" before ?
        const afterSlash = uri.split('/').pop();
        if (!afterSlash) return null;
        const dbPart = afterSlash.split('?')[0];
        return dbPart || null;
      } catch (e) {
        return null;
      }
    })();

    const adminDb = client.db(dbNameFromUri || undefined);
    const dbName = adminDb.databaseName;
    console.log('Target database:', dbName);

    const existing = await adminDb.listCollections().toArray();
    const existingNames = existing.map(c => c.name);

    for (const coll of targetCollections) {
      if (existingNames.includes(coll)) {
        console.log(`Dropping collection: ${coll}`);
        await adminDb.collection(coll).drop();
        console.log(`Dropped ${coll}`);
      } else {
        console.log(`Collection not found (skipping): ${coll}`);
      }
    }

    console.log('\nCleanup completed successfully.');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
})();
