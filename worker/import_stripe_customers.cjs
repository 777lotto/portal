// worker/import_stripe_customers.cjs
const Stripe = require("stripe");
const { execSync } = require("child_process");

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) throw new Error("Missing STRIPE_SECRET_KEY");

const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
const DB = "gutter_db";

async function main() {
  let startingAfter;

  do {
    const resp = await stripe.customers.list({ limit: 100, starting_after: startingAfter });

    for (const c of resp.data) {
      if (!c.email) continue;
      const email = c.email.replace(/'/g, "''");
      const name  = (c.name || "").replace(/'/g,"''");
      const custId = c.id.replace(/'/g,"''");

      console.log(`→ Upserting ${email} (${custId})`);
      execSync(
        `npx wrangler d1 execute ${DB} --remote --command "` +
          // only insert if not exists
          `INSERT INTO users (email, name, stripe_customer_id) ` +
          `SELECT '${email}', '${name}', '${custId}' ` +
          `WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='${email}');` +
        `"`,
        { stdio: "inherit" }
      );
    }

    startingAfter = resp.data.length ? resp.data[resp.data.length - 1].id : undefined;
  } while (startingAfter);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
