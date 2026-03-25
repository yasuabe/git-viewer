import type { CommitFileChange } from "../types/repository";
import type { WipFile } from "../types/git";

export type SelectedFile =
  | {
      kind: "commit";
      commitHash: string;
      path: string;
      status: CommitFileChange["status"];
    }
  | {
      kind: "staged" | "unstaged";
      path: string;
      status: WipFile["status"];
    };
