import { NextRequest, NextResponse } from "next/server";

// Curated high-quality video mock responses
const MOCK_VIDEOS = [
  {
    url: "https://assets.mixkit.co/videos/preview/mixkit-skin-care-product-in-water-43098-large.mp4",
    promptUsed: "Aesthetic B-roll of product bottle slowly dropping into clear water with ripples, slow-motion 120fps, studio lighting.",
  },
  {
    url: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-clean-shining-skin-43105-large.mp4",
    promptUsed: "A warm and trustworthy 24-year-old skincare creator looking into camera, smiling softly, showing off her glowing hydrated skin, vertical ratio.",
  },
  {
    url: "https://assets.mixkit.co/videos/preview/mixkit-woman-applying-a-face-mask-43095-large.mp4",
    promptUsed: "Close-up shot of creator applying product drops directly to cheek, smiling, dynamic zoom, soft bathroom background, vertical ratio.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // --- RUNWAY / KLING / LUMA INTEGRATION STUB ---
    // You can swap this block with a real video generation API call. E.g. Runway:
    //
    // const response = await fetch("https://api.runwayml.com/v1/image_to_video", {
    //   method: "POST",
    //   headers: { "Authorization": `Bearer ${process.env.RUNWAY_API_KEY}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ prompt, image_url: imageUrl })
    // });
    // ... poll task ...
    // const generatedVideoUrl = result.url;

    // Pick a video at random or based on prompt
    const index = prompt && prompt.toLowerCase().includes("apply") ? 2 : 1;
    const selectedVideo = MOCK_VIDEOS[index];

    // Add a tiny simulation delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    return NextResponse.json({
      url: selectedVideo.url,
      prompt: selectedVideo.promptUsed,
      info: "This is a mockup response from the /api/generate-video stub. Swap this handler code to connect Runway, Kling, or Luma.",
    });
  } catch (error) {
    console.error("Video generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Video generation failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
