import { NextRequest, NextResponse } from "next/server";

// Curated high-quality mock responses to match the UGC brief elements
const MOCK_IMAGES = [
  {
    keywords: ["bottle", "serum", "solara"],
    url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
    promptUsed: "Studio mockup of Solara Naturals Vitamin C Serum, orange amber glass bottle, modern minimalist branding, flat-lay arrangement, clean design.",
  },
  {
    keywords: ["citrus", "orange", "detail"],
    url: "https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&w=800&q=80",
    promptUsed: "Close-up of golden Vitamin C serum drop texture on a glass panel, backlit with warm sunlight, orange fruit accents in soft focus, high definition.",
  },
  {
    keywords: ["creator", "sophie", "girl", "woman"],
    url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
    promptUsed: "Portrait of Sophie: a warm, trustworthy 24-year-old skincare creator with glowing, healthy skin, smiling softly in a brightly lit studio.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const { prompt, index } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // --- REPLICATE / FAL.AI INTEGRATION STUB ---
    // You can swap this block with a real API call. For example with Replicate:
    //
    // import Replicate from "replicate";
    // const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    // const output = await replicate.run("stability-ai/sdxl:...", { input: { prompt } });
    // const generatedUrl = output[0];
    //
    // Or fal.ai:
    // const response = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
    //   method: "POST",
    //   headers: { "Authorization": `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ prompt })
    // });
    // const data = await response.json();
    // const generatedUrl = data.images[0].url;

    // Default mock selection based on index or keywords
    const text = prompt.toLowerCase();
    let selectedMock = MOCK_IMAGES[0];

    if (index !== undefined && MOCK_IMAGES[index]) {
      selectedMock = MOCK_IMAGES[index];
    } else {
      const match = MOCK_IMAGES.find((img) =>
        img.keywords.some((keyword) => text.includes(keyword))
      );
      if (match) selectedMock = match;
    }

    // Add a tiny simulation delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    return NextResponse.json({
      url: selectedMock.url,
      prompt: selectedMock.promptUsed,
      info: "This is a mockup response from the /api/generate-image stub. Swap this handler code to connect Replicate or fal.ai.",
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
