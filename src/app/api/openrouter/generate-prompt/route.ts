import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();

    if (!goal || typeof goal !== "string") {
      return NextResponse.json({ error: "Goal parameter is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    let generatedPrompt = "";
    let isMock = false;

    if (!apiKey) {
      isMock = true;
      // Mock prompt generation fallback
      generatedPrompt = `A premium, ultra-realistic visual concept expanding on: "${goal}". Captured using a Hasselblad 500C on 80mm lens. The scene showcases soft cinematic volumetric lighting, dynamic shadows, and high fidelity textures. Minimalist layout, modern color palette featuring lime-chartreuse (#D7FF3E) accents and near-black surfaces, extremely detailed, photorealistic 8k, --ar 16:9`;
    } else {
      // Call OpenRouter API
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "MediaLib AI",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an expert prompt engineer. The user will provide a goal or brief. Your task is to output an extremely detailed, high-quality, professional prompt suitable for image/video generation tools (such as Midjourney, Stable Diffusion, DALL-E, Runway, Kling). Return ONLY the prompt text, without any conversational introduction, code blocks, or wrapper markup.",
            },
            {
              role: "user",
              content: goal,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        throw new Error(`OpenRouter returned status ${response.status}`);
      }

      const data = await response.json();
      generatedPrompt =
        data.choices?.[0]?.message?.content?.trim() || "Failed to generate prompt.";
    }

    // Try to save to Supabase (Server bypass role)
    const supabaseServer = getSupabaseServer();
    if (supabaseServer) {
      const { data: { user } } = await supabaseServer.auth.getUser();
      const userId = user?.id || "00000000-0000-0000-0000-000000000000";

      await supabaseServer.from("prompt_generations").insert([
        {
          goal,
          generated_prompt: generatedPrompt,
          user_id: userId,
        },
      ]);
    }

    return NextResponse.json({
      prompt: generatedPrompt,
      isMock,
    });
  } catch (error) {
    console.error("Prompt generation route error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
