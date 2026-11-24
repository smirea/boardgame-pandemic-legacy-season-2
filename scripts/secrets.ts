#!/usr/bin/env bun
/**
 * Hands env-manager prod's secrets to where the deployed site reads them. Logs names, never values.
 *
 *   ./scripts/secrets.ts push     SIGNAL_SECRET and the TURN key to the production Worker
 *   ./scripts/secrets.ts github   the Cloudflare credentials CI deploys with, as repository secrets
 *
 * Both read env-manager, which needs this Mac's AWS access.
 */
import { spawnSync } from "node:child_process";

const PROJECT = "boardgame-pandemic-legacy-season-2";
const REPO = "smirea/boardgame-pandemic-legacy-season-2";
const WORKER_SECRETS = ["SIGNAL_SECRET", "TURN_KEY_ID", "TURN_KEY_API_TOKEN"] as const;
const CLOUDFLARE = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"] as const;

type Values = Record<string, string>;

function run(command: string[], options: { stdin?: string; env?: Values } = {}): string {
  const result = spawnSync(command[0]!, command.slice(1), {
    input: options.stdin,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, ...options.env },
    cwd: new URL("../apps/signal/", import.meta.url).pathname,
  });
  if (result.status !== 0) throw new Error(`${command.slice(0, 3).join(" ")} failed`);
  return result.stdout ?? "";
}

function prod(names: readonly string[]): Values {
  const printed = run(["env-manager", "print", PROJECT, "-e", "prod"]);
  const section = /^\.env\.local$([\s\S]*?)(?:^files$|(?![\s\S]))/m.exec(printed)?.[1] ?? "";
  const values: Values = {};
  for (const line of section.split("\n")) {
    const match = /^([A-Z_][A-Z0-9_]*)='?([^'#\s]*)'?/.exec(line.trim());
    if (match?.[2]) values[match[1]!] = match[2];
  }
  const missing = names.filter((name) => !values[name]);
  if (missing.length) throw new Error(`Not set in env-manager prod: ${missing.join(", ")}`);
  return Object.fromEntries(names.map((name) => [name, values[name]!]));
}

const command = process.argv[2];
if (command === "push") {
  const values = prod([...WORKER_SECRETS, ...CLOUDFLARE]);
  const secrets = Object.fromEntries(WORKER_SECRETS.map((name) => [name, values[name]!]));
  run(["bunx", "wrangler", "secret", "bulk", "--env", "production"], {
    stdin: JSON.stringify(secrets),
    env: Object.fromEntries(CLOUDFLARE.map((name) => [name, values[name]!])),
  });
  console.log(`Pushed to the Worker: ${WORKER_SECRETS.join(", ")}`);
} else if (command === "github") {
  for (const [name, value] of Object.entries(prod(CLOUDFLARE))) {
    run(["gh", "secret", "set", name, "--repo", REPO], { stdin: value });
    console.log(`Set GitHub secret ${name}`);
  }
} else {
  throw new Error("usage: ./scripts/secrets.ts push|github");
}
