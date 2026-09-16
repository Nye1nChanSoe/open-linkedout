import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

import pc from "picocolors";

import config from "@/config/embedding.config.js";

/**
 * Downloads the embedding model into `models/`, verified by SHA-256.
 * Files already present with the right digest are skipped, so a rerun
 * resumes an interrupted install.
 */
for (const file of config.MODEL_FILES) {
  const destination = join(config.MODEL_DIR_PATH, file.localName);

  if (await isInstalled(destination, file.size, file.sha256)) {
    console.info(pc.dim("present"), file.localName);
    continue;
  }

  const url =
    `https://huggingface.co/${config.MODEL_REPOSITORY}/resolve/` +
    `${config.MODEL_REVISION}/${file.remotePath}`;

  console.info(pc.blueBright("downloading"), file.localName);
  await download(url, destination, file.sha256);
}

console.info(
  pc.green("Embedding model installed:"),
  pc.cyan(config.MODEL_REPOSITORY),
  pc.dim(`@ ${config.MODEL_REVISION.slice(0, 12)}`),
);

async function isInstalled(path: string, size: number, sha256: string) {
  const found = await stat(path).catch(() => undefined);

  return found?.size === size && (await digest(path)) === sha256;
}

/** Writes to a temporary file and moves it into place only once the digest matches. */
async function download(url: string, destination: string, sha256: string) {
  const staging = `${destination}.part`;

  await mkdir(dirname(destination), { recursive: true });

  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as ReadableStream),
    createWriteStream(staging),
  );

  const found = await digest(staging);

  if (found !== sha256) {
    await unlink(staging);
    throw new Error(
      `Checksum mismatch for ${url}: expected ${sha256}, got ${found}`,
    );
  }

  await rename(staging, destination);
}

async function digest(path: string): Promise<string> {
  const hash = createHash("sha256");

  await pipeline(createReadStream(path), hash);

  return hash.digest("hex");
}
