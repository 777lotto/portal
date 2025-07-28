import fs from 'fs/promises';
import path from 'path';

const workerDir = './worker';

// This function is robust and remains the same.
function parseSqlValues(valuesString) {
    return (valuesString.match(/'(?:[^']|'')*'|[^,()';]+/g) || []).map(v => v.trim());
}

/**
 * A new, corrected file processor that ONLY processes INSERT statements
 * and discards everything else (like CREATE TABLE).
 * @param {string} inPath - Path to the input .sql file.
 * @param {string} outPath - Path to write the transformed .sql file.
 * @param {function(string, number): string | null} lineTransformer - The transformation function.
 */
async function processSqlInsertsOnly(inPath, outPath, lineTransformer) {
  const inFileName = path.basename(inPath);
  try {
    const sql = await fs.readFile(inPath, 'utf-8');
    const lines = sql.split('\n');
    const transformedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('INSERT INTO')) {
            const transformed = lineTransformer(line, i + 1);
            if (transformed) {
                transformedLines.push(transformed);
            }
        }
    }

    if (transformedLines.length === 0) {
        console.log(`🟡 No INSERT statements were transformed for ${inFileName}. File will be empty.`);
    }

    await fs.writeFile(outPath, transformedLines.join('\n') + '\n');
    console.log(`✅ Transformed ${transformedLines.length} INSERT statements for: ${inFileName} -> ${path.basename(outPath)}`);
  } catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`-  Warning: Backup file not found at ${inPath}. Skipping.`);
    } else {
        console.error(`❌ Error transforming ${inFileName}:`, e.message);
    }
  }
}


async function main() {
  console.log('--- Starting Final, Data-Only Transformation ---');

  // --- Users ---
  await processSqlInsertsOnly(path.join(workerDir, 'users_backup.sql'), path.join(workerDir, 'users_transformed.sql'), line => line);

  // --- Photos ---
  await processSqlInsertsOnly(path.join(workerDir, 'photos_backup.sql'), path.join(workerDir, 'photos_transformed.sql'), (line, lineNum) => {
    const parts = line.split(' VALUES(');
    const values = parseSqlValues(parts[1]);
    if (values.length < 6) return null;
    const [id, user_id, job_id, service_id, url, created_at] = values;
    return `INSERT INTO photos (id, user_id, invoice_id, item_id, job_id, url, created_at) VALUES(${id}, ${user_id}, NULL, ${service_id}, ${job_id}, ${url}, ${created_at});`;
  });

  // --- Notes ---
  await processSqlInsertsOnly(path.join(workerDir, 'notes_backup.sql'), path.join(workerDir, 'notes_transformed.sql'), (line, lineNum) => {
    const parts = line.split(' VALUES(');
    const values = parseSqlValues(parts[1]);
    if (values.length < 8) return null;
    values.push(`'${new Date().toISOString()}'`); // Add updated_at
    return `INSERT INTO notes (id, user_id, photo_id, invoice_id, item_id, job_id, content, created_at, updated_at) VALUES(${values.join(',')});`;
  });

  // --- Blocked Dates -> Calendar Events ---
  await processSqlInsertsOnly(path.join(workerDir, 'blocked_dates_backup.sql'), path.join(workerDir, 'calendar_events_transformed.sql'), line => {
      return line.replace('blocked_dates', 'calendar_events');
  });

  // --- Services -> Line Items ---
  await processSqlInsertsOnly(path.join(workerDir, 'services_backup.sql'), path.join(workerDir, 'line_items_transformed.sql'), (line, lineNum) => {
    const parts = line.split(' VALUES(');
    const values = parseSqlValues(parts[1]);
    if (values.length < 4) return null;
    const [id, job_id, notes, price_cents] = values;
    return `INSERT INTO line_items (id, job_id, item, price_cents) VALUES(${id}, ${job_id}, ${notes}, ${price_cents});`;
  });

  // --- Job Recurrence Requests ---
  await processSqlInsertsOnly(path.join(workerDir, 'job_recurrence_requests_backup.sql'), path.join(workerDir, 'job_recurrence_requests_transformed.sql'), (line, lineNum) => {
    const parts = line.split(' VALUES(');
    const values = parseSqlValues(parts[1]);
    if (values.length < 8) return null;
    values.splice(6, 1); // Remove admin_notes
    return `INSERT INTO job_recurrence_requests (id, job_id, user_id, frequency, requested_day, status, created_at, updated_at) VALUES(${values.join(',')});`;
  });

  // --- Jobs ---
  await processSqlInsertsOnly(path.join(workerDir, 'jobs_backup.sql'), path.join(workerDir, 'jobs_transformed.sql'), (line, lineNum) => {
    const parts = line.split(' VALUES(');
    const values = parseSqlValues(parts[1]);
    if (values.length < 17) return null;
    const [id, customerId, title, description, _a, _p, status, recurrence, _s, _j, createdAt, updatedAt, stripe_invoice_id, stripe_quote_id, _i, total_amount_cents, expires_at] = values;
    const newValues = [id, customerId, title, description, status, recurrence, createdAt, updatedAt, stripe_invoice_id, stripe_quote_id, total_amount_cents, expires_at];
    return `INSERT INTO jobs (id, customerId, title, description, status, recurrence, createdAt, updatedAt, stripe_invoice_id, stripe_quote_id, total_amount_cents, due) VALUES(${newValues.join(',')});`;
  });

  console.log('\n--- Transformation Finished ---');
}

main();
