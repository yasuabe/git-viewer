import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import type { CommitNode, Ref, WipFile, WipState } from "../../../src/types/git";
import type { BranchData, BranchKind, BranchRecord, RepositorySnapshot } from "../../../src/types/repository";

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
  const normalizedPath = path.resolve(repositoryPath);
  const git = simpleGit(normalizedPath);
  const isRepo = await git.checkIsRepo();

  if (!isRepo) {
    throw new RepositoryLoadError(`${normalizedPath} is not a Git repository.`);
  }

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
    const file = {
      path: normalizeStatusPath(rawPath),
      status: normalizeStatusCode(x !== " " ? x : y),
    } satisfies WipFile;

    if (x !== " " && x !== "?") {
      staged.push(file);
    }

    if (y !== " " || x === "?") {
      unstaged.push(file);
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
