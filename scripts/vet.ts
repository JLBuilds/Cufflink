// Stylist vetting for the whole wardrobe (pairs not yet vetted only):
//   npx tsx scripts/vet.ts --email me@example.com
import { loadStyleContext } from "../src/lib/data";
import { vetAll } from "../src/lib/pipeline/vet";
import { adminClient, arg, userIdFor } from "./env";

async function main() {
  const email = arg("email");
  if (!email) throw new Error("Usage: npx tsx scripts/vet.ts --email <email>");
  const sb = adminClient();
  const userId = await userIdFor(sb, email);
  const sc = await loadStyleContext(sb, userId);
  if (!sc) throw new Error("No active style profile.");
  const n = await vetAll(sb, userId, sc, (s) => console.log(s));
  console.log(`${n} pairs vetted.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
