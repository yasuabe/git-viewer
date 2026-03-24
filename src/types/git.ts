export type RefType = "branch" | "tag" | "head";

export type Ref = {
  name: string;
  type: RefType;
};

export type CommitNode = {
  hash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: Ref[];
};

export type ParentLink = {
  parentHash: string;
  fromLane: number;
  toLane: number;
  color: string;
  type: "straight" | "merge";
};

export type LaneEntry = {
  hash: string;
  lane: number;
  color: string;
  parentLinks: ParentLink[];
};

export type SelectedCommit = { type: "commit"; hash: string } | { type: "wip" };
