import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeHttp from "node:http";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeModule from "node:module";

const requireDesktop = NodeModule.createRequire(NodePath.resolve("apps/desktop/package.json"));
const { _electron: electron } = requireDesktop("playwright-core");
const yaml = NodeModule.createRequire(NodePath.resolve("packages/shared/package.json"))("yaml");
const [oldDirectory, releaseDirectory, testRoot, version, repository] = process.argv.slice(2);
// eslint-disable-next-line t3code/no-global-process-runtime -- Standalone Windows installer acceptance gate.
if (!testRoot || !version || !repository || process.platform !== "win32")
  throw new Error("Expected old-dir release-dir isolated-test-root version owner/repo on Windows");
const oldInstaller = NodeFS.readdirSync(oldDirectory).find((name) => name.endsWith(".exe"));
NodeAssert.ok(oldInstaller);
NodeFS.mkdirSync(testRoot, { recursive: true });
const installDirectory = NodePath.join(NodePath.resolve(testRoot), "installed");
const execute = (file, args) =>
  new Promise((resolveResult, reject) => {
    const child = NodeChildProcess.spawn(file, args, { windowsHide: true, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolveResult() : reject(new Error(`${NodePath.basename(file)} exited ${code}`)),
    );
  });
await execute(NodePath.join(NodePath.resolve(oldDirectory), oldInstaller), [
  "/S",
  `/D=${installDirectory}`,
]);
const executable = NodeFS.readdirSync(installDirectory).find(
  (name) => name.endsWith(".exe") && !name.startsWith("Uninstall"),
);
NodeAssert.ok(executable, "Installed executable missing");
const feed = yaml.parse(
  NodeFS.readFileSync(NodePath.join(installDirectory, "resources", "app-update.yml"), "utf8"),
);
NodeAssert.equal(`${feed.owner}/${feed.repo}`, repository);
NodeAssert.equal(feed.provider, "github");
const server = NodeHttp.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, "http://localhost").pathname).slice(1);
  if (name !== NodePath.basename(name) || !/\.(yml|exe|blockmap)$/.test(name)) {
    response.writeHead(404).end();
    return;
  }
  const file = NodePath.join(NodePath.resolve(releaseDirectory), name);
  if (!NodeFS.existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  const size = NodeFS.statSync(file).size;
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
  const start = range ? Number(range[1]) : 0;
  const end = range?.[2] ? Number(range[2]) : size - 1;
  if (start >= size || end >= size || end < start) {
    response.writeHead(416).end();
    return;
  }
  response.writeHead(range ? 206 : 200, {
    "Content-Length": end - start + 1,
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  NodeFS.createReadStream(file, { start, end }).pipe(response);
});
await new Promise((resolveResult) => server.listen(0, "localhost", resolveResult));
let application;
try {
  application = await electron.launch({
    executablePath: NodePath.join(installDirectory, executable),
    env: {
      ...process.env,
      APPDATA: NodePath.join(NodePath.resolve(testRoot), "appdata"),
      LOCALAPPDATA: NodePath.join(NodePath.resolve(testRoot), "localappdata"),
      T3CODE_HOME: NodePath.join(NodePath.resolve(testRoot), "state"),
      T3CODE_DESKTOP_MOCK_UPDATES: "true",
      T3CODE_DESKTOP_MOCK_UPDATE_SERVER_PORT: String(server.address().port),
    },
    timeout: 120_000,
  });
  const window = await application.firstWindow({ timeout: 120_000 });
  await window.waitForFunction(() => Boolean(window.desktopBridge?.checkForUpdate), null, {
    timeout: 120_000,
  });
  const initial = await window.evaluate(() => window.desktopBridge.getUpdateState());
  NodeAssert.equal(initial.enabled, true);
  NodeAssert.notEqual(initial.currentVersion, version);
  await window.evaluate(() => window.desktopBridge.checkForUpdate());
  await window.waitForFunction(
    async (expected) => (await window.desktopBridge.getUpdateState()).availableVersion === expected,
    version,
    { timeout: 120_000 },
  );
  const available = await window.evaluate(() => window.desktopBridge.getUpdateState());
  NodeAssert.equal(available.status, "available");
  await window.evaluate(() => window.desktopBridge.downloadUpdate());
  await window.waitForFunction(
    async (expected) =>
      (await window.desktopBridge.getUpdateState()).downloadedVersion === expected,
    version,
    { timeout: 180_000 },
  );
  const downloaded = await window.evaluate(() => window.desktopBridge.getUpdateState());
  NodeAssert.equal(downloaded.status, "downloaded");
  console.log(
    JSON.stringify({
      installedVersion: initial.currentVersion,
      updateVersion: downloaded.downloadedVersion,
      repository,
      nativeDownloadVerified: true,
    }),
  );
  await application.close();
  application = undefined;
  const releaseInstaller = NodeFS.readdirSync(releaseDirectory).find((name) =>
    name.endsWith(".exe"),
  );
  NodeAssert.ok(releaseInstaller);
  await execute(NodePath.join(NodePath.resolve(releaseDirectory), releaseInstaller), [
    "/S",
    `/D=${installDirectory}`,
  ]);
  application = await electron.launch({
    executablePath: NodePath.join(installDirectory, executable),
    env: {
      ...process.env,
      APPDATA: NodePath.join(NodePath.resolve(testRoot), "appdata"),
      LOCALAPPDATA: NodePath.join(NodePath.resolve(testRoot), "localappdata"),
      T3CODE_HOME: NodePath.join(NodePath.resolve(testRoot), "state"),
    },
    timeout: 120_000,
  });
  const upgraded = await application.evaluate(({ app }) => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));
  NodeAssert.equal(upgraded.version, version);
  NodeAssert.equal(upgraded.packaged, true);
  console.log(
    JSON.stringify({ upgradedVersion: upgraded.version, silentInstallerUpgradeVerified: true }),
  );
} finally {
  if (application) await application.close();
  await new Promise((resolveResult) => server.close(resolveResult));
  const uninstaller = NodeFS.readdirSync(installDirectory).find(
    (name) => name.startsWith("Uninstall") && name.endsWith(".exe"),
  );
  NodeAssert.ok(uninstaller);
  await execute(NodePath.join(installDirectory, uninstaller), ["/S"]);
}
