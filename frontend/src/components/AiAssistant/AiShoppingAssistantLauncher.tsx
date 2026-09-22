import React, { useState, Suspense } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sparkles, X, Loader2 } from "lucide-react";

// Lazy-load the chat panel chunk on demand to guarantee zero bundle bloat and zero LCP regression
const AiChatPanel = React.lazy(() => import("./AiChatPanel"));

function AiLoadingFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full w-full bg-[#fffaf2] p-6 items-center justify-center text-center space-y-3">
      <div className="relative">
        <div className="h-12 w-12 rounded-full bg-amber-100 border border-amber-300 grid place-items-center">
          <Sparkles className="h-6 w-6 text-amber-700 animate-pulse" />
        </div>
        <Loader2 className="h-14 w-14 text-amber-600/40 animate-spin absolute -inset-1" />
      </div>
      <div>
        <p className="font-serif font-bold text-stone-900 text-sm">
          Connecting to Shri Radha Govind Assistant...
        </p>
        <p className="text-[11px] text-stone-500 mt-0.5">
          Loading sacred catalogue & store guidance
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-xs text-stone-400 hover:text-stone-700 underline pt-2"
      >
        Cancel
      </button>
    </div>
  );
}

export function AiShoppingAssistantLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Hide AI Assistant inside admin area
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      {/* Compact Circular Floating AI Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 group grid place-items-center h-[52px] w-[52px] sm:h-14 sm:w-14 rounded-full bg-gradient-to-r from-[#5a1a24] via-[#752431] to-[#5a1a24] text-white border border-[#e4c895]/80 shadow-[0_8px_24px_-6px_rgba(90,26,36,0.6)] hover:shadow-[0_12px_28px_-6px_rgba(90,26,36,0.8)] transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          aria-label="Open Shri Radha Govind Assistant"
          title="Open Shri Radha Govind Assistant"
        >
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 border border-[#5a1a24]" />
          </span>
          <Sparkles className="h-6 w-6 text-amber-300 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
        </button>
      )}

      {/* When open, mount the lazy-loaded chat panel */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Chat Container: Bottom sheet on mobile, floating docked window on desktop */}
          <div className="fixed z-50 inset-x-0 bottom-0 max-h-[90vh] h-[86vh] sm:h-[580px] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[410px] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#e4c895] overflow-hidden flex flex-col transition-all duration-300 ease-out">
            <Suspense fallback={<AiLoadingFallback onClose={() => setIsOpen(false)} />}>
              <AiChatPanel onClose={() => setIsOpen(false)} />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}
