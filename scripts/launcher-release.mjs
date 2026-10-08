import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function nextLauncherVersion(currentVersion) {
  const match = currentVersion.match(versionPattern);
  if (!match) {
    throw new Error(`Invalid launcher version: ${currentVersion}`);
  }

  let [major, minor, patch] = match.slice(1).map(Number);
  patch += 1;
  if (patch === 10) {
    patch = 0;
    minor += 1;
    if (minor === 10) {
      minor = 0;
      major += 1;
    }
  }

  return `${major}.${minor}.${patch}`;
}

export async function createLauncherManifest(version, executablePath) {
  if (!versionPattern.test(version)) {
    throw new Error(`Invalid launcher version: ${version}`);
  }
  const executable = await readFile(executablePath);
  return {
    version,
    sha256: createHash("sha256").update(executable).digest("hex"),
  };
}

async function main(args) {
  const [command, ...values] = args;
  if (command === "next" && values.length === 1) {
    console.log(nextLauncherVersion(values[0]));
    return;
  }

  if (command === "manifest" && values.length === 3) {
    const [version, executablePath, manifestPath] = values;
    const manifest = await createLauncherManifest(version, executablePath);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  if (command === "stamp-info" && values.length === 2) {
    const [version, infoPath] = values;
    if (!versionPattern.test(version)) {
      throw new Error(`Invalid launcher version: ${version}`);
    }
    const info = JSON.parse(await readFile(infoPath, "utf8"));
    info.fixed.file_version = version;
    info.info["0000"].ProductVersion = version;
    await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`);
    return;
  }

  throw new Error(
    "Usage: launcher-release.mjs next <version> | manifest <version> <exe> <output> | stamp-info <version> <info.json>",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
