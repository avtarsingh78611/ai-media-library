import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json();

    if (!brief || typeof brief !== "string") {
      return NextResponse.json({ error: "Brief is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    let scriptText = "";
    let isMock = false;

    if (!apiKey) {
      isMock = true;
      scriptText = `[UGC VIDEO SCRIPT: SOLARA NATURALS VITAMIN C BRIGHTENING SERUM]
Duration: 30 Seconds | Ratio: 9:16 (TikTok/Reels)
Creator: Sophie (24, warm, trustworthy, glowing skin)

---

HOOK (0-5s)
[Visual: Close up of Sophie's face, looking directly into the camera with no makeup, pointing to a slight dark spot on her cheek. She holds up the amber bottle of Solara Naturals.]
Sophie (Voiceover): "If you're still struggling with dull skin or dark spots in 2026, stop scrolling. Seriously, look at this..."

PRODUCT REVEAL (5-10s)
[Visual: Quick cut. The amber glass bottle sits on a marble counter in bright bathroom lighting. A hand drops fresh orange slices next to it. Camera zooms in rapidly.]
Sophie (Voiceover): "This is the Vitamin C Brightening Serum from Solara Naturals. It's packed with pure Kakadu plum and orange extracts."

APPLICATION (10-20s)
[Visual: Sophie puts three drops of the golden serum onto her cheeks. She gently pats it into her skin using upward motions. The serum glides smoothly, leaving an instant wet shine.]
Sophie (Voiceover): "Unlike other serums, it's non-sticky and absorbs in seconds. You can feel the hydration boost immediately."

GLOW REACTION (20-25s)
[Visual: Sophie tilts her face left and right in front of a sunny window, showing off an incredible dewy, glass-skin glow. She smiles widely, clearly delighted.]
Sophie (Voiceover): "Look at that reflection! No beauty filter, just natural, healthy glow. It literally feels like sunshine in a bottle."

CTA (25-30s)
[Visual: Sophie holds the product close to the lens, smiling. A text overlay slides in: 'Get Glowing skin @ SolaraNaturals.com'.]
Sophie (Voiceover): "Click below to grab yours today and start your glow journey. Your skin will thank you!"

---
CAPTIONS (ON-SCREEN TEXT)
- "Struggling with dull skin?"
- "Meet Solara Naturals Vitamin C!"
- "Hydrates + Brightens instantly"
- "Look at that natural glow!"
- "Link in bio to shop now!"`;
    } else {
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
                "You are an expert UGC video script writer. Turn the user's brief into a structured, highly engaging, high-retention 30-second TikTok script. Format it with sections: HOOK (0-5s), PRODUCT REVEAL (5-10s), APPLICATION (10-20s), GLOW REACTION (20-25s), CTA (25-30s), and CAPTIONS. Include clear visual directions in brackets [Visual: ...] and voiceover transcript. Return ONLY the script text.",
            },
            {
              role: "user",
              content: brief,
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
      scriptText =
        data.choices?.[0]?.message?.content?.trim() || "Failed to generate script.";
    }

    return NextResponse.json({ script: scriptText, isMock });
  } catch (error) {
    console.error("UGC script route error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
