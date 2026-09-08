import { cn } from "@/lib/utils";
import { formatTimeSecs } from "../helpers";
import { IconMusicNote } from "../components/Icons";

export type TranscriptHit = {
  episodeId: string;
  episodeName: string;
  collectiveSlug: string;
  at: number;
  text: string;
  lang?: string;
};

/**
 * Search results from what was *said*, kept separate from results from what
 * was listed.
 *
 * A tracklist match is a fact: someone wrote that the record played. A
 * transcript match is a machine's hearing of two hours of music and talk, and
 * mixing the two in one list would quietly borrow the tracklist's authority
 * for it. Below, under its own heading, it reads as what it is — somewhere the
 * words turn up, which is often exactly what you were trying to find.
 */
export function TranscriptResults({
  hits,
  loading,
  query,
  onHitClick,
}: {
  hits: TranscriptHit[];
  loading: boolean;
  query: string;
  onHitClick: (episodeId: string, atSecs: number) => void;
}) {
  if (query.trim().length < 3) return null;

  if (loading && hits.length === 0) {
    return (
      <Section>
        <div className="px-4 py-3 text-sm text-gray-400">
          Searching transcripts…
        </div>
      </Section>
    );
  }

  if (hits.length === 0) return null;

  // Grouped, because one episode saying a phrase three times is one episode,
  // not three results.
  const byEpisode = new Map<string, TranscriptHit[]>();
  for (const hit of hits) {
    const list = byEpisode.get(hit.episodeId);
    if (list) list.push(hit);
    else byEpisode.set(hit.episodeId, [hit]);
  }

  return (
    <Section count={byEpisode.size}>
      {[...byEpisode.entries()].map(([episodeId, episodeHits]) => (
        <div key={episodeId} className="px-4 py-2">
          <div className="truncate text-sm font-semibold text-gray-900">
            {episodeHits[0].episodeName}
          </div>
          <div className="mt-1 border-l-2 border-accent/20 pl-3">
            {episodeHits.map((hit, i) => (
              <button
                key={`${hit.at}-${i}`}
                onClick={() => onHitClick(episodeId, hit.at)}
                className={cn(
                  "group flex w-full items-start justify-between gap-3 rounded-md px-2 py-2 text-left",
                  "hover:bg-slate-50 active:bg-slate-100 focus:outline-none",
                )}
                title={`Play from ${formatTimeSecs(hit.at)}`}
              >
                <span className="min-w-0 text-sm text-gray-700">
                  {highlight(hit.text, query)}
                </span>
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 group-hover:bg-accent/10 group-hover:text-accent">
                  {formatTimeSecs(hit.at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

function Section({
  count,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-2 px-4 pb-1">
        <IconMusicNote className="h-3.5 w-3.5 fill-current text-gray-400" />
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Heard in transcripts
          {count ? ` · ${count} ${count === 1 ? "episode" : "episodes"}` : ""}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The matched phrase, marked where it appears in the line. */
function highlight(text: string, query: string) {
  const needle = query.trim().toLowerCase();
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0 || !needle) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-accent/15 px-0.5 text-gray-900">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}
