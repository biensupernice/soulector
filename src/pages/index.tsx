import { useState } from "react";
import TracksScreen from "@/client/TracksScreen";
import { useShortcutHandlers } from "@/client/useKeyboardHandlers";
import Navbar from "@/client/TracksScreen/Navbar";
import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  useShortcutHandlers();

  let [open, setOpen] = useState(true);

  return (
    <div className="text-gray-900 h-full w-full">
      <div className="pt-safe-top h-15 fixed top-0 w-full bg-white shadow-md z-10">
        <div className="w-full">
          <button className="mt-safe-top" onClick={() => setOpen(true)}>
            Open
          </button>
        </div>
        <Navbar
          searchText={searchText}
          onSearchChange={setSearchText}
          onSearchClose={() => setSearchText("")}
        />
      </div>
      <TracksScreen searchText={searchText} />
      <AnimatePresence>
        {open && <TrackOptionsModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

interface TrackOptionsModalProps {
  onClose: () => void;
}
function TrackOptionsModal({ onClose }: TrackOptionsModalProps) {
  return (
    <Modal onClose={onClose}>
      <div className="mt-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 fill-current text-gray-600"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm6.5 8.778l-3 3.444-3-3.444 1.5-1.5 2.121 2.121 4.722-4.719 1.5 1.5z" />
            </svg>
          </div>
          <div className="ml-2">
            <h4 className="text-sm font-medium text-gray-600">
              Add to Favorites
            </h4>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ onClose, children }: ModalProps) {
  return (
    <Dialog className="fixed inset-0 z-20" onClose={onClose} open={true}>
      <div className="flex flex-col justify-center h-full pt-4 text-center sm:block sm:p-0">
        <Dialog.Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: 0.4, ease: [0.36, 0.66, 0.04, 1] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.3, ease: [0.36, 0.66, 0.04, 1] },
          }}
          className="fixed inset-0 bg-black/40"
        />

        <motion.div
          initial={{ y: "100%" }}
          animate={{
            y: "50%",
            transition: { duration: 0.4, ease: [0.36, 0.66, 0.04, 1] },
          }}
          exit={{
            y: "100%",
            transition: { duration: 0.3, ease: [0.36, 0.66, 0.04, 1] },
          }}
          className="z-0 flex flex-col w-full h-1/2 bg-white rounded-t-lg shadow-xl"
        >
          {children}
        </motion.div>
      </div>
    </Dialog>
  );
}
