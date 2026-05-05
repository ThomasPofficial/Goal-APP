import { createHash } from "crypto";
import { execSync } from "child_process";

// Compute bcrypt hash using Node built-ins isn't possible, so we use a one-liner
const email = "thomaspiacentine6@gmail.com";
const password = "Thom@6!!!!";

// Use psql to do everything in one shot via a plpgsql block
const DB = "postgresql://nivarro_database_user:QpoCIP5Na6ifU8ZUBUYRv23EZhpGsx9Y@dpg-d7n7k39j2pic738k9jng-a.ohio-postgres.render.com/nivarro_database";

// Hash using bcryptjs via node -e
const hash = execSync(
  `node -e "const b=require('./node_modules/bcryptjs');b.hash('${password}',12).then(h=>process.stdout.write(h))"`,
  { encoding: "utf8" }
);

console.log("Hash computed:", hash.slice(0, 20) + "...");

// Use psql to update
const sql = `UPDATE "User" SET "passwordHash"='${hash}' WHERE email='${email}';`;
const cmd = `PGPASSWORD=QpoCIP5Na6ifU8ZUBUYRv23EZhpGsx9Y psql -h dpg-d7n7k39j2pic738k9jng-a.ohio-postgres.render.com -U nivarro_database_user -d nivarro_database -c "${sql}"`;

try {
  const result = execSync(cmd, { encoding: "utf8" });
  console.log("Result:", result);
} catch (e) {
  console.error("psql error:", e.message);
}
