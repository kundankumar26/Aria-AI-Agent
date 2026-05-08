import readline from "readline";
import "dotenv/config";
import { runAgent } from "./agent.js";

// ── Terminal interface ─────────────────────────────────
const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout
});

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function printBanner() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log(  "║     🔬 Aria — Research Assistant       ║");
  console.log(  "║     Type a topic to research           ║");
  console.log(  "║     Type 'exit' to quit                ║");
  console.log(  "╚════════════════════════════════════════╝\n");
}

// ── Main loop ──────────────────────────────────────────
async function main() {
  printBanner();

  while (true) {
    const input = await ask("You: ");

    if (!input.trim()) continue;
    if (input.toLowerCase() === "exit") {
      console.log("\n👋 Goodbye!\n");
      rl.close();
      break;
    }

    try {
      const startTime = Date.now();
      const answer    = await runAgent(input);
      const elapsed   = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log("\n" + "─".repeat(50));
      console.log(answer);
      console.log("─".repeat(50));
      console.log(`\n⏱  Completed in ${elapsed}s\n`);

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
  }
}

main();