import Replicate from "replicate";

/**
 * Model IDs for Replicate API
 */
export const MODELS = {
  EXPRESSION_EDITOR:
    "fofr/expression-editor:bf913bc90e1c44ba288ba3942a538693b72e8cc7df576f3beebe56adc0a92b86",
  NANO_BANANA_PRO: "google/nano-banana",
  TRELLIS:
    "firtoz/trellis:e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
} as const;

/**
 * Get configured Replicate client
 * @throws Error if REPLICATE_API_TOKEN is not set
 */
export function getReplicateClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  return new Replicate({ auth: token });
}

/**
 * Convert base64 string to data URI
 */
export function toDataUri(base64: string, mimeType = "image/png"): string {
  if (base64.startsWith("data:")) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Fetch a URL and return as Buffer
 */
export async function fetchAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Read a ReadableStream into a Buffer
 */
export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return Buffer.from(result);
}

/**
 * Options for generating expression-edited images
 */
export interface GenerateImageOptions {
  imageBase64: string;
  rotate_yaw: number;
  rotate_pitch: number;
  pupil_x: number;
  pupil_y: number;
  crop_factor?: number;
  output_quality?: number;
  src_ratio?: number;
  sample_ratio?: number;
}

/**
 * Generate an image with expression editor model
 */
export async function generateImage(options: GenerateImageOptions): Promise<Buffer> {
  const replicate = getReplicateClient();

  const {
    imageBase64,
    rotate_yaw,
    rotate_pitch,
    pupil_x,
    pupil_y,
    crop_factor = 1.7,
    output_quality = 100,
    src_ratio = 1,
    sample_ratio = 1,
  } = options;

  const output = await replicate.run(MODELS.EXPRESSION_EDITOR, {
    input: {
      image: toDataUri(imageBase64),
      rotate_yaw,
      rotate_pitch,
      pupil_x,
      pupil_y,
      crop_factor,
      output_quality,
      src_ratio,
      sample_ratio,
      output_format: "png",
    },
  });

  // Handle various output formats from Replicate
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0];

    if (typeof item === "string") {
      return fetchAsBuffer(item);
    }

    if (item instanceof ReadableStream) {
      return streamToBuffer(item);
    }
  }

  if (typeof output === "string") {
    return fetchAsBuffer(output);
  }

  if (output instanceof ReadableStream) {
    return streamToBuffer(output);
  }

  throw new Error("Unexpected output format from Replicate API");
}

/**
 * Handle Replicate FileOutput or URL response
 */
export async function handleReplicateOutput(
  output: unknown
): Promise<Buffer> {
  // FileOutput object with url() method
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as { url: () => string }).url === "function"
  ) {
    const url = (output as { url: () => string }).url();
    return fetchAsBuffer(url);
  }

  // Direct URL string
  if (typeof output === "string") {
    return fetchAsBuffer(output);
  }

  // Array of outputs
  if (Array.isArray(output) && output.length > 0) {
    return handleReplicateOutput(output[0]);
  }

  throw new Error("Unexpected output format from model");
}
