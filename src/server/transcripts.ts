import { Db, ObjectId, WithId } from "mongodb";
import { HIDDEN_COLLECTIVES } from "@/lib/collectives";

/**
 * Machine-made transcripts of episodes, once a human has passed them.
 *
 * The audio goes through demucs (vocals only) and then whisper, which happens
 * offline on another machine — nothing here transcribes anything. What lands
 * in this collection is the reviewed result: a transcript is written by the
 * publish path below and by nothing else, so anything the app reads has been
 * looked at by someone.
 *
 * One document per episode, keyed by the episode's own _id. A transcript is
 * meaningless without its episode, and there is only ever one current version,
 * so a separate id would buy nothing but a join.
 */

export type TranscriptSegment = {
  /** Seconds from the start of the episode. */
  start: number;
  end: number;
  text: string;
  /** Detected per segment, not per episode — these shows are multilingual. */
  lang?: string;
};

export type DBEpisodeTranscript = {
  _id: ObjectId;
  /**
   * Every segment's text run together. Segments are what you read; this is
   * what the text index searches, because Mongo cannot index inside an array
   * of subdocuments as one continuous stretch of prose — and a phrase that
   * straddles two segments is exactly the phrase someone half-remembers.
   */
  text: string;
  segments: TranscriptSegment[];
  durationS: number;
  /** Denormalised so search can answer without touching the episodes. */
  episodeName: string;
  collectiveSlug: string;
  /** Which languages actually appear, most-used first. */
  langs: string[];
  model: string;
  pipeline: string;
  publishedAt: Date;
  /** Bumped on every republish, so a client can tell a change from a re-read. */
  revision: number;
};

export const TRANSCRIPTS_COLLECTION = "episodeTranscripts";

export function transcriptsCollection(db: Db) {
  return db.collection<DBEpisodeTranscript>(TRANSCRIPTS_COLLECTION);
}

export type TranscriptProjection = ReturnType<typeof transcriptProjection>;
export function transcriptProjection(t: WithId<DBEpisodeTranscript>) {
  return {
    episodeId: t._id.toString(),
    episodeName: t.episodeName,
    durationS: t.durationS,
    langs: t.langs,
    revision: t.revision,
    publishedAt: t.publishedAt.toISOString(),
    segments: t.segments,
  } as const;
}

/**
 * The text index the search below needs. Creating an index that already exists
 * is a no-op in Mongo, so this is safe to call on every search rather than
 * asking someone to remember a migration.
 */
let indexEnsured: Promise<unknown> | null = null;
export function ensureTranscriptIndexes(db: Db) {
  indexEnsured ??= transcriptsCollection(db)
    .createIndex({ text: "text" }, { name: "transcript_text", default_language: "english" })
    .catch((err) => {
      // A failed index must not become a permanently poisoned promise, or the
      // first bad deploy would disable search until the process restarts.
      indexEnsured = null;
      throw err;
    });
  return indexEnsured;
}

export type TranscriptHit = {
  episodeId: string;
  episodeName: string;
  collectiveSlug: string;
  /** Seconds into the episode — enough to start playing at the line. */
  at: number;
  text: string;
  lang?: string;
};

const HITS_PER_EPISODE = 3;

/**
 * Search every published transcript for a phrase.
 *
 * Two steps, for two different jobs. Mongo's text index finds *which* episodes
 * say it — fast, and across the whole catalogue. Then the segments of only
 * those episodes are scanned to find *where*, because a timestamp is the point:
 * a hit you cannot jump to is a hit you cannot use.
 */
export async function searchTranscripts(
  db: Db,
  query: string,
  { episodeLimit = 20 }: { episodeLimit?: number } = {},
): Promise<TranscriptHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  await ensureTranscriptIndexes(db);

  // Quoted, so this is a phrase and not a bag of words. Someone searching
  // "before I let go" wants that line, not every episode containing "let".
  const phrase = `"${q.replace(/"/g, " ")}"`;

  const docs = await transcriptsCollection(db)
    .find(
      {
        $text: { $search: phrase },
        collectiveSlug: { $nin: HIDDEN_COLLECTIVES as readonly string[] },
      },
      {
        projection: { segments: 1, episodeName: 1, collectiveSlug: 1, score: { $meta: "textScore" } },
        sort: { score: { $meta: "textScore" } },
        limit: episodeLimit,
      },
    )
    .toArray();

  const needle = q.toLowerCase();
  const hits: TranscriptHit[] = [];

  for (const doc of docs) {
    let found = 0;
    for (const seg of doc.segments) {
      if (!seg.text.toLowerCase().includes(needle)) continue;
      hits.push({
        episodeId: doc._id.toString(),
        episodeName: doc.episodeName,
        collectiveSlug: doc.collectiveSlug,
        at: seg.start,
        text: seg.text,
        lang: seg.lang,
      });
      if (++found >= HITS_PER_EPISODE) break;
    }
    // The phrase matched the running text but no single segment holds it: it
    // straddles a segment boundary. Point at the first segment that carries
    // any of it rather than dropping the episode from the results.
    if (found === 0) {
      const firstWord = needle.split(/\s+/)[0];
      const seg = doc.segments.find((s) => s.text.toLowerCase().includes(firstWord));
      if (seg) {
        hits.push({
          episodeId: doc._id.toString(),
          episodeName: doc.episodeName,
          collectiveSlug: doc.collectiveSlug,
          at: seg.start,
          text: seg.text,
          lang: seg.lang,
        });
      }
    }
  }

  return hits;
}

export type PublishTranscriptInput = {
  episodeId: string;
  segments: TranscriptSegment[];
  durationS: number;
  model: string;
  pipeline: string;
};

/**
 * Write a reviewed transcript, replacing whatever was there.
 *
 * The episode is read rather than trusted from the caller: the name and the
 * collective are denormalised into the transcript, and denormalised data that
 * came from the client is data that can disagree with its source.
 */
export async function publishTranscript(db: Db, input: PublishTranscriptInput) {
  const episodeId = new ObjectId(input.episodeId);
  const episode = await db
    .collection<{ name: string; collective_slug: string; duration: number }>("tracksOld")
    .findOne({ _id: episodeId }, { projection: { name: 1, collective_slug: 1, duration: 1 } });

  if (!episode) throw new Error(`no episode ${input.episodeId}`);

  const segments = input.segments
    .filter((s) => s.text.trim().length > 0)
    .sort((a, b) => a.start - b.start);

  const langCounts = new Map<string, number>();
  for (const s of segments) if (s.lang) langCounts.set(s.lang, (langCounts.get(s.lang) ?? 0) + 1);
  const langs = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);

  const existing = await transcriptsCollection(db).findOne(
    { _id: episodeId },
    { projection: { revision: 1 } },
  );

  const doc: DBEpisodeTranscript = {
    _id: episodeId,
    text: segments.map((s) => s.text.trim()).join(" "),
    segments,
    durationS: input.durationS || episode.duration,
    episodeName: episode.name,
    collectiveSlug: episode.collective_slug,
    langs,
    model: input.model,
    pipeline: input.pipeline,
    publishedAt: new Date(),
    revision: (existing?.revision ?? 0) + 1,
  };

  await transcriptsCollection(db).replaceOne({ _id: episodeId }, doc, { upsert: true });
  await ensureTranscriptIndexes(db).catch(() => {});

  return {
    episodeId: input.episodeId,
    episodeName: episode.name,
    segments: segments.length,
    revision: doc.revision,
  };
}
