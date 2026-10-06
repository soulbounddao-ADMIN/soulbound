import { runReapPersonaClipsCli } from "./reap-persona-clips-cli";

declare const process: {
  exit(code: number): never;
};

declare const console: {
  error(line: string): void;
};

runReapPersonaClipsCli().then(
  () => process.exit(0),
  (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`persona-clip reap failed: ${message}`);
    process.exit(1);
  },
);
