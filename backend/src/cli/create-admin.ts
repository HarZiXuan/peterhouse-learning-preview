// First sign-in for a new server: `npm run create-admin -w backend -- you@school.sg "Your Name"`.
// The password is read from ADMIN_PASSWORD or typed at the prompt, and must be changed at first sign-in.
import readline from "node:readline/promises";
import { pool } from "../db";
import { migrate } from "../migrate";
import { createUser } from "../domain/users";
import { workspace } from "../domain/workspace";

const [email, name = "Administrator"] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run create-admin -w backend -- <email> ["Full name"]');
  process.exit(1);
}
try {
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Temporary password (10+ characters): ");
    rl.close();
  }
  await migrate(pool, () => {});
  await workspace();
  const id = await createUser(null, null, { email, name, role: "admin", password });
  console.log(`Created administrator #${id}. They must choose a new password when they first sign in.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
