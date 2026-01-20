import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export const maxDuration = 120;

// Nano Banana Pro - image generation model for creating 3D-style portraits
const MODEL_ID = "google/nano-banana-pro";

function getReplicateClient() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  return new Replicate({ auth: token });
}

interface PreprocessRequest {
  imageBase64: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch result: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const body: PreprocessRequest = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const replicate = getReplicateClient();

    // Convert base64 to data URI
    const imageDataUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    console.log("[Preprocess] Creating 3D front-facing portrait with Nano Banana Pro...");

    // Use Nano Banana Pro to create a 3D animated Pixar-style character
    const output = await replicate.run(MODEL_ID, {
      input: {
        prompt: "Transform this person into a 3D animated Pixar-style character. Stylized 3D render, Disney Pixar animation style, smooth skin, big expressive eyes, soft lighting, front facing, looking directly at camera, neutral expression, centered on pure black background. Keep the same facial features and likeness but as a 3D animated cartoon character.",
        image_input: [imageDataUri],
        resolution: "2K",
        aspect_ratio: "1:1",
        output_format: "png",
        safety_filter_level: "block_only_high",
      },
    });

    console.log("[Preprocess] Output:", typeof output);

    // Handle output - Nano Banana Pro returns a FileOutput object with .url() method
    let resultBuffer: Buffer;

    if (output && typeof output === "object" && "url" in output && typeof output.url === "function") {
      // FileOutput object
      const url = output.url();
      console.log("[Preprocess] Fetching from URL:", url);
      resultBuffer = await fetchImageBuffer(url);
    } else if (typeof output === "string") {
      // Direct URL string
      resultBuffer = await fetchImageBuffer(output);
    } else if (Array.isArray(output) && output.length > 0) {
      // Array of outputs
      const item = output[0];
      if (typeof item === "object" && "url" in item && typeof item.url === "function") {
        resultBuffer = await fetchImageBuffer(item.url());
      } else if (typeof item === "string") {
        resultBuffer = await fetchImageBuffer(item);
      } else {
        throw new Error("Unexpected array item format");
      }
    } else {
      console.error("[Preprocess] Unexpected output:", output);
      throw new Error("Unexpected output format from model");
    }

    const resultBase64 = resultBuffer.toString("base64");

    console.log("[Preprocess] Portrait generation complete, size:", resultBuffer.length);

    return NextResponse.json({
      success: true,
      imageBase64: resultBase64,
    });
  } catch (error) {
    console.error("Preprocess error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preprocessing failed" },
      { status: 500 }
    );
  }
}
