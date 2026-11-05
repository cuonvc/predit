import React, { useState } from "react";
import { TopBar } from "./components/topbar/TopBar";
import { AutoCaptionModal } from "./components/modals/AutoCaptionModal";
import { VideoPreviewCanvas } from "./components/preview/VideoPreviewCanvas";
import { TextStylePanel } from "./components/inspector/TextStylePanel";
import { MultiTrackTimeline } from "./components/timeline/MultiTrackTimeline";
import { ExportProgressModal } from "./components/modals/ExportProgressModal";
import { SettingsModal } from "./components/modals/SettingsModal";

export const App: React.FC = () => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#0e0e10] text-zinc-200 flex flex-col overflow-hidden">
      {/* 1. Top Window Header Bar */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* 2. Upper 3-Pane CapCut Workspace (Left Media/Captions | Center Player | Right Inspector) */}
      <div className="grid grid-cols-12 gap-1 p-1 flex-1 min-h-0">
        <AutoCaptionModal />
        <VideoPreviewCanvas />
        <TextStylePanel />
      </div>

      {/* 3. Lower Multi-Track Timeline */}
      <MultiTrackTimeline />

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
