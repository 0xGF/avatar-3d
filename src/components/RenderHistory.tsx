"use client";

import { useState, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  refreshRenderCache,
  deleteRender,
  clearAllRenders,
  MAX_RENDERS,
  type SavedRender,
} from "@/lib/storage";
import { Box, MousePointer2, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RenderHistoryProps {
  onLoadRender?: (render: SavedRender) => void;
  refreshTrigger?: number;
}

export function RenderHistory({ onLoadRender, refreshTrigger }: RenderHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renders, setRenders] = useState<SavedRender[]>([]);
  const [, startTransition] = useTransition();

  // Load renders from IndexedDB
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const data = await refreshRenderCache();
      if (mounted) {
        startTransition(() => {
          setRenders(data);
        });
      }
    };

    load();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRender(id);
    // Update local state immediately
    setRenders((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleClearAll = () => {
    if (confirm("Delete all saved renders? This cannot be undone.")) {
      clearAllRenders();
      setRenders([]);
      setSelectedId(null);
    }
  };

  const handleSelect = (render: SavedRender) => {
    setSelectedId(render.id);
    onLoadRender?.(render);
  };

  if (renders.length === 0) {
    return null;
  }

  const displayedRenders = isExpanded ? renders : renders.slice(0, 4);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Recent Renders</span>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
                  {renders.length}/{MAX_RENDERS}
                  <Info className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">Stores up to {MAX_RENDERS} renders locally. Oldest renders are automatically removed when limit is reached.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-1">
          {renders.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  More ({renders.length})
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {displayedRenders.map((render) => (
          <RenderCard
            key={render.id}
            render={render}
            isSelected={selectedId === render.id}
            onSelect={() => handleSelect(render)}
            onDelete={(e) => handleDelete(render.id, e)}
          />
        ))}
      </div>
    </Card>
  );
}

interface RenderCardProps {
  render: SavedRender;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function RenderCard({ render, isSelected, onSelect, onDelete }: RenderCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`relative aspect-square rounded-md overflow-hidden cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-muted-foreground"
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={render.previewThumbnail}
        alt="Render preview"
        className="w-full h-full object-cover"
      />

      {/* Mode badge */}
      <div className="absolute top-1 left-1">
        {render.mode === "3d-model" ? (
          <Box className="h-3 w-3 text-white drop-shadow-md" />
        ) : (
          <MousePointer2 className="h-3 w-3 text-white drop-shadow-md" />
        )}
      </div>

      {/* Delete button */}
      {showActions && (
        <button
          className="absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-red-500 transition-colors"
          onClick={onDelete}
        >
          <X className="h-3 w-3 text-white" />
        </button>
      )}
    </div>
  );
}

