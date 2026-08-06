import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { Sheet } from "react-modal-sheet";
import { Drawer } from "vaul";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Three ways to hang the episode sheet, so they can be felt against each
 * other on a real phone. The winner stays and this file goes.
 *
 * What we're chasing is the iOS sheet: `.presentationDetents([.large])` with
 * no grabber, a spring that carries the speed of your flick, and the page
 * behind scaling away as the card comes up.
 */
export type SheetVariant = "tuned" | "vaul" | "spring";

export const SHEET_VARIANTS: {
  id: SheetVariant;
  name: string;
  note: string;
}[] = [
  {
    id: "tuned",
    name: "Tuned",
    note: "react-modal-sheet, iOS easing curve",
  },
  { id: "vaul", name: "Vaul", note: "shadcn's drawer lib" },
  { id: "spring", name: "Spring", note: "hand-rolled, real physics" },
];

const STORAGE_KEY = "soulector:sheet-variant";

interface SheetVariantStore {
  variant: SheetVariant;
  setVariant: (variant: SheetVariant) => void;
  loadPersisted: () => void;
}

export const useSheetVariantStore = create<SheetVariantStore>()((set) => ({
  variant: "tuned",
  setVariant: (variant) => {
    set({ variant });
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
      // Private mode — the choice just won't survive a reload.
    }
  },
  loadPersisted: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SheetVariant | null;
      if (stored && SHEET_VARIANTS.some((v) => v.id === stored)) {
        set({ variant: stored });
      }
    } catch {
      // ignore
    }
  },
}));

export type SheetShellProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** The curve iOS presents sheets on, and vaul's default. */
const IOS_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

/**
 * The element that scales away behind the sheet. Both react-modal-sheet and
 * vaul drive this effect themselves, they just need to be told what to grab.
 */
export const SHEET_BACKGROUND_ID = "app-root";

// ---------------------------------------------------------------------------

/**
 * The library we already had, pushed as far as it goes: iOS's easing instead
 * of a 200ms easeOut, and the background scale effect switched on.
 *
 * Its ceiling is that v5 hardcodes `type: "tween"`, so a hard flick settles at
 * exactly the same speed as a slow drag — the one thing a spring gets right.
 */
export function TunedSheet({ isOpen, onClose, children }: SheetShellProps) {
  return (
    <Sheet
      className="full-height-sheet mx-auto w-full max-w-2xl"
      isOpen={isOpen}
      onClose={onClose}
      tweenConfig={{ ease: IOS_EASE, duration: 0.5 }}
      dragCloseThreshold={0.25}
      dragVelocityThreshold={400}
      modalEffectRootId={SHEET_BACKGROUND_ID}
    >
      <Sheet.Container>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-700/30 to-white/5"></div>
        <Sheet.Header />
        <Sheet.Content>{children}</Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

/**
 * vaul, which exists specifically to make a web drawer feel like an iOS sheet:
 * rubber-band resistance, velocity-based dismissal, and the background scale
 * as a first-class prop.
 */
export function VaulSheet({ isOpen, onClose, children }: SheetShellProps) {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-2xl flex-col",
            "h-[96%] rounded-t-2xl bg-accent outline-none",
          )}
        >
          <Drawer.Title className="sr-only">Episode</Drawer.Title>
          <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-gray-700/30 to-white/5" />
          {/* vaul drags from any non-scrollable area; this is the grab zone
              that stands in for the sheet header. */}
          {/* The grab zone. iOS hides the grabber on this sheet, so this is
              bare — but vaul needs a non-scrolling area to drag from. */}
          <div className="relative shrink-0 pt-3 pb-1" />
          <div className="relative min-h-0 flex-1 overflow-hidden pb-safe-bottom">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ---------------------------------------------------------------------------

/**
 * The numbers react-modal-sheet 1.8.1 shipped with — the build this app felt
 * right on. Light mass is what makes it snap rather than glide.
 */
const V1_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.2,
};
const DRAG_CLOSE_THRESHOLD = 0.6;
const DRAG_VELOCITY_THRESHOLD = 500;

/**
 * The old library's sheet, rebuilt on motion directly.
 *
 * The part that matters, and the part the first attempt at this got wrong:
 * framer's own drag is switched *off* as a mover — `dragElastic: 0`, both
 * constraints pinned to 0, no momentum — and `y` is driven by hand instead.
 * Letting framer move the element means it damps the offset toward the
 * constraint, so a real drag never reaches the dismiss threshold and the sheet
 * just rubber-bands. Setting `y` ourselves keeps the finger and the sheet on
 * exactly the same pixel.
 *
 * On release the spring animates `y` to its resting place, picking up the
 * motion value's current velocity, which is what carries a flick through.
 */
export function SpringSheet({ isOpen, onClose, children }: SheetShellProps) {
  const y = useMotionValue(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const [atTop, setAtTop] = useState(true);
  // `document` isn't there while rendering on the server.
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const measure = () => setWindowHeight(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const backdropOpacity = useTransform(
    y,
    [0, Math.max(windowHeight, 1)],
    [1, 0],
  );
  const presented = useTransform(y, [Math.max(windowHeight, 1), 0], [0, 1]);

  // Deliberately no "reset y on open": AnimatePresence remounts the card each
  // time, so `initial` puts it off the bottom and the spring brings it up.
  // Forcing y to its resting place here would land the sheet before it had a
  // chance to animate at all.

  // The page behind recedes as the card comes up, and follows your finger back
  // when you drag it down.
  useEffect(() => {
    const root = document.getElementById(SHEET_BACKGROUND_ID);
    if (!root || !isOpen) return;

    const previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "black";
    root.style.transformOrigin = "top";
    root.style.overflow = "hidden";
    root.style.willChange = "transform";

    const unsubscribe = presented.on("change", (p) => {
      const eased = Math.max(0, Math.min(1, p));
      root.style.transform = `scale(${1 - 0.067 * eased}) translateY(${eased * 14}px)`;
      root.style.borderRadius = `${eased * 12}px`;
    });

    return () => {
      unsubscribe();
      root.style.transform = "";
      root.style.borderRadius = "";
      root.style.overflow = "";
      root.style.willChange = "";
      root.style.transformOrigin = "";
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [presented, isOpen]);

  // Framer must not move the sheet itself; it only reports the gesture.
  const dragProps = {
    drag: "y" as const,
    dragElastic: 0,
    dragConstraints: { top: 0, bottom: 0 },
    dragMomentum: false,
    onDrag: (_: unknown, info: PanInfo) => {
      // Clamped at 0 so the sheet cannot be pulled above its resting place.
      y.set(Math.max(y.get() + info.delta.y, 0));
    },
    onDragEnd: (_: unknown, info: PanInfo) => {
      if (info.velocity.y > DRAG_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      const sheetHeight =
        sheetRef.current?.getBoundingClientRect().height ?? windowHeight;
      const draggedPast =
        sheetHeight > 0 && y.get() / sheetHeight > DRAG_CLOSE_THRESHOLD;
      animate(y, draggedPast ? sheetHeight : 0, V1_SPRING);
      if (draggedPast) onClose();
    },
  };

  // The card has to live outside the element being scaled. A transformed
  // ancestor becomes the containing block for `position: fixed`, so rendering
  // in place meant the sheet was scaled and clipped along with the page behind
  // it — which is what made this variant look broken. Both libraries portal
  // out to the body for the same reason.
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-2xl flex-col",
              "h-[96%] rounded-t-2xl bg-accent",
            )}
            style={{ y }}
            // Pixels, not "100%": `y` is a motion value the drag also writes
            // to, and a percentage string cannot be reconciled with it.
            initial={{ y: windowHeight }}
            animate={{ y: 0, transition: V1_SPRING }}
            exit={{ y: windowHeight, transition: V1_SPRING }}
          >
            <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-gray-700/30 to-white/5" />
            {/* The grab handle area always drags. */}
            <motion.div className="relative shrink-0 pt-3 pb-1" {...dragProps}>
              <div className="mx-auto h-1 w-9 rounded-full bg-white/25" />
            </motion.div>
            {/* The body drags only when it has no scrolling left to give,
                which is how iOS chooses between scrolling and moving. */}
            <motion.div
              onScroll={(event) =>
                setAtTop((event.target as HTMLDivElement).scrollTop <= 0)
              }
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe-bottom"
              {...(atTop ? dragProps : {})}
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

/** Cycles the sheet implementation from inside the sheet being judged. */
export function SheetVariantSwitcher() {
  const variant = useSheetVariantStore((s) => s.variant);
  const setVariant = useSheetVariantStore((s) => s.setVariant);
  const current = SHEET_VARIANTS.find((v) => v.id === variant);

  return (
    <div className="flex w-full items-center justify-center gap-1 px-4">
      {SHEET_VARIANTS.map((v) => (
        <button
          key={v.id}
          onClick={() => setVariant(v.id)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
            v.id === variant
              ? "bg-white text-black"
              : "bg-white/15 text-white/70",
          )}
        >
          {v.name}
        </button>
      ))}
      <span className="ml-1 text-[10px] text-white/40">{current?.note}</span>
    </div>
  );
}
