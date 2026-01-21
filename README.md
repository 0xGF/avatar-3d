# Avatar 3D

Generate interactive 3D avatars from a single photo using AI. Choose between cursor-tracking rotation or full 3D model export.

## Features

- **Two Generation Modes:**
  - **Cursor Tracking** - Generate a grid of head rotation frames for mouse-follow effect
  - **3D Model** - Generate an actual GLB 3D model you can use in Blender, Unity, etc.
- **Pixar-Style Preprocessing** - Photos are transformed into stylized 3D characters
- **Custom Style Prompts** - Add accessories, change styles (cyberpunk, cartoon villain, etc.)
- **Export Options** - Download GLB files, HTML embeds, individual frames, or React components

## Inspiration

Inspired by [Wes Bos's Eye Ballz](https://github.com/wesbos/eye-ballz) project, which creates interactive eye-tracking avatars. This project extends the concept with AI-powered stylization and true 3D model generation.

## How It Works

1. Upload a photo with a face
2. The app preprocesses your photo using [google/nano-banana-pro](https://replicate.com/google/nano-banana-pro) to create a Pixar-style 3D character
3. Based on your selected mode:
   - **Cursor Tracking**: Generates a grid of images at different head angles using [fofr/expression-editor](https://replicate.com/fofr/expression-editor)
   - **3D Model**: Generates a GLB model using [firtoz/trellis](https://replicate.com/firtoz/trellis)
4. Preview and export your creation

## Getting Started

### Prerequisites

- Node.js 18+
- [Replicate API token](https://replicate.com/account/api-tokens)

### Installation

```bash
# Clone the repo
git clone https://github.com/0xGF/avatar-3d.git
cd avatar-3d

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Add your Replicate API token to .env.local
# REPLICATE_API_TOKEN=r8_xxxxx

# Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Cursor Tracking Mode
- **Horizontal/Vertical Steps**: Number of images in each direction (5x5 = 25 frames)
- Higher step counts = smoother rotation but more API calls

### 3D Model Mode
- **Texture Size**: Resolution of the model texture (512-2048px)
- **Mesh Quality**: Detail level of the 3D mesh (50-100%)

## Cost Estimates

- **Preprocessing**: ~$0.01 per image
- **Cursor Tracking**: ~$0.01 per frame (5x5 grid ≈ $0.25)
- **3D Model**: ~$0.05-0.10 per generation

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Three.js](https://threejs.org/) - 3D model rendering
- [Replicate](https://replicate.com/) - AI model hosting
  - [google/nano-banana-pro](https://replicate.com/google/nano-banana-pro) - Pixar-style transformation
  - [fofr/expression-editor](https://replicate.com/fofr/expression-editor) - Head rotation frames
  - [firtoz/trellis](https://replicate.com/firtoz/trellis) - Image to 3D model
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=0xGF/avatar-3d&type=Date)](https://star-history.com/#0xGF/avatar-3d&Date)

## License

MIT
