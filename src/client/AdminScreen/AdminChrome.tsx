import { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * The furniture the admin screens share.
 *
 * All of it exists so the screens themselves can be about their subject. The
 * page frame is one component because every screen here is the same shape —
 * a title, somewhere to go back to, an action or two — and a review of a
 * transcript needs the full width of the page just as much as the dashboard
 * does, which is what it was not getting when it lived inside a card.
 */

export const timeAgo = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true });

export function AdminPage({
  title,
  subtitle,
  back,
  actions,
  onSignOut,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Sticky, because these pages are long and the way back should not
          require scrolling to the top to find it. */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/85 backdrop-blur pt-safe-top">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {back ? (
            <button
              onClick={back.onClick}
              className="-ml-1 mb-1 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              <span aria-hidden>‹</span>
              {back.label}
            </button>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className={cn(
                  "truncate font-bold tracking-tight",
                  back ? "text-lg" : "text-2xl",
                )}
              >
                {title}
              </h1>
              {subtitle ? (
                <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {onSignOut ? (
                <button
                  onClick={onSignOut}
                  className="text-sm text-gray-400 underline underline-offset-4 hover:text-gray-700"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-24">
        {children}
      </main>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "good" | "attention" | "bad";

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-gray-900",
  good: "bg-emerald-600",
  attention: "bg-amber-500",
  bad: "bg-rose-600",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-gray-900",
  good: "text-emerald-700",
  attention: "text-amber-700",
  bad: "text-rose-700",
};

/**
 * One number, what it is out of, and the thing you would do about it.
 *
 * The action belongs on the card rather than in a row of buttons underneath:
 * the reason to run a sync is almost always something you just read, and
 * putting a gap between the reading and the doing is how a dashboard turns
 * into a wall of figures nobody acts on.
 */
export function StatCard({
  label,
  value,
  unit,
  detail,
  progress,
  tone = "neutral",
  action,
}: {
  label: string;
  value: number | string;
  unit?: string;
  detail?: ReactNode;
  progress?: { done: number; total: number };
  tone?: Tone;
  action?: ReactNode;
}) {
  const share =
    progress && progress.total > 0
      ? shareLabel(progress.done, progress.total)
      : null;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            TONE_TEXT[tone],
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-sm text-gray-400">{unit}</span> : null}
      </div>

      {progress ? (
        <div className="mt-2.5">
          <CoverageBar done={progress.done} total={progress.total} tone={tone} />
          <div className="mt-1 text-xs tabular-nums text-gray-500">
            {share} of {progress.total.toLocaleString()}
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="mt-2 text-sm leading-snug text-gray-600">{detail}</div>
      ) : null}

      {action ? <div className="mt-auto pt-3">{action}</div> : null}
    </div>
  );
}

function shareLabel(done: number, total: number) {
  const pct = (done / total) * 100;
  if (done > 0 && pct < 1) return "<1%";
  if (done < total && pct > 99) return ">99%";
  return `${Math.round(pct)}%`;
}

export function CoverageBar({
  done,
  total,
  tone = "neutral",
}: {
  done: number;
  total: number;
  tone?: Tone;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn("h-full rounded-full transition-[width]", TONE_BAR[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Button({
  onClick,
  children,
  variant = "primary",
  disabled,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40",
        variant === "primary" && "bg-gray-900 text-white hover:bg-gray-700",
        variant === "secondary" &&
          "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
        variant === "quiet" && "text-gray-500 hover:text-gray-900",
        variant === "danger" &&
          "bg-emerald-700 text-white hover:bg-emerald-600",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-gray-100 text-gray-600",
        tone === "good" && "bg-emerald-100 text-emerald-800",
        tone === "attention" && "bg-amber-100 text-amber-800",
        tone === "bad" && "bg-rose-100 text-rose-700",
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        tone === "good" && "bg-emerald-500",
        tone === "attention" && "bg-amber-500",
        tone === "bad" && "bg-rose-500",
        tone === "neutral" && "bg-gray-300",
      )}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}
