import path from "node:path";
import { readFile } from "node:fs/promises";
import simpleGit, { type SimpleGit } from "simple-git";
import type { DiffViewData } from "../../../src/types/diff";
import type { CommitNode, Ref, WipFile, WipState } from "../../../src/types/git";
import type {
  BranchData,
  BranchKind,
  BranchRecord,
  CommitFileChange,
  RepositorySnapshot,
  WipDiffKind,
} from "../../../src/types/repository";

const FIELD_SEPARATOR = "\x1f";
const RECORD_SEPARATOR = "\x1e";
const LOG_FORMAT = `%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e`;
const REF_FIELD_SEPARATOR = "\t";
const REF_FORMAT = `%(objectname)\t%(refname)\t%(refname:short)\t%(HEAD)`;

export class RepositoryLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryLoadError";
  }
}

export async function loadRepositorySnapshot(repositoryPath: string): Promise<RepositorySnapshot> {
  const { git, normalizedPath } = await openRepository(repositoryPath);

  const [branchData, wip, hasHeadCommit] = await Promise.all([
    loadBranchData(git),
    loadWipState(git),
    checkHasHeadCommit(git),
  ]);
  const commits = hasHeadCommit ? await loadCommits(git, branchData.refs) : [];

  return {
    repositoryPath: normalizedPath,
    branchData,
    commits,
    wip,
  };
}

export async function loadCommitFiles(repositoryPath: string, commitHash: string): Promise<CommitFileChange[]> {
  const { git } = await openRepository(repositoryPath);
  const output = await git.raw([
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "-r",
    "--root",
    "--find-renames",
    commitHash,
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseNameStatusLine)
    .filter((entry): entry is CommitFileChange => entry !== null);
}

export async function loadCommitDiff(
  repositoryPath: string,
  commitHash: string,
  filePath: string,
): Promise<DiffViewData> {
  const { git } = await openRepository(repositoryPath);
  const raw = await git.raw([
    "show",
    "--format=",
    "--find-renames",
    "--no-ext-diff",
    commitHash,
    "--",
    filePath,
  ]);

  return { raw };
}

export async function loadWipDiff(
  repositoryPath: string,
  kind: WipDiffKind,
  filePath: string,
  status: WipFile["status"],
): Promise<DiffViewData> {
  const { git, normalizedPath } = await openRepository(repositoryPath);

  if (kind === "unstaged" && status === "A") {
    return renderUntrackedFileDiff(normalizedPath, filePath);
  }

  const raw = await git.raw([
    "diff",
    kind === "staged" ? "--cached" : undefined,
    "--find-renames",
    "--no-ext-diff",
    "--",
    filePath,
  ].filter((arg): arg is string => Boolean(arg)));

  return { raw };
}

async function openRepository(repositoryPath: string): Promise<{ git: SimpleGit; normalizedPath: string }> {
  const normalizedPath = path.resolve(repositoryPath);
  const git = simpleGit(normalizedPath);
  const isRepo = await git.checkIsRepo();

  if (!isRepo) {
    throw new RepositoryLoadError(`${normalizedPath} is not a Git repository.`);
  }

  return {
    git,
    normalizedPath,
  };
}

async function checkHasHeadCommit(git: SimpleGit): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function loadCommits(git: SimpleGit, refs: BranchRecord[]): Promise<CommitNode[]> {
  const output = await git.raw([
    "log",
    "--topo-order",
    "--date-order",
    `--format=${LOG_FORMAT}`,
  ]);
  const refsByHash = buildRefsByHash(refs);

  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash, parentsField, author, date, message] = record.split(FIELD_SEPARATOR);

      return {
        hash,
        parents: parentsField ? parentsField.split(" ").filter(Boolean) : [],
        author,
        date,
        message,
        refs: refsByHash.get(hash) ?? [],
      };
    });
}

function buildRefsByHash(refs: BranchRecord[]): Map<string, Ref[]> {
  const refsByHash = new Map<string, Ref[]>();

  for (const ref of refs) {
    const nextRefs = refsByHash.get(ref.targetHash) ?? [];
    nextRefs.push({
      name: ref.name,
      type: ref.kind === "tag" ? "tag" : "branch",
    });

    if (ref.isHead) {
      nextRefs.unshift({
        name: "HEAD",
        type: "head",
      });
    }

    refsByHash.set(ref.targetHash, nextRefs);
  }

  return refsByHash;
}

async function loadBranchData(git: SimpleGit): Promise<BranchData> {
  const output = await git.raw([
    "for-each-ref",
    `--format=${REF_FORMAT}`,
    "refs/heads",
    "refs/remotes",
    "refs/tags",
  ]);
  const refs = output
    .split("\n")
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [targetHash, fullName, name, headMarker] = record.split(REF_FIELD_SEPARATOR);
      return {
        name,
        fullName,
        kind: parseBranchKind(fullName),
        targetHash,
        isHead: headMarker === "*",
      } satisfies BranchRecord;
    });

  return {
    refs,
  };
}

function parseBranchKind(fullName: string): BranchKind {
  if (fullName.startsWith("refs/heads/")) {
    return "local";
  }

  if (fullName.startsWith("refs/remotes/")) {
    return "remote";
  }

  return "tag";
}

async function loadWipState(git: SimpleGit): Promise<WipState> {
  const output = await git.raw(["status", "--porcelain=v1", "--untracked-files=all"]);
  const staged: WipFile[] = [];
  const unstaged: WipFile[] = [];

  for (const line of output.split("\n")) {
    if (!line || line.startsWith("!!")) {
      continue;
    }

    const x = line[0];
    const y = line[1];
    const rawPath = line.slice(3).trim();
    const normalizedPath = normalizeStatusPath(rawPath);

    if (x !== " " && x !== "?") {
      staged.push({
        path: normalizedPath,
        status: normalizeStatusCode(x),
      });
    }

    if (y !== " ") {
      unstaged.push({
        path: normalizedPath,
        status: normalizeStatusCode(y),
      });
    } else if (x === "?") {
      unstaged.push({
        path: normalizedPath,
        status: "A",
      });
    }
  }

  return {
    staged,
    unstaged,
  };
}

function normalizeStatusPath(rawPath: string): string {
  const renameMarkerIndex = rawPath.lastIndexOf(" -> ");
  return renameMarkerIndex >= 0 ? rawPath.slice(renameMarkerIndex + 4) : rawPath;
}

function normalizeStatusCode(code: string): WipFile["status"] {
  switch (code) {
    case "A":
    case "?":
      return "A";
    case "D":
      return "D";
    case "R":
    case "C":
      return "R";
    default:
      return "M";
  }
}

function parseNameStatusLine(line: string): CommitFileChange | null {
  const [rawStatus, ...paths] = line.split(REF_FIELD_SEPARATOR);
  const nextPath = paths.at(-1)?.trim();

  if (!rawStatus || !nextPath) {
    return null;
  }

  return {
    path: nextPath,
    status: normalizeStatusCode(rawStatus[0]),
  };
}

async function renderUntrackedFileDiff(repositoryPath: string, filePath: string): Promise<DiffViewData> {
  const absolutePath = path.join(repositoryPath, filePath);
  const source = await readFile(absolutePath, "utf8");
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const lines = normalizedSource.length > 0 ? normalizedSource.split("\n") : [];

  if (normalizedSource.endsWith("\n")) {
    lines.pop();
  }

  const contentLines = lines.length > 0 ? lines.map((line) => `+${line}`).join("\n") : "+";
  const lineCount = Math.max(lines.length, 1);

  return {
    raw: `diff --git a/${filePath} b/${filePath}
new file mode 100644
--- /dev/null
+++ b/${filePath}
@@ -0,0 +1,${lineCount} @@
${contentLines}
`,
  };
}
