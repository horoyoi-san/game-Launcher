import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLauncherManifest, nextLauncherVersion } from "./launcher-release.mjs";

test("increments patch digits and rolls over minor and major digits", () => {
  assert.equal(nextLauncherVersion("2.1.0"), "2.1.1");
  assert.equal(nextLauncherVersion("2.1.9"), "2.2.0");
  assert.equal(nextLauncherVersion("2.9.9"), "3.0.0");
});

test("rejects versions outside the three-number sequence", () => {
  assert.throws(() => nextLauncherVersion("2.1"), /Invalid launcher version/);
  assert.throws(() => nextLauncherVersion("02.1.0"), /Invalid launcher version/);
});

test("creates a manifest with the executable SHA-256", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cyrene-release-test-"));
  const executablePath = join(directory, "launcher.exe");

  try {
    await writeFile(executablePath, "test executable");
    const manifest = await createLauncherManifest("2.1.1", executablePath);
    assert.equal(manifest.version, "2.1.1");
    assert.equal(
      manifest.sha256,
      "ff8715f0270731bbdb0bb3586a77d032f5e883b8909dcafbf3e8909cb8c71201",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
