import { Db, WithId } from "mongodb";

/**
 * A record of every sync we run, so the admin screen can answer the question
 * the data alone can't: did the job run and find nothing, or did it never run?
 * Both the admin buttons and the external cron endpoints write here.
 */

export type SyncJob = "episodes" | "episode-tracks";
export type SyncRunTrigger = "admin" | "api";
export type SyncRunStatus = "running" | "success" | "error";

export type EpisodesSyncSummary = {
  kind: "episodes";
  insertedCount: number;
  insertedNames: string[];
  byCollective: { collectiveSlug: string; insertedCount: number }[];
};

export type EpisodeTracksSyncSummary = {
  kind: "episode-tracks";
  /** How many episodes this run actually attempted (the batch, not the backlog). */
  episodesConsidered: number;
  episodesUpdated: number;
  tracksImported: number;
  /** Still missing after this run — what's left for the next batch. */
  remaining: number;
  skipped: { episodeName: string; reason: string }[];
};

export type SyncRunSummary = EpisodesSyncSummary | EpisodeTracksSyncSummary;

export type DBSyncRun = {
  job: SyncJob;
  trigger: SyncRunTrigger;
  status: SyncRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  summary?: SyncRunSummary;
  error?: string;
};

const SYNC_RUNS_COLLECTION = "syncRuns";

export type SyncRunProjection = ReturnType<typeof syncRunProjection>;
export function syncRunProjection(run: WithId<DBSyncRun>) {
  return {
    id: run._id.toString(),
    job: run.job,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    durationMs: run.durationMs ?? null,
    summary: run.summary ?? null,
    error: run.error ?? null,
  } as const;
}

/**
 * Marks the run as started before doing the work, so a job that dies mid-run —
 * a serverless timeout, most likely — leaves a `running` record behind rather
 * than no trace at all.
 */
export async function recordSyncRun<T extends SyncRunSummary>(
  db: Db,
  job: SyncJob,
  trigger: SyncRunTrigger,
  run: () => Promise<T>,
): Promise<T> {
  const collection = db.collection<DBSyncRun>(SYNC_RUNS_COLLECTION);
  const startedAt = new Date();
  const { insertedId } = await collection.insertOne({
    job,
    trigger,
    status: "running",
    startedAt,
  });

  try {
    const summary = await run();
    const finishedAt = new Date();
    await collection.updateOne(
      { _id: insertedId },
      {
        $set: {
          status: "success",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          summary,
        },
      },
    );
    return summary;
  } catch (err: any) {
    const finishedAt = new Date();
    await collection.updateOne(
      { _id: insertedId },
      {
        $set: {
          status: "error",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: err?.message ?? String(err),
        },
      },
    );
    throw err;
  }
}

export async function getRecentSyncRuns(db: Db, limit = 20) {
  const runs = await db
    .collection<DBSyncRun>(SYNC_RUNS_COLLECTION)
    .find({})
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();

  return runs.map(syncRunProjection);
}

export async function getLastSyncRun(db: Db, job: SyncJob) {
  const run = await db
    .collection<DBSyncRun>(SYNC_RUNS_COLLECTION)
    .findOne({ job }, { sort: { startedAt: -1 } });

  return run ? syncRunProjection(run) : null;
}
