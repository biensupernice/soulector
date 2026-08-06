import { ReactNode, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Sheet } from "react-modal-sheet";
import { Drawer } from "vaul";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
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
          <div className="relative shrink-0 pt-3 pb-1" />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ---------------------------------------------------------------------------

/** Close if dragged past a quarter of the way, or flicked hard enough. */
const DISMISS_OFFSET_RATIO = 0.25;
const DISMISS_VELOCITY = 500;

/**
 * Hand-rolled on motion, for the one thing neither library gives us: a real
 * spring that inherits the velocity of your finger, so a flick snaps shut fast
 * and a slow drag eases back.
 *
 * Dragging is only armed while the content is scrolled to the top, which is
 * how iOS decides between scrolling the sheet and moving it.
 */
export function SpringSheet({ isOpen, onClose, children }: SheetShellProps) {
  const y = useMotionValue(0);
  const [height, setHeight] = useState(0);
  const [atTop, setAtTop] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheetRef.current) return;
    setHeight(sheetRef.current.offsetHeight);
  }, [isOpen]);

  const backdropOpacity = useTransform(y, [0, Math.max(height, 1)], [1, 0]);
  // 1 when the sheet is fully up, 0 when it's off the bottom.
  const presented = useTransform(y, [Math.max(height, 1), 0], [0, 1]);

  // The sheet is closed by unmounting, so reset the offset it was left at.
  useEffect(() => {
    if (isOpen) y.set(0);
  }, [isOpen, y]);

  // The page behind recedes as the card comes up, and follows your finger back
  // when you drag it down — the other two variants get this from their library,
  // so this one has to earn it to be judged fairly.
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            style={{ opacity: backdropOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-2xl flex-col",
              "h-[96%] rounded-t-2xl bg-accent",
            )}
            style={{ y }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 38,
              mass: 0.9,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            // Almost no give upward — iOS sheets feel pinned at the top — and
            // a soft pull downward.
            dragElastic={{ top: 0.02, bottom: 0.6 }}
            dragListener={atTop}
            onDragEnd={(_, info) => {
              const draggedFarEnough =
                info.offset.y > height * DISMISS_OFFSET_RATIO;
              const flickedShut = info.velocity.y > DISMISS_VELOCITY;
              if (draggedFarEnough || flickedShut) onClose();
            }}
          >
            <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-gray-700/30 to-white/5" />
            <div className="relative shrink-0 pt-3 pb-1" />
            <div
              ref={scrollRef}
              onScroll={(event) => setAtTop(event.currentTarget.scrollTop <= 0)}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
