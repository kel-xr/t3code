import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const run = (command, args) =>
  NodeChildProcess.execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
const git = (...args) => run("git", args);
const api = async (path) => {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
      "User-Agent": "t3code-fork-release",
      Accept: "application/vnd.github+json",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status}`);
  return response.json();
};
const output = (values) => {
  for (const [key, value] of Object.entries(values)) {
    if (process.env.GITHUB_OUTPUT)
      NodeFS.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(JSON.stringify(values));
};

if (process.argv[2] === "check") {
  const release = await api("repos/pingdotgg/t3code/releases/latest");
  if (!release || release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name))
    throw new Error("No valid stable upstream release");
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || repository === "pingdotgg/t3code")
    throw new Error("Expected a fork repository");
  const own = await api(`repos/${repository}/releases/tags/${release.tag_name}`);
  const base = git("rev-parse", "HEAD");
  const failures = await api(`repos/${repository}/actions/artifacts?per_page=100`);
  const blocked =
    process.env.RETRY_FAILED !== "true" &&
    failures?.artifacts.some(
      (artifact) => !artifact.expired && artifact.name === `failed-${release.tag_name}-${base}`,
    );
  output({
    ready: process.env.VALIDATE_ONLY === "true" || ((!own || own.draft) && !blocked),
    tag: release.tag_name,
    version: release.tag_name.slice(1),
    base,
  });
  if (blocked)
    console.log(
      "This candidate failed previously. Review the failed run and retry manually from Actions.",
    );
} else if (process.argv[2] === "integrate") {
  const tag = process.argv[3];
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) throw new Error("Invalid stable tag");
  const workflows = ".github/workflows";
  const saved = NodeFS.readdirSync(workflows).map((name) => [
    name,
    NodeFS.readFileSync(NodePath.join(workflows, name)),
  ]);
  const readme = NodeFS.readFileSync("README.md");
  git("fetch", "--no-tags", "https://github.com/pingdotgg/t3code.git", `refs/tags/${tag}`);
  if (git("status", "--porcelain")) throw new Error("Integration requires a clean checkout");
  // Only fork-owned workflow and README conflicts are resolved automatically.
  try {
    git("merge", "--no-commit", "--no-ff", "FETCH_HEAD");
  } catch (error) {
    const conflicts = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
    if (
      !conflicts.length ||
      conflicts.some((path) => path !== "README.md" && !path.startsWith(".github/workflows/"))
    )
      throw error;
  }
  for (const name of NodeFS.readdirSync(workflows)) NodeFS.rmSync(NodePath.join(workflows, name));
  for (const [name, data] of saved) NodeFS.writeFileSync(NodePath.join(workflows, name), data);
  NodeFS.writeFileSync("README.md", readme);
  git("add", "README.md", workflows);
  run(process.execPath, ["scripts/update-release-package-versions.ts", tag.slice(1)]);
  git("add", "-u");
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  let merging = false;
  try {
    git("rev-parse", "--verify", "MERGE_HEAD");
    merging = true;
  } catch {}
  if (git("status", "--porcelain") || merging)
    git("commit", "-m", `chore: integrate upstream ${tag}`);
  output({ commit: git("rev-parse", "HEAD") });
} else {
  throw new Error("Expected check or integrate");
}
