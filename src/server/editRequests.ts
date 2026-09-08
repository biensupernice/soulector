import { Db, ObjectId, WithId } from "mongodb";
import {
  TranscriptSegment,
  publishTranscript,
  searchTranscripts,
  transcriptsCollection,
} from "@/server/transcripts";

/**
 * Proposed changes to an episode, waiting for someone to look at them.
 *
 * Episode data arrives from places that cannot be trusted to be right: a
 * scraped tracklist, a machine transcript, eventually a correction from a
 * listener. Writing any of it straight into the episodes would mean the app is
 * only ever as good as its worst source, and mistakes would be discovered by
 * the people reading them.
 *
 * So a change is submitted rather than made. It sits here as a proposal, with
 * whatever evidence its author could offer, until a person opens it, fixes
 * what needs fixing, and applies it. Applying is the only path by which any of
 * this reaches an episode.
 *
 * Requests arrive in batches because they are produced in batches — a run of
 * the transcription pipeline yields thirty at once — and reviewing thirty
 * related things is a different job from reviewing thirty unrelated ones. The
 * batch is what you open, skim, and apply.
 */

export type EditRequestStatus = "open" | "applied" | "rejected";

/** The one kind of change so far. Others will be siblings of this. */
export type TranscriptProposal = {
  kind: "transcript";
  segments: TranscriptSegment[];
  durationS: number;
  model: string;
  pipeline: string;
};

export type EditProposal = TranscriptProposal;
export type EditRequestKind = EditProposal["kind"];

/**
 * What the submitter knew that the reviewer cannot look up.
 *
 * The pipeline that makes transcripts also knows which episodes share audio
 * with which — computed from fingerprints on a machine holding 100 GB of
 * downloaded episodes, none of which exists here. When a stretch of transcript
 * is unintelligible it is usually a record playing, and the same stretch
 * appearing in an episode that *does* have a tracklist is what names it. That
 * fact travels with the request or it is not available at all.
 */
export type SharedAudioSpan = {
  otherEpisodeId: string;
  otherEpisodeName: string;
  /** Seconds into this episode. */
  from: number;
  to: number;
  /** The same audio's position in the other episode. */
  otherFrom: number;
  otherTo: number;
  /** Playback-rate ratio, so a moment can be mapped across a re-pitched play. */
  tempo: number;
  semitones: number;
  /** How much audio actually lined up — the strength of the match. */
  votes: number;
};

export type EditEvidence = {
  sharedAudio?: SharedAudioSpan[];
};

export type DBEditRequest = {
  _id: ObjectId;
  batchId: string;
  batchLabel: string;
  episodeId: ObjectId;
  episodeName: string;
  kind: EditRequestKind;
  status: EditRequestStatus;
  /** The change as it stands — a reviewer's edits are written back here. */
  proposal: EditProposal;
  /** True once a reviewer has changed the proposal from what was submitted. */
  edited: boolean;
  evidence: EditEvidence;
  note: string;
  /** Where it came from, in words a person recognises. */
  source: string;
  submittedAt: Date;
  updatedAt: Date;
  decidedAt?: Date;
  applied?: { at: Date; revision: number; segments: number };
};

const COLLECTION = "episodeEditRequests";

export function editRequestsCollection(db: Db) {
  return db.collection<DBEditRequest>(COLLECTION);
}

// ---------------------------------------------------------------------------
// submitting
// ---------------------------------------------------------------------------

export type SubmittedRequest = {
  episodeId: string;
  kind: EditRequestKind;
  proposal: EditProposal;
  evidence?: EditEvidence;
  note?: string;
};

/**
 * Take in a batch.
 *
 * Resubmitting an episode replaces the open request for it rather than adding
 * a second: the pipeline is rerun freely, and two proposals for the same
 * episode is a question nobody wants to answer. Requests already applied or
 * rejected are left alone — they are history.
 */
export async function submitEditRequests(
  db: Db,
  { batchLabel, source, requests }: {
    batchLabel: string;
    source: string;
    requests: SubmittedRequest[];
  },
) {
  const batchId = new ObjectId().toHexString();
  const now = new Date();

  const ids = requests.map((r) => new ObjectId(r.episodeId));
  const episodes = await db
    .collection<{ name: string }>("tracksOld")
    .find({ _id: { $in: ids } }, { projection: { name: 1 } })
    .toArray();
  const nameById = new Map(episodes.map((e) => [e._id.toString(), e.name]));

  const accepted: DBEditRequest[] = [];
  const skipped: { episodeId: string; reason: string }[] = [];

  for (const r of requests) {
    const name = nameById.get(r.episodeId);
    if (!name) {
      skipped.push({ episodeId: r.episodeId, reason: "no such episode" });
      continue;
    }
    accepted.push({
      _id: new ObjectId(),
      batchId,
      batchLabel,
      episodeId: new ObjectId(r.episodeId),
      episodeName: name,
      kind: r.kind,
      status: "open",
      proposal: r.proposal,
      edited: false,
      evidence: r.evidence ?? {},
      note: r.note ?? "",
      source,
      submittedAt: now,
      updatedAt: now,
    });
  }

  const collection = editRequestsCollection(db);
  if (accepted.length > 0) {
    await collection.deleteMany({
      status: "open",
      episodeId: { $in: accepted.map((r) => r.episodeId) },
      kind: { $in: [...new Set(accepted.map((r) => r.kind))] },
    });
    await collection.insertMany(accepted);
  }

  return { batchId, batchLabel, accepted: accepted.length, skipped };
}

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

/**
 * A change described in one line, without sending the change itself.
 *
 * The list view has to say what each request does before you open it, and a
 * transcript is 80 KB — thirty of them would be a two-megabyte response for a
 * screen showing thirty sentences.
 */
export type EditRequestSummary = {
  id: string;
  batchId: string;
  batchLabel: string;
  episodeId: string;
  episodeName: string;
  kind: EditRequestKind;
  status: EditRequestStatus;
  edited: boolean;
  note: string;
  submittedAt: string;
  /** Null when the episode has nothing of this kind yet — the change is an addition. */
  replaces: { revision: number; lines: number } | null;
  /** How the proposal differs from what is live. Null when nothing is live. */
  changes: { added: number; removed: number; changed: number } | null;
  lines: number;
  durationS: number;
  langs: string[];
  appliedRevision: number | null;
};

function langsOf(segments: TranscriptSegment[]) {
  const counts = new Map<string, number>();
  for (const s of segments) if (s.lang) counts.set(s.lang, (counts.get(s.lang) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

async function summarise(
  db: Db,
  rows: WithId<DBEditRequest>[],
): Promise<EditRequestSummary[]> {
  const existing = await transcriptsCollection(db)
    .find(
      { _id: { $in: rows.map((r) => r.episodeId) } },
      { projection: { revision: 1, segments: 1 } },
    )
    .toArray();
  const byEpisode = new Map(
    existing.map((t) => [
      t._id.toString(),
      { revision: t.revision, lines: t.segments.length, segments: t.segments },
    ]),
  );

  return rows.map((r) => {
    const live = byEpisode.get(r.episodeId.toString());
    const diff = live ? diffSegments(live.segments, r.proposal.segments) : null;
    return {
    id: r._id.toString(),
    batchId: r.batchId,
    batchLabel: r.batchLabel,
    episodeId: r.episodeId.toString(),
    episodeName: r.episodeName,
    kind: r.kind,
    status: r.status,
    edited: r.edited,
    note: r.note,
    submittedAt: r.submittedAt.toISOString(),
    replaces: live ? { revision: live.revision, lines: live.lines } : null,
    changes: diff
      ? {
          added: diff.filter((d) => d.change === "added").length,
          removed: diff.filter((d) => d.change === "removed").length,
          changed: diff.filter((d) => d.change === "changed").length,
        }
      : null,
    lines: r.proposal.segments.length,
    durationS: r.proposal.durationS,
    langs: langsOf(r.proposal.segments),
    appliedRevision: r.applied?.revision ?? null,
    };
  });
}

export type EditRequestBatch = {
  batchId: string;
  batchLabel: string;
  source: string;
  submittedAt: string;
  counts: Record<EditRequestStatus, number>;
  total: number;
};

export async function listBatches(db: Db): Promise<EditRequestBatch[]> {
  const rows = await editRequestsCollection(db)
    .find({}, { projection: { batchId: 1, batchLabel: 1, source: 1, submittedAt: 1, status: 1 } })
    .sort({ submittedAt: -1 })
    .toArray();

  const batches = new Map<string, EditRequestBatch>();
  for (const r of rows) {
    let batch = batches.get(r.batchId);
    if (!batch) {
      batch = {
        batchId: r.batchId,
        batchLabel: r.batchLabel,
        source: r.source,
        submittedAt: r.submittedAt.toISOString(),
        counts: { open: 0, applied: 0, rejected: 0 },
        total: 0,
      };
      batches.set(r.batchId, batch);
    }
    batch.counts[r.status]++;
    batch.total++;
  }
  return [...batches.values()];
}

export async function listEditRequests(
  db: Db,
  { batchId, status }: { batchId?: string; status?: EditRequestStatus } = {},
) {
  const rows = await editRequestsCollection(db)
    .find({
      ...(batchId ? { batchId } : {}),
      ...(status ? { status } : {}),
    })
    .sort({ submittedAt: -1, episodeName: 1 })
    .toArray();
  return summarise(db, rows);
}

/**
 * One request, with everything needed to judge it: the proposal, what it would
 * replace, and a line-by-line account of the difference.
 */
export type SegmentDiffRow = {
  /** Matches `segmentKey` on the client, so a row can be found from a line. */
  key: string;
  change: "added" | "removed" | "changed" | "same";
  start: number;
  before?: string;
  after?: string;
};

/**
 * A line's identity: its start time, plus which one it is if several share it.
 *
 * Start time alone is nearly enough — segments come from the same audio, so it
 * identifies a line far better than its position, and a reviewer rewording
 * line 400 reads as one change rather than 481 lines shifting by one. But
 * whisper does emit repeats: four of the 141 transcripts to hand have two
 * segments starting on the same tenth of a second. Keyed on time alone those
 * collapse into one, and a line silently disappears from the diff.
 */
export function segmentKey(start: number, occurrence: number) {
  return `${start}:${occurrence}`;
}

function keyed(segments: TranscriptSegment[]) {
  const seen = new Map<number, number>();
  return segments.map((s) => {
    const n = seen.get(s.start) ?? 0;
    seen.set(s.start, n + 1);
    return { key: segmentKey(s.start, n), start: s.start, text: s.text };
  });
}

/** Line up two transcripts, so the difference between them can be read. */
export function diffSegments(
  before: TranscriptSegment[],
  after: TranscriptSegment[],
): SegmentDiffRow[] {
  const beforeByKey = new Map(keyed(before).map((s) => [s.key, s]));
  const afterByKey = new Map(keyed(after).map((s) => [s.key, s]));
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])];

  const rows = keys.map((key) => {
    const b = beforeByKey.get(key);
    const a = afterByKey.get(key);
    const start = (b ?? a)!.start;
    if (!b) return { key, change: "added" as const, start, after: a!.text };
    if (!a) return { key, change: "removed" as const, start, before: b.text };
    return {
      key,
      change: b.text === a.text ? ("same" as const) : ("changed" as const),
      start,
      before: b.text,
      after: a.text,
    };
  });

  return rows.sort((x, y) => x.start - y.start || x.key.localeCompare(y.key));
}

export async function getEditRequest(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return null;
  const request = await editRequestsCollection(db).findOne({ _id: new ObjectId(id) });
  if (!request) return null;

  const current = await transcriptsCollection(db).findOne(
    { _id: request.episodeId },
    { projection: { revision: 1, segments: 1, publishedAt: 1 } },
  );

  const [summary] = await summarise(db, [request]);
  const diff = current ? diffSegments(current.segments, request.proposal.segments) : null;

  return {
    ...summary,
    source: request.source,
    proposal: request.proposal,
    evidence: request.evidence,
    current: current
      ? {
          revision: current.revision,
          publishedAt: current.publishedAt.toISOString(),
          lines: current.segments.length,
        }
      : null,
    diff,
  };
}

// ---------------------------------------------------------------------------
// reviewing and applying
// ---------------------------------------------------------------------------

export async function updateEditRequest(
  db: Db,
  id: string,
  patch: { segments?: TranscriptSegment[]; note?: string; status?: EditRequestStatus },
) {
  const _id = new ObjectId(id);
  const request = await editRequestsCollection(db).findOne({ _id });
  if (!request) throw new Error("no such edit request");
  if (request.status === "applied" && patch.segments) {
    throw new Error("this request has already been applied");
  }

  const set: Partial<DBEditRequest> = { updatedAt: new Date() };
  if (patch.segments) {
    set.proposal = {
      ...request.proposal,
      segments: patch.segments
        .filter((s) => s.text.trim().length > 0)
        .sort((a, b) => a.start - b.start),
    };
    set.edited = true;
  }
  if (patch.note !== undefined) set.note = patch.note.slice(0, 2000);
  if (patch.status !== undefined) {
    // Applying is its own operation — it writes to the episode, and letting a
    // status field do that quietly would make it possible to publish by
    // accident from a form meant for notes.
    if (patch.status === "applied") throw new Error("use apply to apply");
    set.status = patch.status;
    set.decidedAt = new Date();
  }

  await editRequestsCollection(db).updateOne({ _id }, { $set: set });
  return getEditRequest(db, id);
}

export async function applyEditRequest(db: Db, id: string) {
  const _id = new ObjectId(id);
  const request = await editRequestsCollection(db).findOne({ _id });
  if (!request) throw new Error("no such edit request");
  if (request.status === "applied") throw new Error("already applied");

  const result = await publishTranscript(db, {
    episodeId: request.episodeId.toString(),
    segments: request.proposal.segments,
    durationS: request.proposal.durationS,
    model: request.proposal.model,
    pipeline: request.proposal.pipeline,
  });

  const now = new Date();
  await editRequestsCollection(db).updateOne(
    { _id },
    {
      $set: {
        status: "applied",
        decidedAt: now,
        updatedAt: now,
        applied: { at: now, revision: result.revision, segments: result.segments },
      },
    },
  );

  return { id, ...result };
}

/**
 * Apply everything still open in a batch.
 *
 * One at a time, and a failure stops nothing else: these are independent
 * episodes, and half a batch applied with a clear account of what didn't is
 * more useful than an all-or-nothing that leaves you guessing.
 */
export async function applyBatch(db: Db, batchId: string) {
  const open = await editRequestsCollection(db)
    .find({ batchId, status: "open" }, { projection: { _id: 1 } })
    .toArray();

  const applied: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const { _id } of open) {
    try {
      await applyEditRequest(db, _id.toString());
      applied.push(_id.toString());
    } catch (err) {
      failed.push({ id: _id.toString(), error: String((err as Error).message ?? err) });
    }
  }
  return { batchId, applied: applied.length, failed };
}

// ---------------------------------------------------------------------------
// the reviewer's tools
// ---------------------------------------------------------------------------

type TracklistEntry = { name: string; artist: string; timestamp?: number };

/** The track a tracklist says was playing at `at`: the last one to have started. */
function trackAt(tracks: TracklistEntry[] | undefined, at: number) {
  let best: TracklistEntry | null = null;
  for (const t of tracks ?? []) {
    if (t.timestamp == null || t.timestamp > at) continue;
    if (!best || t.timestamp > (best.timestamp ?? 0)) best = t;
  }
  return best;
}

export type PlayingGuess = {
  artist: string;
  name: string;
  startedAt: number;
  /** Where the guess came from, in words: a source you can weigh. */
  via: string;
};

/**
 * What was playing at a moment in the episode, as best anyone can tell.
 *
 * The hard part of reviewing one of these is not typos, it is the stretches
 * where a record was transcribed as if it were speech. Naming the record is
 * what makes the transcript worth reading, and there are three ways to get at
 * it — this episode's own tracklist, an episode sharing the same audio whose
 * tracklist does name it, and other transcripts where the same lyric was
 * misheard the same way. None is authoritative; together they are usually
 * enough to recognise it.
 */
export async function editRequestHint(db: Db, id: string, at: number) {
  if (!ObjectId.isValid(id)) return null;
  const request = await editRequestsCollection(db).findOne({ _id: new ObjectId(id) });
  if (!request) return null;

  const episodes = db.collection<{ name: string; tracks?: TracklistEntry[] }>("tracksOld");
  const spans = (request.evidence.sharedAudio ?? []).filter(
    (s) => at >= s.from && at <= s.to,
  );

  const [self, others] = await Promise.all([
    episodes.findOne({ _id: request.episodeId }, { projection: { tracks: 1 } }),
    spans.length
      ? episodes
          .find(
            {
              _id: {
                $in: spans
                  .filter((s) => ObjectId.isValid(s.otherEpisodeId))
                  .map((s) => new ObjectId(s.otherEpisodeId)),
              },
            },
            { projection: { name: 1, tracks: 1 } },
          )
          .toArray()
      : Promise.resolve([]),
  ]);

  const guesses: PlayingGuess[] = [];

  const own = trackAt(self?.tracks, at);
  if (own) {
    guesses.push({
      artist: own.artist,
      name: own.name,
      startedAt: own.timestamp ?? 0,
      via: "this episode's tracklist",
    });
  }

  const othersById = new Map(others.map((e) => [e._id.toString(), e]));
  // Strongest match first: votes is how much audio actually lined up.
  for (const span of [...spans].sort((a, b) => b.votes - a.votes)) {
    const other = othersById.get(span.otherEpisodeId);
    if (!other) continue;
    // The same instant in the other episode's timeline, scaled by tempo so a
    // match against a faster or slower play still lands in the right place.
    const otherAt = span.otherFrom + (at - span.from) / (span.tempo || 1);
    const track = trackAt(other.tracks, otherAt);
    if (!track) continue;
    const how = [`${other.name} at ${Math.round(otherAt)}s`];
    if (span.semitones) how.push(`${span.semitones > 0 ? "+" : ""}${span.semitones} semitones`);
    if (span.tempo !== 1) how.push(`${span.tempo.toFixed(2)}× tempo`);
    guesses.push({
      artist: track.artist,
      name: track.name,
      startedAt: track.timestamp ?? 0,
      via: `same audio · ${how.join(" · ")}`,
    });
  }

  // The line as it currently reads, so the search follows a reviewer's edits.
  const line = request.proposal.segments.find((s) => s.start === at);
  const echoes = line
    ? (await searchTranscripts(db, line.text, { episodeLimit: 8 })).filter(
        (h) => h.episodeId !== request.episodeId.toString(),
      )
    : [];

  return { at, text: line?.text ?? "", guesses, echoes };
}
