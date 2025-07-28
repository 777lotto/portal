import fs from 'fs/promises';
import path from 'path';

// This script should be run from the project root directory ('~/projects/portal')
const workerDir = './worker';

/**
 * A robust function to parse the values from a SQL INSERT statement's VALUES clause.
 * It correctly handles quoted strings containing commas.
 * @param {string} valuesString - The content inside VALUES(), e.g., "'a,b', 2, 'd'"
 * @returns {string[]} An array of the values.
 */
function parseSqlValues(valuesString) {
    // This regex matches either a single-quoted string (including escaped quotes) or a sequence of non-comma characters.
    return (valuesString.match(/'(?:[^']|'')*'|[^,]+/g) || []).map(v => v.trim());
}

/**
 * Reads a SQL backup file, filters for INSERT statements, and applies a transformation to each line.
 * @param {string} inPath - Path to the input .sql file.
 * @param {string} outPath - Path to write the transformed .sql file.
 * @param {function(string): string | null} lineTransformer - A function to transform each INSERT line. Returns null to discard a line.
 */
async function processSqlFile(inPath, outPath, lineTransformer) {
  try {
    const sql = await fs.readFile(inPath, 'utf-8');
    const lines = sql.split('\n').filter(line => line.trim().startsWith('INSERT INTO'));

    if (lines.length === 0) {
        console.log(`🟡 No INSERT statements found in ${path.basename(inPath)}, creating empty file.`);
        await fs.writeFile(outPath, '');
        return;
    }

    const transformedLines = lines.map(lineTransformer).filter(Boolean); // filter(Boolean) removes null/empty results

    await fs.writeFile(outPath, transformedLines.join('\n') + '\n');
    console.log(`✅ Transformed: ${path.basename(inPath)} -> ${path.basename(outPath)}`);
  } catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`-  Warning: Backup file not found at ${inPath}. Skipping.`);
    } else {
        console.error(`❌ Error transforming ${path.basename(inPath)}:`, e.message);
    }
  }
}

async function main() {
  console.log('--- Starting Final, Corrected Data Transformation Script ---');

  // --- Users ---
  await processSqlFile(
    path.join(workerDir, 'users_backup.sql'),
    path.join(workerDir, 'users_transformed.sql'),
    line => line // No changes needed, just strip CREATE TABLE
  );

  // --- Photos ---
  await processSqlFile(
    path.join(workerDir, 'photos_backup.sql'),
    path.join(workerDir, 'photos_transformed.sql'),
    line => {
      const parts = line.split(' VALUES(');
      if (parts.length < 2) return null;
      const values = parseSqlValues(parts[1].slice(0, -2));
      // Old schema: id, user_id, job_id, service_id, url, created_at (6 columns)
      // New schema: id, user_id, invoice_id, item_id, job_id, url, created_at (7 columns)
      const newValues = [
        values[0], // id
        values[1], // user_id
        'NULL',    // invoice_id (new, nullable)
        values[3], // service_id -> item_id
        values[2], // job_id
        values[4], // url
        values[5], // created_at
      ];
      return `INSERT INTO photos (id, user_id, invoice_id, item_id, job_id, url, created_at) VALUES(${newValues.join(',')});`;
    }
  );

  // --- Notes ---
  await processSqlFile(
    path.join(workerDir, 'notes_backup.sql'),
    path.join(workerDir, 'notes_transformed.sql'),
    line => {
        const parts = line.split(' VALUES(');
        if (parts.length < 2) return null;
        const values = parseSqlValues(parts[1].slice(0, -2));
        // Old: id, user_id, photo_id, invoice_id, item_id, job_id, content, created_at (8 columns in some versions)
        // New: id, user_id, photo_id, invoice_id, item_id, job_id, content, created_at, updated_at (9 columns)
        values.push(`'${new Date().toISOString()}'`); // Add updated_at value
        return `INSERT INTO notes (id, user_id, photo_id, invoice_id, item_id, job_id, content, created_at, updated_at) VALUES(${values.join(',')});`;
    }
  );

  // --- Blocked Dates -> Calendar Events ---
  await processSqlFile(
    path.join(workerDir, 'blocked_dates_backup.sql'),
    path.join(workerDir, 'calendar_events_transformed.sql'),
    line => line.replace('blocked_dates', 'calendar_events')
  );

  // --- Services -> Line Items ---
  await processSqlFile(
    path.join(workerDir, 'services_backup.sql'),
    path.join(workerDir, 'line_items_transformed.sql'),
    line => {
        const parts = line.split(' VALUES(');
        if (parts.length < 2) return null;
        const values = parseSqlValues(parts[1].slice(0, -2));
        // Old: id, job_id, notes, price_cents
        const newValues = [
            values[0], // id
            values[1], // job_id
            values[2], // notes -> item
            values[3], // price_cents
        ];
        return `INSERT INTO line_items (id, job_id, item, price_cents) VALUES(${newValues.join(',')});`;
    }
  );

  // --- Job Recurrence Requests ---
  await processSqlFile(
    path.join(workerDir, 'job_recurrence_requests_backup.sql'),
    path.join(workerDir, 'job_recurrence_requests_transformed.sql'),
    line => {
        const parts = line.split(' VALUES(');
        if (parts.length < 2) return null;
        const values = parseSqlValues(parts[1].slice(0, -2));
        values.splice(6, 1); // Remove the 7th value (admin_notes)
        return `INSERT INTO job_recurrence_requests (id, job_id, user_id, frequency, requested_day, status, created_at, updated_at) VALUES(${values.join(',')});`;
    }
  );

  // --- Jobs ---
  await processSqlFile(
    path.join(workerDir, 'jobs_backup.sql'),
    path.join(workerDir, 'jobs_transformed.sql'),
    line => {
        const parts = line.split(' VALUES(');
        if (parts.length < 2) return null;
        const values = parseSqlValues(parts[1].slice(0, -2));
        const newValues = [
            values[0],  // id
            values[1],  // customerId
            values[2],  // title
            values[3],  // description
            values[6],  // status
            values[7],  // recurrence
            values[10], // createdAt
            values[11], // updatedAt
            values[12], // stripe_invoice_id
            values[13], // stripe_quote_id
            values[15], // total_amount_cents
            values[16], // expires_at -> due
        ];
        return `INSERT INTO jobs (id, customerId, title, description, status, recurrence, createdAt, updatedAt, stripe_invoice_id, stripe_quote_id, total_amount_cents, due) VALUES(${newValues.join(',')});`;
    }
  );

  console.log('\n--- Transformation Finished ---');
}

main();
