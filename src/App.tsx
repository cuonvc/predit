import React, { useState, useEffect } from "react";
import { TopBar } from "./components/topbar/TopBar";
import { AutoCaptionModal } from "./components/modals/AutoCaptionModal";
import { VideoPreviewCanvas } from "./components/preview/VideoPreviewCanvas";
import { TextStylePanel } from "./components/inspector/TextStylePanel";
import { MultiTrackTimeline } from "./components/timeline/MultiTrackTimeline";
import { ExportProgressModal } from "./components/modals/ExportProgressModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { useTimelineStore } from "./store/useTimelineStore";

type DragHandleType = "left" | "right" | "bottom" | null;

export const App: React.FC = () => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Resizable Pane Dimensions
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(320);
  const [timelineHeight, setTimelineHeight] = useState(275);
  const [activeDrag, setActiveDrag] = useState<DragHandleType>(null);

  // Global Spacebar shortcut to toggle video Play / Pause from anywhere
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      const { isPlaying, setIsPlaying } = useTimelineStore.getState();
      setIsPlaying(!isPlaying);
    };

    window.addEventListener("keydown", onGlobalKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onGlobalKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    const onMouseMove = (e: MouseEvent) => {
      if (activeDrag === "left") {
        const nextLeft = Math.max(240, Math.min(640, e.clientX - 4));
        setLeftWidth(nextLeft);
      } else if (activeDrag === "right") {
        const nextRight = Math.max(
          220,
          Math.min(540, window.innerWidth - e.clientX - 4)
        );
        setRightWidth(nextRight);
      } else if (activeDrag === "bottom") {
        const nextHeight = Math.max(
          160,
          Math.min(550, window.innerHeight - e.clientY)
        );
        setTimelineHeight(nextHeight);
      }
    };

    const onMouseUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeDrag]);

  return (
    <div
      className={`h-screen w-screen bg-[#0e0e10] text-zinc-200 flex flex-col overflow-hidden ${
        activeDrag === "left" || activeDrag === "right"
          ? "cursor-col-resize select-none"
          : activeDrag === "bottom"
          ? "cursor-row-resize select-none"
          : ""
      }`}
    >
      {/* 1. Top Window Header Bar */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* 2. Upper 3-Pane Resizable CapCut Workspace (Left Media | Center Player | Right Inspector) */}
      <div className="flex flex-1 min-h-0 p-1">
        {/* Left Media & Captions Pane */}
        <div
          style={{ width: `${leftWidth}px` }}
          className="h-full shrink-0 min-w-[240px]"
        >
          <AutoCaptionModal />
        </div>

        {/* Left <-> Center Vertical Resizer Handle */}
        <div
          onMouseDown={() => setActiveDrag("left")}
          title="Drag to resize Media panel"
          className={`w-1.5 mx-0.5 rounded cursor-col-resize transition-colors flex items-center justify-center group ${
            activeDrag === "left"
              ? "bg-[#00c8d2]"
              : "hover:bg-[#00c8d2]/60 bg-transparent"
          }`}
        >
          <div className="w-0.5 h-8 rounded bg-zinc-700 group-hover:bg-[#00c8d2]" />
        </div>

        {/* Center Video Preview Stage */}
        <div className="flex-1 h-full min-w-[280px]">
          <VideoPreviewCanvas />
        </div>

        {/* Center <-> Right Vertical Resizer Handle */}
        <div
          onMouseDown={() => setActiveDrag("right")}
          title="Drag to resize Inspector panel"
          className={`w-1.5 mx-0.5 rounded cursor-col-resize transition-colors flex items-center justify-center group ${
            activeDrag === "right"
              ? "bg-[#00c8d2]"
              : "hover:bg-[#00c8d2]/60 bg-transparent"
          }`}
        >
          <div className="w-0.5 h-8 rounded bg-zinc-700 group-hover:bg-[#00c8d2]" />
        </div>

        {/* Right Inspector & Properties Pane */}
        <div
          style={{ width: `${rightWidth}px` }}
          className="h-full shrink-0 min-w-[220px]"
        >
          <TextStylePanel />
        </div>
      </div>

      {/* Horizontal Resizer Handle between Upper Workspace & Lower Timeline */}
      <div
        onMouseDown={() => setActiveDrag("bottom")}
        title="Drag to resize Timeline height"
        className={`h-1.5 w-full cursor-row-resize transition-colors flex items-center justify-center group shrink-0 ${
          activeDrag === "bottom"
            ? "bg-[#00c8d2]"
            : "hover:bg-[#00c8d2]/60 bg-transparent"
        }`}
      >
        <div className="w-10 h-0.5 rounded bg-zinc-700 group-hover:bg-[#00c8d2]" />
      </div>

      {/* 3. Lower Multi-Track Timeline */}
      <MultiTrackTimeline heightPx={timelineHeight} />

      {/* 4. Modals (Export & Settings) */}
      <ExportProgressModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
