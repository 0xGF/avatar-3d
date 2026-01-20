# Avatar 3D

Generate interactive 3D avatar views from a single photo using AI. Move your mouse to rotate the head in real-time.

## Inspiration

Inspired by [Wes Bos's Eye Ballz](https://github.com/wesbos/eye-ballz) project, which creates interactive eye-tracking avatars. This project takes it further by enabling easy upload and running.
## How It Works

1. Upload a photo with a face
2. The app first preprocesses your photo using [google/nano-banana-pro](https://replicate.com/google/nano-banana-pro) to create a stylized 3D Pixar-style portrait
3. Then it generates a grid of images at different head angles using [fofr/expression-editor](https://replicate.com/fofr/expression-editor)
4. As you move your mouse over the viewer, it swaps between images to create a 3D rotation effect

## Getting Started

### Prerequisites

- Node.js 18+
- [Replicate API token](https://replicate.com/account/api-tokens)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/avatar-3d.git
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

Adjust the grid size and rotation range in the UI:

- **X Steps / Y Steps**: Number of images in each direction (5x5 = 25 images)
- **Yaw Range**: Horizontal rotation range in degrees
- **Pitch Range**: Vertical rotation range in degrees

Higher step counts = smoother rotation but more API calls and longer generation time.

## Cost

Each image costs ~$0.01 on Replicate. A 5x5 grid costs ~$0.25, a 7x7 grid costs ~$0.49.

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Replicate](https://replicate.com/) - AI model hosting
- [google/nano-banana-pro](https://replicate.com/google/nano-banana-pro) - 3D portrait stylization
- [fofr/expression-editor](https://replicate.com/fofr/expression-editor) - Head rotation model
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components

## License

MIT
