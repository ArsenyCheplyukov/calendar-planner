import { parsePlanCandidates } from "../infrastructure/gemini/parser.js";

const text = process.argv[2] ?? "поставь созвон с клиентом после 4 на час сегодня";
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Set GEMINI_API_KEY env var");
  process.exit(1);
}

const candidates = await parsePlanCandidates(text, {
  apiKey,
  referenceDate: new Date(),
  timeZone: process.env.TZ ?? "Europe/Moscow",
});

console.log(`Plan: "${text}"`);
console.log(`Candidates: ${candidates.length}\n`);

for (const [i, c] of candidates.entries()) {
  console.log(`#${i + 1}: ${c.title}`);
  console.log(`  duration: ${c.durationMinutes}m`);
  console.log(`  type: ${c.type}`);
  console.log(`  hint: ${JSON.stringify(c.hint)}`);
  console.log(`  deadline: ${c.deadline}`);
  console.log();
}
