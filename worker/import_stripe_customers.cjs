#!/usr/bin/env node
// worker/import_stripe_customers.cjs

/**
 * Lists all Stripe customers, and for each one with an email,
 * runs a Wrangler D1 SQL command to update your users table.
 */

const Stripe = require("stripe");
const { execSync } = require("child_process");

// load your Stripe secret key from environment
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error("❌ Missing STRIPE_SECRET_KEY env var");
  process.exit(1);
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2023-10-16",
});

// your D1 database binding name from wrangler.toml
const DB_NAME = "gutter_db";

async function main() {
  let startingAfter;

  do {
    const resp = await stripe.customers.list({
      limit: 100,
      starting_after: startingAfter,
    });

    for (const c of resp.data) {
      if (!c.email) continue;
      const id = c.id.replace(/'/g, "''");
      const email = c.email.replace(/'/g, "''");

      console.log(`→ Mapping ${email} → ${id}`);
      execSync(
        `npx wrangler d1 execute ${DB_NAME} --remote --command "` +
          `UPDATE users SET stripe_customer_id = '${id}' WHERE email = '${email}';` +
          `"`,
        { stdio: "inherit" }
      );
    }

    if (resp.data.length) {
      startingAfter = resp.data[resp.data.length - 1].id;
    } else {
      startingAfter = undefined;
    }
  } while (startingAfter);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
