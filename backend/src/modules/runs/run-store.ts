import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../../lib/errors.js";
import type { CollectionRunState } from "../collection/collection.types.js";

const currentFilePath = fileURLToPath(import.meta.url);
const runsDirectory = resolve(dirname(currentFilePath), "../../../data/runs");

export class RunStore {
  private getFilePath(runId: string) {
    return resolve(runsDirectory, `${runId}.json`);
  }

  private async ensureDirectory() {
    await mkdir(runsDirectory, { recursive: true });
  }

  async save(run: CollectionRunState) {
    await this.ensureDirectory();
    await writeFile(
      this.getFilePath(run.runId),
      JSON.stringify(run, null, 2),
      "utf8",
    );
  }

  async get(runId: string) {
    try {
      const content = await readFile(this.getFilePath(runId), "utf8");
      return JSON.parse(content) as CollectionRunState;
    } catch (error) {
      throw new AppError(
        `Execucao ${runId} nao encontrada.`,
        404,
        "RUN_NOT_FOUND",
      );
    }
  }
}

export const runStore = new RunStore();
