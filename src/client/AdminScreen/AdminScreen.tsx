import { useEffect } from "react";
import { useRouter } from "next/router";
import { trpc } from "@/utils/trpc";
import { HIDDEN_COLLECTIVES } from "@/lib/collectives";
import type { SyncRunProjection, SyncRunSummary } from "@/server/sync-runs";
import {
  AdminPage,
  Button,
  Card,
  CoverageBar,
  Empty,
  Pill,
  StatCard,
  StatusDot,
  Tone,
  timeAgo,
} from "./AdminChrome";
import { EditRequestsScreen } from "./EditRequests";

/**
 * The admin screen: where the catalogue stands, and what to do about it.
 *
 * It answers one question first — what is missing — and puts the button that
 * fixes each gap next to the gap itself. Everything the app knows about an
 * episode arrives from somewhere that can fall behind: SoundCloud gets new
 * shows, tracklists are published later, transcripts are made in batches on
 * another machine. Coverage is the state of those three, and it is the reason
 * anyone opens this page.
 */

const COLLECTIVE_LABELS: Record<string, string> = {
  soulection: "Soulection Radio",
  "sasha-marie-radio": "Sasha Marie Radio",
  "the-love-below-hour": "The Love Below Hour",
  local: "Local",
};

const collectiveLabel = (slug: string) => COLLECTIVE_LABELS[slug] ?? slug;

const isHidden = (slug: string) =>
  (HIDDEN_COLLECTIVES as readonly string[]).includes(slug);

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
  if (summary.skipped.length > 0) parts.push(`${summary.skipped.length} skipped`);
  return parts.join(" · ");
}

function runSummaryLine(run: SyncRunProjection) {
  if (run.status === "error") return run.error ?? "Failed";
  // A run left as `running` almost always means the request was cut off
  // partway — a timeout — rather than something still going.
  if (run.status === "running") return "Started, never finished";
  return run.summary ? summaryLine(run.summary) : "—";
}

const runTone = (status: SyncRunProjection["status"]): Tone =>
  status === "success" ? "good" : status === "error" ? "bad" : "attention";

function lastRunLine(run: SyncRunProjection | null) {
  if (!run) return "Never run";
  return `${timeAgo(run.startedAt)} · ${runSummaryLine(run)}`;
}

export function AdminScreen({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const inReview =
    typeof router.query.batch === "string" ||
    typeof router.query.request === "string" ||
    typeof router.query.review === "string";

  // Reviewing a change takes the whole page. It is a long document with a
  // panel of evidence hanging off it, and it was never going to fit in a card
  // on a dashboard.
  if (inReview) return <EditRequestsScreen />;

  return <Dashboard onSignOut={onSignOut} />;
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const status = trpc["admin.syncStatus"].useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const recentRuns = trpc["admin.recentRuns"].useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const batches = trpc["admin.editRequestBatches"].useQuery(undefined, {
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

  // Hidden collectives are left out of every denominator. Their episodes are
  // unreachable, and counting them would make coverage permanently, wrongly
  // incomplete — a third of the catalogue that can never be filled in.
  const visible = (data?.collectives ?? []).filter(
    (c) => !isHidden(c.collectiveSlug),
  );
  const totalEpisodes = visible.reduce((n, c) => n + c.episodeCount, 0);
  const totalTracklists = visible.reduce((n, c) => n + c.withTracksCount, 0);
  const totalTranscripts = visible.reduce(
    (n, c) => n + c.withTranscriptsCount,
    0,
  );

  const openBatches = (batches.data ?? []).filter((b) => b.counts.open > 0);
  const waiting = data?.editRequests.open ?? 0;

  const goToReview = (batchId?: string) =>
    router.push(
      { pathname: router.pathname, query: batchId ? { batch: batchId } : { review: "1" } },
      undefined,
      { shallow: true },
    );

  return (
    <AdminPage
      title="Soulector Admin"
      subtitle={
        data
          ? `${totalEpisodes.toLocaleString()} episodes across ${visible.length} collectives`
          : undefined
      }
      onSignOut={onSignOut}
    >
      {status.isPending ? (
        <Empty>Loading…</Empty>
      ) : status.isError ? (
        <Card>
          <p className="text-sm text-rose-600">
            Couldn&apos;t load status: {status.error.message}
          </p>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Episodes"
              value={totalEpisodes.toLocaleString()}
              detail={lastRunLine(data.lastRuns.episodes)}
              action={
                <Button
                  onClick={() => episodesSync.mutate()}
                  disabled={episodesSync.isPending}
                >
                  {episodesSync.isPending ? "Syncing…" : "Sync episodes"}
                </Button>
              }
            />

            <StatCard
              label="Tracklists"
              value={totalTracklists.toLocaleString()}
              progress={{ done: totalTracklists, total: totalEpisodes }}
              tone={data.episodeTracks.missingCount > 0 ? "attention" : "good"}
              detail={
                data.episodeTracks.missingCount === 0
                  ? `Nothing missing in #${data.episodeTracks.startEpisode}+`
                  : `${data.episodeTracks.missingCount} missing in #${data.episodeTracks.startEpisode}+ · ${data.episodeTracks.batchLimit} per run`
              }
              action={
                <Button
                  onClick={() => episodeTracksSync.mutate()}
                  disabled={
                    episodeTracksSync.isPending ||
                    data.episodeTracks.missingCount === 0
                  }
                >
                  {episodeTracksSync.isPending ? "Syncing…" : "Sync tracks"}
                </Button>
              }
            />

            <StatCard
              label="Transcripts"
              value={totalTranscripts.toLocaleString()}
              progress={{ done: totalTranscripts, total: totalEpisodes }}
              tone={totalTranscripts > 0 ? "good" : "neutral"}
              detail="Made on the pipeline machine, published by reviewing a change."
            />

            <StatCard
              label="Waiting to review"
              value={waiting}
              unit={waiting === 1 ? "change" : "changes"}
              tone={waiting > 0 ? "attention" : "neutral"}
              detail={
                waiting > 0
                  ? `Across ${data.editRequests.batches} ${data.editRequests.batches === 1 ? "batch" : "batches"}`
                  : "Nothing to review"
              }
              action={
                <Button
                  onClick={() => goToReview(openBatches[0]?.batchId)}
                  variant={waiting > 0 ? "primary" : "secondary"}
                >
                  {waiting > 0 ? "Review" : "See all"}
                </Button>
              }
            />
          </div>

          {episodesSync.isError || episodeTracksSync.isError ? (
            <Card>
              <p className="text-sm text-rose-600">
                {episodesSync.error?.message ?? episodeTracksSync.error?.message}
              </p>
            </Card>
          ) : null}

          {openBatches.length > 0 ? (
            <Card
              title="Batches waiting"
              action={
                <Button variant="quiet" onClick={() => goToReview()}>
                  All batches
                </Button>
              }
              padded={false}
            >
              <ul className="divide-y divide-gray-100">
                {openBatches.map((batch) => (
                  <li key={batch.batchId}>
                    <button
                      onClick={() => goToReview(batch.batchId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {batch.batchLabel}
                        </div>
                        <div className="mt-0.5 text-sm text-gray-500">
                          {batch.source} · {timeAgo(batch.submittedAt)}
                        </div>
                      </div>
                      <Pill tone="attention">{batch.counts.open} waiting</Pill>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Coverage by collective" padded={false}>
            <ul className="divide-y divide-gray-100">
              {data.collectives.map((collective) => {
                const hidden = isHidden(collective.collectiveSlug);
                return (
                  <li key={collective.collectiveSlug} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="truncate">
                          {collectiveLabel(collective.collectiveSlug)}
                        </span>
                        {hidden ? <Pill>hidden</Pill> : null}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-gray-500">
                        {collective.episodeCount} episodes
                      </span>
                    </div>

                    {hidden ? (
                      <p className="mt-1 text-sm text-gray-500">
                        Not shown in the app — the audio is gone from SoundCloud.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-y-2 sm:grid-cols-2 sm:gap-x-8">
                        <Coverage
                          label="Tracklists"
                          done={collective.withTracksCount}
                          total={collective.episodeCount}
                        />
                        <Coverage
                          label="Transcripts"
                          done={collective.withTranscriptsCount}
                          total={collective.episodeCount}
                        />
                      </div>
                    )}

                    {collective.latestEpisode ? (
                      <div className="mt-2 truncate text-sm text-gray-500">
                        Newest: {collective.latestEpisode.name} ·{" "}
                        {timeAgo(collective.latestEpisode.releasedAt)}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>

          {data.episodeTracks.missingEpisodes.length > 0 ? (
            <Card
              title={`Missing tracklists · ${data.episodeTracks.missingCount}`}
              padded={false}
            >
              <ul className="divide-y divide-gray-100">
                {data.episodeTracks.missingEpisodes.map((episode) => (
                  <li
                    key={episode.id}
                    className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="truncate">{episode.name}</span>
                    <span className="shrink-0 text-gray-500">
                      {timeAgo(episode.releasedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card title="Recent runs" padded={false}>
        {recentRuns.isPending ? (
          <div className="p-4">
            <Empty>Loading…</Empty>
          </div>
        ) : !recentRuns.data || recentRuns.data.length === 0 ? (
          <div className="p-4">
            <Empty>No runs recorded yet.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentRuns.data.map((run) => (
              <li key={run.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <StatusDot tone={runTone(run.status)} />
                    {run.job === "episodes" ? "Episodes" : "Episode tracks"}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {timeAgo(run.startedAt)}
                  </span>
                </div>
                <div className="mt-0.5 pl-4 text-sm text-gray-500">
                  {run.trigger === "admin" ? "manual" : "cron"} ·{" "}
                  {runSummaryLine(run)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}

function Coverage({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const complete = total > 0 && done >= total;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="tabular-nums text-gray-700">
          {done} / {total}
        </span>
      </div>
      <div className="mt-1">
        <CoverageBar
          done={done}
          total={total}
          tone={complete ? "good" : done === 0 ? "neutral" : "attention"}
        />
      </div>
    </div>
  );
}
