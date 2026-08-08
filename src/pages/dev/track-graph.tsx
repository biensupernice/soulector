import { useMemo } from "react";
import { GetServerSideProps } from "next";
import { trackKey } from "@/lib/trackIdentity";
import { useSearchIndex } from "@/client/EpisodesScreen/useSearchIndex";

/**
 * Holds the TypeScript port of `TrackIdentity` honest against the iOS one.
 *
 * The four aggregates below were measured on the iOS side against this same
 * `episodes.searchIndex` snapshot, and they fail in distinguishable ways: if
 * "keyed" drifts the folding diverged, if only "connected" drifts the
 * bucketing did, and if only the episode count drifts the self-episode rule
 * did. A bucket of ~250 means the station-ident filter stopped firing and a
 * quarter of the archive just became one cluster.
 */
const EXPECTED = {
  keyedPct: 97,
  connectedPct: 42,
  episodesWithMove: 388,
  identLine: 252,
};

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === "production") return { notFound: true };
  return { props: {} };
};

export default function TrackGraphStats() {
  const index = useSearchIndex();

  const stats = useMemo(() => {
    if (!index) return null;

    const started = performance.now();
    const byKey = new Map<string, { episodeId: string; name: string; artist: string }[]>();
    let totalTracks = 0;
    let keyed = 0;

    for (const { id, tracks } of index) {
      for (const track of tracks) {
        totalTracks++;
        const key = trackKey(track.name, track.artist);
        if (key === null) continue;
        keyed++;
        const bucket = byKey.get(key) ?? [];
        bucket.push({ episodeId: id, name: track.name, artist: track.artist });
        byKey.set(key, bucket);
      }
    }

    let connected = 0;
    const episodesWithAMove = new Set<string>();
    let episodesWithTracks = 0;

    for (const { id, tracks } of index) {
      if (tracks.length > 0) episodesWithTracks++;
      for (const track of tracks) {
        const key = trackKey(track.name, track.artist);
        if (key === null) continue;
        const elsewhere = (byKey.get(key) ?? []).some((a) => a.episodeId !== id);
        if (elsewhere) {
          connected++;
          episodesWithAMove.add(id);
        }
      }
    }

    const identLine = index.reduce(
      (sum, e) =>
        sum +
        e.tracks.filter(
          (t) => t.name === "Soulection Radio" && t.artist === "Hosted by Joe Kay",
        ).length,
      0,
    );

    const buckets = [...byKey.entries()]
      .map(([key, list]) => ({
        key,
        episodes: new Set(list.map((a) => a.episodeId)).size,
        sample: list[0],
      }))
      .sort((a, b) => b.episodes - a.episodes)
      .slice(0, 20);

    return {
      buildMs: Math.round(performance.now() - started),
      totalTracks,
      keyed,
      connected,
      episodesWithTracks,
      episodesWithAMove: episodesWithAMove.size,
      identLine,
      identLineKeyed: trackKey("Soulection Radio", "Hosted by Joe Kay"),
      buckets,
    };
  }, [index]);

  if (!stats) return <div className="p-8 font-mono">building the graph…</div>;

  const keyedPct = (stats.keyed / stats.totalTracks) * 100;
  const connectedPct = (stats.connected / stats.keyed) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8 font-mono text-sm">
      <div>
        <h1 className="text-lg font-bold">track graph — parity with iOS</h1>
        <p className="text-gray-500">
          graph built in {stats.buildMs}ms over {stats.totalTracks} tracks
        </p>
      </div>

      <table className="w-full">
        <tbody>
          <Row
            label="tracks keyed"
            actual={`${stats.keyed} = ${keyedPct.toFixed(1)}%`}
            expected={`${EXPECTED.keyedPct}%`}
            ok={Math.round(keyedPct) === EXPECTED.keyedPct}
          />
          <Row
            label="of those, connected"
            actual={`${stats.connected} = ${connectedPct.toFixed(1)}%`}
            expected={`${EXPECTED.connectedPct}%`}
            ok={Math.round(connectedPct) === EXPECTED.connectedPct}
          />
          <Row
            label="episodes with a sideways move"
            actual={`${stats.episodesWithAMove} / ${stats.episodesWithTracks}`}
            expected={`${EXPECTED.episodesWithMove}`}
            ok={stats.episodesWithAMove === EXPECTED.episodesWithMove}
          />
          <Row
            label="station-ident lines"
            actual={`${stats.identLine}`}
            expected={`${EXPECTED.identLine}`}
            ok={stats.identLine === EXPECTED.identLine}
          />
          <Row
            label="…and its key (must be null)"
            actual={String(stats.identLineKeyed)}
            expected="null"
            ok={stats.identLineKeyed === null}
          />
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 font-bold">biggest clusters</h2>
        <p className="mb-2 text-gray-500">
          all should be real records. ~250 means the ident filter stopped firing.
        </p>
        <ol className="space-y-1">
          {stats.buckets.map((b) => (
            <li key={b.key}>
              <span className="inline-block w-8 text-right">{b.episodes}</span>{" "}
              {b.sample.name} — <span className="text-gray-500">{b.sample.artist}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({
  label,
  actual,
  expected,
  ok,
}: {
  label: string;
  actual: string;
  expected: string;
  ok: boolean;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2">{label}</td>
      <td className="py-2 text-right font-bold">{actual}</td>
      <td className="py-2 pl-6 text-gray-500">ios: {expected}</td>
      <td className={`py-2 pl-4 font-bold ${ok ? "text-green-600" : "text-red-600"}`}>
        {ok ? "match" : "DRIFT"}
      </td>
    </tr>
  );
}
