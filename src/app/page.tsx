"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { Viewer3D } from "@/components/Viewer3D";
import { ModelViewer } from "@/components/ModelViewer";
import { ExportModal } from "@/components/ExportModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { calculateCost, DEFAULTS } from "@/lib/constants";
import type { GeneratedImage, GenerationStatus, GenerationMode, StreamEvent } from "@/lib/types";
import { Loader2, Sparkles, Box, MousePointer2, User, Download, Wand2, Pencil, X } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [xSteps, setXSteps] = useState<number>(DEFAULTS.X_STEPS);
  const [ySteps, setYSteps] = useState<number>(DEFAULTS.Y_STEPS);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [glbBase64, setGlbBase64] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("3d-model");

  // Style prompt for preprocessing
  const [stylePrompt, setStylePrompt] = useState("");
  const [showStyleModal, setShowStyleModal] = useState(false);

  // 3D Model settings
  const [textureSize, setTextureSize] = useState<number>(DEFAULTS.TEXTURE_SIZE);
  const [meshQuality, setMeshQuality] = useState<number>(DEFAULTS.MESH_QUALITY);

  const estimatedCost = calculateCost(xSteps, ySteps);
  const totalImages = xSteps * ySteps;

  const handleImageSelect = useCallback((base64: string, preview: string) => {
    setOriginalImageBase64(base64);
    setPreviewUrl(preview);
    setGeneratedImages([]);
    setGlbBase64(null);
    setStatus("idle");
    setProgress(0);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!originalImageBase64) return;

    setStatus("preprocessing");
    setProgress(0);
    setGeneratedImages([]);
    setGlbBase64(null);

    const toastId = toast.loading("Creating Pixar-style character...");

    let imageToUse = originalImageBase64;

    // Step 1: Preprocess with Nano Banana Pro
    try {
      const preprocessResponse = await fetch("/api/preprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: originalImageBase64,
          fullBody: generationMode === "3d-model",
          stylePrompt: stylePrompt.trim() || undefined,
        }),
      });

      if (preprocessResponse.ok) {
        const preprocessData = await preprocessResponse.json();
        imageToUse = preprocessData.imageBase64;
        setPreviewUrl(`data:image/png;base64,${imageToUse}`);
        toast.loading("Character ready!", { id: toastId });
      } else {
        const errorData = await preprocessResponse.json();
        throw new Error(errorData.error || "Preprocessing failed");
      }
    } catch (err) {
      console.error("Preprocessing error:", err);
      setStatus("error");
      toast.error("Failed to create character", {
        id: toastId,
        description: err instanceof Error ? err.message : "Unknown error"
      });
      return;
    }

    // Step 2: Generate based on mode
    if (generationMode === "3d-model") {
      setStatus("generating3d");
      toast.loading("Generating 3D model... (this may take 1-2 min)", { id: toastId });

      try {
        const response = await fetch("/api/generate-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: imageToUse,
            textureSize,
            meshQuality,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "3D generation failed");
        }

        const data = await response.json();
        setGlbBase64(data.glbBase64);
        setStatus("complete");
        toast.success("3D model ready!", { id: toastId });
      } catch (err) {
        setStatus("error");
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error("3D generation failed", { id: toastId, description: message });
      }
    } else {
      setStatus("generating");
      toast.loading("Generating frames...", { id: toastId });

      try {
        const response = await fetch("/api/generate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: imageToUse,
            xSteps,
            ySteps,
            prefix: "avatar",
          }),
        });

        if (!response.ok) {
          throw new Error("Generation failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        const images: GeneratedImage[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(line.slice(6)) as StreamEvent;

              if (data.type === "progress") {
                const pct = (data.completed / data.total) * 100;
                setProgress(pct);
                images.push({
                  step: data.step,
                  imageBase64: data.imageBase64,
                  index: data.index,
                });
                setGeneratedImages([...images]);
                toast.loading(`Generating... ${Math.round(pct)}%`, { id: toastId });
              } else if (data.type === "complete") {
                setStatus("complete");
                setProgress(100);
                toast.success(`${images.length} frames generated`, { id: toastId });
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      } catch (err) {
        setStatus("error");
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error("Generation failed", { id: toastId, description: message });
      }
    }
  }, [originalImageBase64, xSteps, ySteps, generationMode, meshQuality, textureSize, stylePrompt]);

  const isPreprocessing = status === "preprocessing";
  const isGenerating = status === "generating";
  const isGenerating3D = status === "generating3d";
  const isBusy = isPreprocessing || isGenerating || isGenerating3D;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left Column - Settings */}
          <div className="flex flex-col space-y-4">
            {/* Mode Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={generationMode === "cursor" ? "default" : "ghost"}
                size="lg"
                onClick={() => setGenerationMode("cursor")}
                disabled={isBusy}
                className="flex-1 gap-2"
              >
                <MousePointer2 className="h-4 w-4" />
                Cursor Tracking
              </Button>
              <Button
                variant={generationMode === "3d-model" ? "default" : "ghost"}
                size="lg"
                onClick={() => setGenerationMode("3d-model")}
                disabled={isBusy}
                className="flex-1 gap-2"
              >
                <Box className="h-4 w-4" />
                3D Model
              </Button>
            </div>

            {/* Upload */}
            <ImageUpload
              onImageSelect={handleImageSelect}
              disabled={isBusy}
            />

            {/* Mode-specific Settings - Same height for both */}
            <Card className="p-4 min-h-[200px]">
              <div className="space-y-6">
                <p className="text-sm font-medium">
                  {generationMode === "cursor" ? "Frame Settings" : "3D Model Settings"}
                </p>

                {generationMode === "cursor" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Horizontal</span>
                        <Badge variant="secondary" className="font-mono text-xs">{xSteps}</Badge>
                      </div>
                      <Slider
                        value={[xSteps]}
                        onValueChange={([value]) => setXSteps(value)}
                        min={3}
                        max={10}
                        step={1}
                        disabled={isBusy}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vertical</span>
                        <Badge variant="secondary" className="font-mono text-xs">{ySteps}</Badge>
                      </div>
                      <Slider
                        value={[ySteps]}
                        onValueChange={([value]) => setYSteps(value)}
                        min={3}
                        max={10}
                        step={1}
                        disabled={isBusy}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>{totalImages} frames</span>
                      <span className="font-mono">${estimatedCost.toFixed(3)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Texture Size</span>
                        <Badge variant="secondary" className="font-mono text-xs">{textureSize}px</Badge>
                      </div>
                      <Slider
                        value={[Math.log2(textureSize) - 9]}
                        onValueChange={([value]) => setTextureSize(Math.pow(2, value + 9))}
                        min={0}
                        max={2}
                        step={1}
                        disabled={isBusy}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Mesh Quality</span>
                        <Badge variant="secondary" className="font-mono text-xs">{Math.round(meshQuality * 100)}%</Badge>
                      </div>
                      <Slider
                        value={[meshQuality]}
                        onValueChange={([value]) => setMeshQuality(value)}
                        min={0.5}
                        max={0.98}
                        step={0.08}
                        disabled={isBusy}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>GLB output</span>
                      <span>~1-2 min</span>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Generate Button with Style Option */}
            <div className="relative flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => setShowStyleModal(true)}
                disabled={isBusy}
                title="Customize style"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1 h-12 text-base"
                onClick={handleGenerate}
                disabled={!originalImageBase64 || isBusy}
              >
                {isGenerating3D ? (
                  <>
                    <Box className="mr-2 h-4 w-4 animate-pulse" />
                    Creating 3D Model...
                  </>
                ) : isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Frames
                  </>
                ) : isPreprocessing ? (
                  <>
                    <Wand2 className="mr-2 h-4 w-4 animate-pulse" />
                    Creating Character
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
              {isGenerating && (
                <Progress value={progress} className="h-1 absolute -bottom-2 left-0 right-0" />
              )}
            </div>
          </div>

          {/* Right Column - Preview (matches left height) */}
          <div className="flex flex-col space-y-6">
            {/* Header with export */}
            <div className="flex items-center justify-between pt-2 h-10">
              {glbBase64 && (
                <Badge variant="secondary" className="text-xs">
                  <Box className="h-3 w-3 mr-1" />
                  3D Model Ready
                </Badge>
              )}
              <div className="flex-1" />
              {status === "complete" && (generatedImages.length > 0 || glbBase64) && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowExport(true)}

                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              )}
            </div>

            {/* Viewer - fills remaining space */}
            <div className="flex-1 min-h-0">
              {glbBase64 ? (
                <ModelViewer glbBase64={glbBase64} />
              ) : generatedImages.length > 0 ? (
                <Viewer3D
                  images={generatedImages}
                  xSteps={xSteps}
                  ySteps={ySteps}
                />
              ) : previewUrl ? (
                <Card className="aspect-square overflow-hidden relative bg-black">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                  {isPreprocessing && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                      <Wand2 className="h-8 w-8 text-white mb-2 animate-pulse" />
                      <p className="text-sm text-white">Creating Pixar character...</p>
                    </div>
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
                      <p className="text-sm text-white">Generating... {Math.round(progress)}%</p>
                    </div>
                  )}
                  {isGenerating3D && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                      <Box className="h-8 w-8 text-white mb-2 animate-pulse" />
                      <p className="text-sm text-white">Creating 3D model...</p>
                      <p className="text-xs text-white/60 mt-1">This may take 1-2 minutes</p>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="aspect-square flex items-center justify-center border-dashed">
                  <div className="text-center text-muted-foreground p-6">
                    <User className="h-8 w-8 mx-auto mb-2 stroke-[1.5]" />
                    <p className="text-sm">Upload an image to start</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Style Prompt Modal */}
      {showStyleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStyleModal(false)}
          />
          <Card className="relative z-10 w-full max-w-sm p-3 gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Style Prompt</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 -mt-1"
                onClick={() => setShowStyleModal(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <textarea
              placeholder="e.g., wearing a red hat, cyberpunk style..."
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              className="w-full h-30 px-2 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setStylePrompt("")}>
                Clear
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setShowStyleModal(false)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showExport && (
        <ExportModal
          images={generatedImages}
          xSteps={xSteps}
          ySteps={ySteps}
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          glbBase64={glbBase64}
        />
      )}
    </div>
  );
}
