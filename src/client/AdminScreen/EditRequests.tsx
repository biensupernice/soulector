import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import {
  LOW_CONFIDENCE_LOGPROB,
  LOW_CONFIDENCE_MIN_WORDS,
} from "@/lib/transcriptConfidence";
import { formatTimeSecs } from "@/client/helpers";
import {
  AdminPage,
  Button,
  Card,
  Empty,
  Pill,
  Tone,
  timeAgo,
} from "./AdminChrome";

/**
 * Reviewing proposed changes to episodes.
 *
 * The shape is borrowed from a pull request, and only the shape: a batch of
 * related changes arrives together, you skim what each one would do, open the
 * ones that need attention, fix them in place, and apply the batch. There is
 * no branching, no merging and no conflict — episodes are independent, and a
 * proposal either becomes the episode's data or it doesn't.
 *
 * Each of the three levels is a whole page. A transcript is two hours of
 * speech and the evidence panel is a second column beside it; that does not
 * belong in a card on a dashboard, and cramming it into one was the difference
 * between a screen you can work in and a screen you tolerate.
 */

const STATUS_TONE: Record<string, Tone> = {
  open: "attention",
  applied: "good",
  rejected: "neutral",
};

export function EditRequestsScreen() {
  const router = useRouter();
  const batchId = typeof router.query.batch === "string" ? router.query.batch : null;
  const requestId =
    typeof router.query.request === "string" ? router.query.request : null;

  /**
   * Where you are lives in the URL, not in component state.
   *
   * Reviewing is done in long sittings, often on a phone, and anything that
   * remounts this — a reload, a dropped connection, the back button — would
   * otherwise drop you at the top of the batch list having lost the change you
   * were three hundred lines into. Shallow, because this is one screen rather
   * than three pages, and the page's own data should not be refetched to move
   * between them.
   */
  const go = (query: Record<string, string>) =>
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });

  if (requestId) {
    return (
      <RequestView
        id={requestId}
        onBack={() => go(batchId ? { batch: batchId } : { review: "1" })}
      />
    );
  }
  if (batchId) {
    return (
      <BatchView
        batchId={batchId}
        onBack={() => go({ review: "1" })}
        onOpen={(id) => go({ batch: batchId, request: id })}
      />
    );
  }
  return (
    <BatchList
      onBack={() => go({})}
      onOpen={(id) => go({ batch: id })}
    />
  );
}

// ---------------------------------------------------------------------------

function BatchList({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (batchId: string) => void;
}) {
  const batches = trpc["admin.editRequestBatches"].useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <AdminPage
      title="Edit requests"
      back={{ label: "Admin", onClick: onBack }}
    >
      <Card padded={false}>
        {batches.isPending ? (
          <div className="p-4">
            <Empty>Loading…</Empty>
          </div>
        ) : !batches.data || batches.data.length === 0 ? (
          <div className="p-4">
            <Empty>
              Nothing submitted yet. Batches are prepared and sent from the
              pipeline.
            </Empty>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {batches.data.map((batch) => (
              <li key={batch.batchId}>
                <button
                  onClick={() => onOpen(batch.batchId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{batch.batchLabel}</div>
                    <div className="mt-0.5 text-sm text-gray-500">
                      {batch.total} {batch.total === 1 ? "change" : "changes"}
                      {batch.counts.applied > 0
                        ? ` · ${batch.counts.applied} applied`
                        : ""}
                      {batch.counts.rejected > 0
                        ? ` · ${batch.counts.rejected} rejected`
                        : ""}
                      {" · "}
                      {batch.source} · {timeAgo(batch.submittedAt)}
                    </div>
                  </div>
                  {batch.counts.open > 0 ? (
                    <Pill tone="attention">{batch.counts.open} waiting</Pill>
                  ) : (
                    <Pill tone="good">done</Pill>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}

/** What this change would do, in a line you can read without opening it. */
function changeSummary(r: {
  status: "open" | "applied" | "rejected";
  appliedRevision: number | null;
  replaces: { revision: number; lines: number } | null;
  changes: { added: number; removed: number; changed: number } | null;
  lines: number;
  durationS: number;
  langs: string[];
}) {
  // Once applied, the proposal and what is live are the same thing, so
  // describing the difference between them would only ever say "none".
  if (r.status === "applied") {
    return `Applied · ${r.lines} lines${
      r.appliedRevision ? ` · now revision ${r.appliedRevision}` : ""
    }`;
  }
  if (r.status === "rejected") return `Rejected · ${r.lines} lines, not published`;

  if (!r.replaces) {
    return `Adds a transcript · ${r.lines} lines · ${formatTimeSecs(r.durationS)}${
      r.langs.length > 1 ? ` · ${r.langs.slice(0, 3).join(", ")}` : ""
    }`;
  }
  const c = r.changes;
  if (!c || (c.added === 0 && c.removed === 0 && c.changed === 0)) {
    return "No change from the transcript already published";
  }
  const parts = [];
  if (c.added) parts.push(`${c.added} new`);
  if (c.removed) parts.push(`${c.removed} gone`);
  if (c.changed) parts.push(`${c.changed} reworded`);
  return `Replaces the current transcript · ${parts.join(", ")}`;
}

function BatchView({
  batchId,
  onBack,
  onOpen,
}: {
  batchId: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const requests = trpc["admin.editRequests"].useQuery(
    { batchId },
    { refetchOnWindowFocus: false },
  );
  const applyAll = trpc["admin.applyEditRequestBatch"].useMutation({
    onSettled: () => {
      utils["admin.editRequests"].invalidate();
      utils["admin.editRequestBatches"].invalidate();
      utils["admin.syncStatus"].invalidate();
    },
  });

  const rows = requests.data ?? [];
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <AdminPage
      title={rows[0]?.batchLabel ?? "Batch"}
      subtitle={
        rows.length
          ? `${rows.length} ${rows.length === 1 ? "change" : "changes"}${openCount ? ` · ${openCount} waiting` : " · all decided"}`
          : undefined
      }
      back={{ label: "Edit requests", onClick: onBack }}
      actions={
        openCount > 0 ? (
          <Button
            onClick={() => {
              if (
                confirm(
                  `Apply ${openCount} ${openCount === 1 ? "change" : "changes"} to the live episodes?`,
                )
              ) {
                applyAll.mutate({ batchId });
              }
            }}
            disabled={applyAll.isPending}
          >
            {applyAll.isPending ? "Applying…" : `Apply all ${openCount}`}
          </Button>
        ) : null
      }
    >
      {applyAll.data && applyAll.data.failed.length > 0 ? (
        <Card>
          <p className="text-sm text-rose-600">
            {applyAll.data.applied} applied, {applyAll.data.failed.length} failed:{" "}
            {applyAll.data.failed[0].error}
          </p>
        </Card>
      ) : null}

      <Card padded={false}>
        {requests.isPending ? (
          <div className="p-4">
            <Empty>Loading…</Empty>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <Empty>This batch is empty.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{r.episodeName}</span>
                    <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">
                    {changeSummary(r)}
                    {r.edited ? " · edited here" : ""}
                  </div>
                  {r.note ? (
                    <div className="mt-1 text-sm italic text-gray-500">
                      {r.note}
                    </div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}

// ---------------------------------------------------------------------------

type Line = { start: number; end: number; text: string; lang?: string; logprob?: number };

/**
 * The same identity the server's diff uses: start time, plus which one it is
 * when several lines share it. Whisper does repeat a timestamp now and then,
 * and everything here — the React key, the edit, the cut, the diff lookup —
 * would otherwise apply to the wrong line, or to several at once.
 */
function withKeys(lines: Line[]) {
  const seen = new Map<number, number>();
  return lines.map((line) => {
    const n = seen.get(line.start) ?? 0;
    seen.set(line.start, n + 1);
    return { ...line, key: `${line.start}:${n}` };
  });
}

const PAGE = 250;

function RequestView({ id, onBack }: { id: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const request = trpc["admin.editRequest"].useQuery(
    { id },
    { refetchOnWindowFocus: false },
  );

  const [draft, setDraft] = useState<Line[] | null>(null);
  const [cut, setCut] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [changesOnly, setChangesOnly] = useState(false);
  const [lowConfOnly, setLowConfOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => {
    utils["admin.editRequest"].invalidate({ id });
    utils["admin.editRequests"].invalidate();
    utils["admin.editRequestBatches"].invalidate();
    utils["admin.syncStatus"].invalidate();
  };

  const save = trpc["admin.updateEditRequest"].useMutation({
    onSuccess: () => {
      setDraft(null);
      setCut(new Set());
      refresh();
    },
  });
  const apply = trpc["admin.applyEditRequest"].useMutation({ onSettled: refresh });

  const data = request.data;
  const lines = useMemo(
    () => withKeys(draft ?? data?.proposal.segments ?? []),
    [draft, data?.proposal.segments],
  );

  /** Which lines the diff calls new or reworded, for marking and filtering. */
  const changedLines = useMemo(() => {
    const map = new Map<string, "added" | "changed">();
    for (const row of data?.diff ?? []) {
      if (row.change === "added" || row.change === "changed") {
        map.set(row.key, row.change);
      }
    }
    return map;
  }, [data?.diff]);

  const previousText = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.diff ?? []) {
      if (row.change === "changed" && row.before) map.set(row.key, row.before);
    }
    return map;
  }, [data?.diff]);

  /**
   * Which lines whisper itself was unsure of. The model reports an average
   * log-probability per segment, and the worst tenth of lines — the mishears,
   * the lyrics transcribed as speech — sit below it. Very short lines are
   * left out on purpose: their score is noise, and they were drowning the
   * filter in "Thank you." (see transcriptConfidence for the numbers).
   * Requests made before the number was carried through have none, and their
   * reviewers see nothing new.
   */
  const lowConfLines = useMemo(() => {
    const keys = new Set<string>();
    for (const l of lines) {
      if (
        l.logprob != null &&
        l.logprob < LOW_CONFIDENCE_LOGPROB &&
        l.text.split(/\s+/).filter(Boolean).length >= LOW_CONFIDENCE_MIN_WORDS
      ) {
        keys.add(l.key);
      }
    }
    return keys;
  }, [lines]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return lines.filter((l) => {
      if (changesOnly && !changedLines.has(l.key)) return false;
      if (lowConfOnly && !lowConfLines.has(l.key)) return false;
      if (needle && !l.text.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [lines, filter, changesOnly, lowConfOnly, changedLines, lowConfLines]);

  const dirty = draft !== null || cut.size > 0;

  function editLine(key: string, text: string) {
    setDraft(lines.map(({ key: k, ...line }) => (k === key ? { ...line, text } : line)));
  }

  function toggleCut(key: string) {
    setCut((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onSave() {
    const kept = lines.filter((l) => !cut.has(l.key)).map(({ key, ...line }) => line);
    save.mutate({ id, segments: kept });
  }

  if (request.isPending) {
    return (
      <AdminPage title="Loading…" back={{ label: "Back", onClick: onBack }}>
        <Empty>Loading the change…</Empty>
      </AdminPage>
    );
  }
  if (!data) {
    return (
      <AdminPage title="Not found" back={{ label: "Back", onClick: onBack }}>
        <Empty>That edit request no longer exists.</Empty>
      </AdminPage>
    );
  }

  const selectedLine = lines.find((l) => l.key === selected) ?? null;

  return (
    <AdminPage
      title={data.episodeName}
      subtitle={
        changeSummary(data) +
        (lowConfLines.size > 0
          ? ` · ${lowConfLines.size} ${lowConfLines.size === 1 ? "line" : "lines"} to check`
          : "")
      }
      back={{ label: "Batch", onClick: onBack }}
      actions={
        <>
          <Pill tone={STATUS_TONE[data.status]}>{data.status}</Pill>
          {data.status === "open" ? (
            <Button
              variant="danger"
              onClick={() => {
                if (dirty) {
                  alert("Save your edits first — applying publishes what is saved.");
                  return;
                }
                if (confirm("Apply this change to the live episode?")) {
                  apply.mutate({ id });
                }
              }}
              disabled={apply.isPending}
            >
              {apply.isPending ? "Applying…" : "Apply"}
            </Button>
          ) : null}
        </>
      }
    >
      <Card>
        <p className="text-sm text-gray-500">
          From {data.source} · submitted {timeAgo(data.submittedAt)}
          {data.current
            ? ` · replacing revision ${data.current.revision}`
            : " · nothing published yet"}
          {data.appliedRevision ? ` · now revision ${data.appliedRevision}` : ""}
        </p>

        <textarea
          value={note ?? data.note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== null && note !== data.note) save.mutate({ id, note });
          }}
          placeholder="Note — what you changed, what still needs checking"
          className="mt-3 w-full rounded-lg border border-gray-200 p-2 text-sm"
          rows={2}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save edits"}
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              if (dirty && !confirm("Discard your unsaved edits?")) return;
              setDraft(null);
              setCut(new Set());
            }}
          >
            Discard
          </Button>
          {dirty ? (
            <span className="text-sm font-medium text-amber-700">unsaved</span>
          ) : null}
          <span className="flex-1" />
          {data.status === "open" ? (
            <Button
              variant="secondary"
              onClick={() => save.mutate({ id, status: "rejected" })}
            >
              Reject
            </Button>
          ) : null}
        </div>

        {apply.isError ? (
          <p className="mt-2 text-sm text-rose-600">{apply.error.message}</p>
        ) : null}
        {save.isError ? (
          <p className="mt-2 text-sm text-rose-600">{save.error.message}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
            <input
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Find a line…"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
            {changedLines.size > 0 ? (
              <Button
                variant={changesOnly ? "primary" : "secondary"}
                onClick={() => {
                  setChangesOnly((v) => !v);
                  setShown(PAGE);
                }}
              >
                Changes only
              </Button>
            ) : null}
            {lowConfLines.size > 0 ? (
              <Button
                variant={lowConfOnly ? "primary" : "secondary"}
                onClick={() => {
                  setLowConfOnly((v) => !v);
                  setShown(PAGE);
                }}
              >
                Low confidence
              </Button>
            ) : null}
          </div>

          <ul className="divide-y divide-gray-50">
            {visible.slice(0, shown).map((line) => {
              const isCut = cut.has(line.key);
              const change = changedLines.get(line.key);
              return (
                <li
                  key={line.key}
                  className={cn(
                    "px-3 py-1.5",
                    isCut && "opacity-40",
                    selected === line.key && "bg-gray-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() =>
                        setSelected(selected === line.key ? null : line.key)
                      }
                      className={cn(
                        "w-14 shrink-0 pt-0.5 text-right text-xs tabular-nums",
                        selected === line.key
                          ? "font-semibold text-gray-900"
                          : "text-gray-400 hover:text-gray-700",
                      )}
                      title="What was playing here"
                    >
                      {formatTimeSecs(line.start)}
                    </button>

                    {change ? (
                      <span
                        className={cn(
                          "w-3 shrink-0 pt-0.5 text-center text-xs font-bold",
                          change === "added"
                            ? "text-emerald-600"
                            : "text-amber-600",
                        )}
                        title={change === "added" ? "new line" : "reworded"}
                      >
                        {change === "added" ? "+" : "~"}
                      </span>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}

                    {editing === line.key ? (
                      <input
                        autoFocus
                        defaultValue={line.text}
                        onBlur={(e) => {
                          editLine(line.key, e.target.value);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="min-w-0 flex-1 rounded border border-gray-900 px-1.5 py-0.5 text-sm"
                      />
                    ) : (
                      <button
                        onClick={() => setEditing(line.key)}
                        className={cn(
                          "min-w-0 flex-1 text-left text-sm leading-relaxed",
                          isCut && "line-through",
                        )}
                      >
                        {line.text}
                      </button>
                    )}

                    {lowConfLines.has(line.key) ? (
                      <span
                        className="shrink-0 self-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
                        title={`Whisper was unsure of this line and may have misheard it (confidence ${line.logprob?.toFixed(2)})`}
                      >
                        low
                      </span>
                    ) : null}

                    <button
                      onClick={() => toggleCut(line.key)}
                      className="shrink-0 px-1 text-sm text-gray-300 hover:text-rose-600"
                      title={isCut ? "keep this line" : "cut this line"}
                    >
                      {isCut ? "↩" : "×"}
                    </button>
                  </div>

                  {previousText.has(line.key) ? (
                    <div className="ml-16 mt-0.5 text-xs text-gray-400 line-through">
                      {previousText.get(line.key)}
                    </div>
                  ) : null}

                  {/* On a phone there is no second column, so the evidence
                      appears under the line you picked. Both instances share
                      one query, so this costs nothing but markup. */}
                  {selected === line.key ? (
                    <div className="ml-16 mt-2 lg:hidden">
                      <LineTools id={id} at={line.start} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {visible.length > shown ? (
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Show more · {shown} of {visible.length}
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 px-3 py-2 text-sm text-gray-400">
              {visible.length} of {lines.length} lines
            </div>
          )}
        </Card>

        <div className="hidden lg:sticky lg:top-24 lg:block">
          {selectedLine ? (
            <LineTools id={id} at={selectedLine.start} />
          ) : (
            <Card>
              <p className="text-sm text-gray-500">
                Pick a timestamp to see what was playing there, and where else
                those words turn up.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

/**
 * Everything known about one moment.
 *
 * The hard part of reviewing one of these is not typos, it is the stretches
 * where a record was transcribed as if it were speech. Naming the record is
 * what makes the transcript worth reading, and there are three ways at it:
 * this episode's tracklist, an episode sharing the same audio whose tracklist
 * does name it, and other transcripts where the same lyric was misheard the
 * same way. None is authoritative; together they are usually enough.
 */
function LineTools({ id, at }: { id: string; at: number }) {
  const hint = trpc["admin.editRequestHint"].useQuery(
    { id, at },
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
  );

  if (hint.isPending) {
    return (
      <Card>
        <p className="text-sm text-gray-400">Looking it up…</p>
      </Card>
    );
  }
  const data = hint.data;
  if (!data) return null;

  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {formatTimeSecs(data.at)} · what was playing
      </div>
      {data.text ? (
        <p className="mt-1 text-sm italic text-gray-500">“{data.text}”</p>
      ) : null}

      {data.guesses.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Nothing names this moment.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {data.guesses.map((g, i) => (
            <li key={i} className="rounded-lg bg-gray-50 p-2 text-sm">
              <span className="font-semibold">{g.artist}</span> — {g.name}
              <span className="mt-0.5 block text-xs text-gray-500">{g.via}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Same words elsewhere
      </div>
      {data.echoes.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">No other episode says this.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {data.echoes.slice(0, 6).map((e, i) => (
            <li key={i} className="text-sm text-gray-700">
              {e.text}
              <span className="mt-0.5 block text-xs text-gray-500">
                {e.episodeName} · {formatTimeSecs(e.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
