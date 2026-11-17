#!/usr/bin/env node
// Prompts for the Neon DATABASE_URL (input hidden) and writes it into .env.
// Usage: npm run env:db
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stdin, stdout } from "node:process";

const ENV = ".env";

function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003") process.exit(130); // Ctrl-C
        if (ch === "\u007f") value = value.slice(0, -1); // Backspace
        else value += ch;
      }
      stdout.write(`\r${question}${"*".repeat(Math.min(value.length, 40))}  `);
    };
    stdin.on("data", onData);
  });
}

const url = await askHidden("Paste your Neon DATABASE_URL, then press Enter: ");

try {
  const u = new URL(url);
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error("must start with postgresql://");
} catch (e) {
  console.error(`Not a valid Postgres URL (${e.message}). Nothing written.`);
  process.exit(1);
}

let text = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = `DATABASE_URL=${url}`;
text = /^DATABASE_URL=.*$/m.test(text) ? text.replace(/^DATABASE_URL=.*$/m, line) : `${text}\n${line}\n`;
writeFileSync(ENV, text, { mode: 0o600 });
console.log("Saved DATABASE_URL to .env. Go back to Claude and say it's done.");
