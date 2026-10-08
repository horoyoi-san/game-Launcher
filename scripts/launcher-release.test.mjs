import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLauncherManifest, nextLauncherVersion } from "./launcher-release.mjs";

test("increments patch digits and rolls over minor and major digits", () => {
  assert.equal(nextLauncherVersion("1.0.0"), "1.0.1");
  assert.equal(nextLauncherVersion("1.0.8"), "1.0.9");
  assert.equal(nextLauncherVersion("1.0.9"), "1.1.0");
  assert.equal(nextLauncherVersion("1.1.0"), "1.1.1");
  assert.equal(nextLauncherVersion("1.1.9"), "1.2.0");
  assert.equal(nextLauncherVersion("1.9.9"), "2.0.0");
});

test("rejects versions outside the three-number sequence", () => {
  assert.throws(() => nextLauncherVersion("1.0"), /Invalid launcher version/);
  assert.throws(() => nextLauncherVersion("1.0.01"), /Invalid launcher version/);
});

test("creates a manifest with the executable SHA-256", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "launcher-manifest-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executablePath = join(directory, "launcher.exe");
  const executable = Buffer.from("test executable");
  await writeFile(executablePath, executable);

  const manifest = await createLauncherManifest("1.0.1", executablePath);
  assert.deepEqual(manifest, {
    version: "1.0.1",
    sha256: createHash("sha256").update(executable).digest("hex"),
  });
});
