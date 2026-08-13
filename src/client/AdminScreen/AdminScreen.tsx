import { ReactNode, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/utils/trpc";
import type { SyncRunProjection, SyncRunSummary } from "@/server/sync-runs";

const COLLECTIVE_LABELS: Record<string, string> = {
  soulection: "Soulection Radio",
  "sasha-marie-radio": "Sasha Marie Radio",
  "the-love-below-hour": "The Love Below Hour",
  local: "Local",
};

function collectiveLabel(slug: string) {
  return COLLECTIVE_LABELS[slug] ?? slug;
}

function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function summaryLine(summary: SyncRunSummary) {
  if (summary.kind === "episodes") {
    return summary.insertedCount === 0
      ? "No new episodes"
      : `${summary.insertedCount} new ${summary.insertedCount === 1 ? "episode" : "episodes"}`;
  }

  if (summary.episodesConsidered === 0) return "Nothing to sync";

  const parts = [
    `${summary.episodesUpdated} of ${summary.episodesConsidered} episodes`,
    `${summary.tracksImported} tracks`,
  ];
  if (summary.skipped.length > 0) {
    parts.push(`${summary.skipped.length} skipped`);
  }
  return parts.join(" · ");
}

function runSummaryLine(run: SyncRunProjection) {
  if (run.status === "error") return run.error ?? "Failed";
  // A run left as `running` almost always means the request was cut off
  // partway — a timeout — rather than something still going.
  if (run.status === "running") return "Started, never finished";

  return run.summary ? summaryLine(run.summary) : "—";
}

function StatusDot({ status }: { status: SyncRunProjection["status"] }) {
  const color =
    status === "success"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-amber-500";
  return (
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200">
      <h2 className="border-b border-gray-200 px-4 py-3 font-bold">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LastRun({ run }: { run: SyncRunProjection | null }) {
  if (!run) {
    return <p className="text-sm text-gray-500">Never run.</p>;
  }
  return (
    <p className="flex items-center gap-2 text-sm text-gray-600">
      <StatusDot status={run.status} />
      <span>
        {timeAgo(run.startedAt)} · {run.trigger === "admin" ? "manual" : "cron"}{" "}
        · {runSummaryLine(run)}
      </span>
    </p>
  );
}

function RunButton({
  onClick,
  pending,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
    >
      {pending ? "Running…" : children}
    </button>
  );
}

export function AdminScreen({ onSignOut }: { onSignOut: () => void }) {
  const utils = trpc.useUtils();
  const status = trpc["admin.syncStatus"].useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const recentRuns = trpc["admin.recentRuns"].useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const refresh = () => {
    utils["admin.syncStatus"].invalidate();
    utils["admin.recentRuns"].invalidate();
  };

  const episodesSync = trpc["admin.runEpisodesSync"].useMutation({
    onSettled: refresh,
  });
  const episodeTracksSync = trpc["admin.runEpisodeTracksSync"].useMutation({
    onSettled: refresh,
  });

  // Credentials that stopped working (rotated, or a stale tab) shouldn't leave
  // the screen sitting on an error — send them back to the sign-in form.
  const unauthorized = status.error?.data?.code === "UNAUTHORIZED";
  useEffect(() => {
    if (unauthorized) onSignOut();
  }, [unauthorized, onSignOut]);

  const data = status.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-16 pt-safe-top">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Soulector Admin</h1>
        <button
          onClick={onSignOut}
          className="text-sm text-gray-500 underline underline-offset-4"
        >
          Sign out
        </button>
      </header>

      {status.isPending ? (
        <p className="text-sm text-gray-500">Loading status…</p>
      ) : status.isError ? (
        <p className="text-sm text-red-600">
          Couldn&apos;t load sync status: {status.error.message}
        </p>
      ) : null}

      {data ? (
        <>
          <Card title="Latest episodes">
            <div className="space-y-4">
              <LastRun run={data.lastRuns.episodes} />

              <ul className="divide-y divide-gray-100 border-y border-gray-100">
                {data.collectives.map((collective) => (
                  <li key={collective.collectiveSlug} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {collectiveLabel(collective.collectiveSlug)}
                      </span>
                      <span className="shrink-0 text-sm text-gray-500">
                        {collective.episodeCount} episodes
                      </span>
                    </div>
                    {collective.latestEpisode ? (
                      <div className="mt-1 text-sm text-gray-500">
                        Newest: {collective.latestEpisode.name} ·{" "}
                        {timeAgo(collective.latestEpisode.releasedAt)}
                      </div>
                    ) : null}
                    <div className="mt-1 text-sm text-gray-500">
                      {collective.withTracksCount > 0
                        ? `${collective.withTracksCount} with tracklists`
                        : "No tracklists — no source for this collective"}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <RunButton
                  onClick={() => episodesSync.mutate()}
                  pending={episodesSync.isPending}
                >
                  Sync episodes
                </RunButton>
                {episodesSync.isError ? (
                  <span className="text-sm text-red-600">
                    {episodesSync.error.message}
                  </span>
                ) : episodesSync.data ? (
                  <span className="text-sm text-gray-600">
                    {episodesSync.data.insertedCount === 0
                      ? "No new episodes"
                      : `Added ${episodesSync.data.insertedNames.join(", ")}`}
                  </span>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title="Episode tracks">
            <div className="space-y-4">
              <LastRun run={data.lastRuns.episodeTracks} />

              <div className="text-sm text-gray-600">
                <p>
                  {data.episodeTracks.withTracksCount} of{" "}
                  {data.episodeTracks.inRangeCount} Soulection episodes #
                  {data.episodeTracks.startEpisode}+ have tracklists.
                </p>
                <p className="mt-1">
                  {data.episodeTracks.missingCount === 0
                    ? "Nothing missing."
                    : `${data.episodeTracks.missingCount} missing · a run takes up to ${data.episodeTracks.batchLimit} at a time.`}
                </p>
              </div>

              {data.episodeTracks.missingEpisodes.length > 0 ? (
                <ul className="divide-y divide-gray-100 border-y border-gray-100 text-sm">
                  {data.episodeTracks.missingEpisodes.map((episode) => (
                    <li
                      key={episode.id}
                      className="flex items-baseline justify-between gap-3 py-2"
                    >
                      <span>{episode.name}</span>
                      <span className="shrink-0 text-gray-500">
                        {timeAgo(episode.releasedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <RunButton
                  onClick={() => episodeTracksSync.mutate()}
                  pending={episodeTracksSync.isPending}
                >
                  Sync tracks
                </RunButton>
                {episodeTracksSync.isError ? (
                  <span className="text-sm text-red-600">
                    {episodeTracksSync.error.message}
                  </span>
                ) : episodeTracksSync.data ? (
                  <span className="text-sm text-gray-600">
                    {summaryLine(episodeTracksSync.data)}
                    {episodeTracksSync.data.remaining > 0
                      ? ` · ${episodeTracksSync.data.remaining} left`
                      : null}
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        </>
      ) : null}

      <Card title="Recent runs">
        {recentRuns.isPending ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !recentRuns.data || recentRuns.data.length === 0 ? (
          <p className="text-sm text-gray-500">No runs recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentRuns.data.map((run) => (
              <li key={run.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <StatusDot status={run.status} />
                    {run.job === "episodes" ? "Episodes" : "Episode tracks"}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {timeAgo(run.startedAt)}
                  </span>
                </div>
                <div className="mt-1 pl-4 text-sm text-gray-500">
                  {run.trigger === "admin" ? "manual" : "cron"} ·{" "}
                  {runSummaryLine(run)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
