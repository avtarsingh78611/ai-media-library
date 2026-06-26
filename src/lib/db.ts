import { supabase, isSupabaseConfigured, getSupabaseServer } from "./supabase";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Asset {
  id: string;
  folder_id: string;
  user_id: string;
  type: "image" | "video" | "text";
  storage_path: string; // public URL or storage path
  prompt: string;
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    scriptText?: string; // used for script.txt
    fileName?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface PromptGeneration {
  id: string;
  user_id: string;
  goal: string;
  generated_prompt: string;
  created_at: string;
}

// Default static user ID for non-auth environments
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
const STORAGE_BUCKETS = ["Assets", "media"];

export function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error occurred.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  const parts: string[] = [];
  const err = error as Record<string, unknown>;

  if (typeof err.message === "string") parts.push(err.message);
  if (typeof err.details === "string" && err.details) parts.push(err.details);
  if (typeof err.hint === "string" && err.hint) parts.push(`Hint: ${err.hint}`);
  if (typeof err.code === "string" && err.code) parts.unshift(`Code: ${err.code}`);
  if (typeof err.status !== "undefined") parts.push(`Status: ${err.status}`);

  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(error);
}

function getSupabaseClient(useServerSide = false) {
  if (useServerSide) {
    const server = getSupabaseServer();
    if (!server) {
      throw new Error("Supabase server client is not configured.");
    }
    return server;
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

async function getAuthenticatedUser() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(getErrorMessage(error));
  }
  if (!data.user) {
    throw new Error("Authentication required. Please sign in to continue.");
  }
  return data.user;
}

function buildUploadPath(userId: string, folderSlug: string, fileName: string) {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${userId}/${folderSlug}/${Date.now()}_${sanitizedName}`;
}
// Try to resolve bucket and object path from a stored storage_path value.
function resolveBucketAndObjectPath(storagePath: string): { bucket: string; path: string } | null {
  if (!storagePath) return null;

  // If it's a full URL (Supabase public URL format contains /storage/v1/object/public/{bucket}/{path})
  try {
    const url = new URL(storagePath);
    const marker = "/storage/v1/object/public/";
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      const after = url.pathname.substring(idx + marker.length); // {bucket}/{path}
      const firstSlash = after.indexOf("/");
      if (firstSlash !== -1) {
        const bucket = after.substring(0, firstSlash);
        const path = after.substring(firstSlash + 1);
        return { bucket, path };
      }
    }
  } catch {
    // Not a URL, continue
  }

  // If value already looks like 'bucket/...' or 'userId/...'
  for (const bucket of STORAGE_BUCKETS) {
    if (storagePath.startsWith(`${bucket}/`)) {
      return { bucket, path: storagePath.substring(bucket.length + 1) };
    }
  }

  // If it contains a known bucket segment somewhere, extract the part after the bucket
  for (const bucket of STORAGE_BUCKETS) {
    const marker = `/${bucket}/`;
    const idx = storagePath.indexOf(marker);
    if (idx !== -1) {
      return { bucket, path: storagePath.substring(idx + marker.length) };
    }
  }

  // Default to Assets bucket with the full storagePath as object path
  return { bucket: STORAGE_BUCKETS[0], path: storagePath };
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getAssetUrl(storagePath: string, expiresIn = 60 * 60 * 24 * 365): Promise<string> {
  if (!storagePath) return storagePath;

  // If it's a data URL or external http(s) link, return as-is
  if (storagePath.startsWith("data:") || storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    // But avoid trying to sign already public Supabase URLs; if it's a known Supabase public URL, attempt to extract path
    const maybe = resolveBucketAndObjectPath(storagePath);
    if (!maybe) return storagePath;
    // otherwise proceed to sign using extracted path
  }

  // Use cache key
  const cacheKey = `${storagePath}:${expiresIn}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 5000) {
    return cached.url;
  }

  if (!isSupabaseConfigured) {
    // Non-supabase or mock mode: return the value as-is
    console.warn(`[getAssetUrl] Supabase not configured. Returning raw storage path: ${storagePath}`);
    return storagePath;
  }

  try {
    const resolved = resolveBucketAndObjectPath(storagePath);
    if (!resolved) {
      console.warn(`[getAssetUrl] Could not resolve bucket/path from: ${storagePath}`);
      return storagePath;
    }

    const client = getSupabaseClient();
    const { bucket, path } = resolved;

    console.log(`[getAssetUrl] Creating signed URL for bucket='${bucket}', path='${path}'`);
    // Create signed URL (works for both authenticated and guest users)
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
    
    if (error) {
      console.error(`[getAssetUrl] Error creating signed URL for ${path}:`, error);
      throw new Error(`Failed to create signed URL: ${getErrorMessage(error)}`);
    }
    
    if (!data || !data.signedUrl) {
      console.error(`[getAssetUrl] No signed URL returned for ${path}`);
      throw new Error("No signed URL returned from Supabase");
    }

    console.log(`[getAssetUrl] Successfully created signed URL for ${path}`);
    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 });
    return data.signedUrl;
  } catch (err) {
    // Log the error but don't return the raw path since the bucket is private
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[getAssetUrl] Failed to get signed URL for ${storagePath}:`, errorMsg);
    // Return empty string so the UI can detect the failure
    return "";
  }
}

// Curated high-quality mock data
const MOCK_FOLDERS: Folder[] = [
  {
    id: "f1",
    user_id: DEFAULT_USER_ID,
    name: "A2 Care",
    slug: "a2-care",
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
  {
    id: "f2",
    user_id: DEFAULT_USER_ID,
    name: "Solara Naturals",
    slug: "solara-naturals",
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
];

const MOCK_ASSETS: Asset[] = [
  // A2 Care assets
  {
    id: "a1",
    folder_id: "f1",
    user_id: DEFAULT_USER_ID,
    type: "image",
    storage_path: "https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&w=1200&q=80",
    prompt: "Close-up shot of A2 Care premium moisturizing cream bottle sitting on a polished stone surface, dramatic side lighting, rich shadows, warm neutral tones, highly detailed, 8k resolution.",
    metadata: { width: 1200, height: 800, fileName: "cream_bottle.jpg" },
    created_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
  },
  {
    id: "a2",
    folder_id: "f1",
    user_id: DEFAULT_USER_ID,
    type: "video",
    storage_path: "https://assets.mixkit.co/videos/preview/mixkit-skin-care-product-in-water-43098-large.mp4",
    prompt: "Aesthetic B-roll of product bottle slowly dropping into clear water with ripples and bubbles, slow-motion 120fps, bright studio lighting, commercial style.",
    metadata: { duration: 12, width: 1920, height: 1080, fileName: "water_splash.mp4" },
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  // Solara Naturals assets
  {
    id: "a3",
    folder_id: "f2",
    user_id: DEFAULT_USER_ID,
    type: "image",
    storage_path: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80",
    prompt: "Studio mockup of Solara Naturals Vitamin C Serum orange amber glass bottle, surrounded by fresh orange slices, backlighting, modern minimalist branding, chartreuse background.",
    metadata: { width: 1200, height: 800, fileName: "vit_c_serum.jpg" },
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: "a4",
    folder_id: "f2",
    user_id: DEFAULT_USER_ID,
    type: "video",
    storage_path: "https://assets.mixkit.co/videos/preview/mixkit-woman-applying-a-face-mask-43095-large.mp4",
    prompt: "UGC video snippet showing a warm 24-year-old creator applying Solara Naturals Serum, smiling at the camera, dynamic zoom-in, vertical format, bright bathroom backdrop, natural lighting.",
    metadata: { duration: 15, width: 1080, height: 1920, fileName: "ugc_application.mp4" },
    created_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
];

const MOCK_PROMPT_GENERATIONS: PromptGeneration[] = [
  {
    id: "p1",
    user_id: DEFAULT_USER_ID,
    goal: "Generate a premium skincare ad copy prompt for a moisturizing lotion",
    generated_prompt: "Create an ultra-high definition product photography shot of a sleek white skincare lotion bottle. The bottle should have minimalist black typography. Set it on a cracked clay pedestal with warm desert sand in the background. Utilize golden hour sunlight casting long, elegant shadows. F/1.8 aperture, cinematic styling, photorealistic details.",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

// Helper to initialize LocalStorage if empty
function initMockDb() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("ai_media_folders")) {
    localStorage.setItem("ai_media_folders", JSON.stringify(MOCK_FOLDERS));
  }
  if (!localStorage.getItem("ai_media_assets")) {
    localStorage.setItem("ai_media_assets", JSON.stringify(MOCK_ASSETS));
  }
  if (!localStorage.getItem("ai_media_prompt_generations")) {
    localStorage.setItem("ai_media_prompt_generations", JSON.stringify(MOCK_PROMPT_GENERATIONS));
  }
}

export const dbService = {
  // --- FOLDERS ---
  async getFolders(): Promise<Folder[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const user = await getAuthenticatedUser();
        const { data, error } = await supabase
          .from("folders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new Error(`Fetch folders failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const foldersStr = localStorage.getItem("ai_media_folders") || "[]";
      return JSON.parse(foldersStr);
    }
  },

  async getPublicFolders(): Promise<Folder[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("folders")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new Error(`Fetch public folders failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const foldersStr = localStorage.getItem("ai_media_folders") || "[]";
      return JSON.parse(foldersStr);
    }
  },

  async createFolder(name: string): Promise<Folder> {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (isSupabaseConfigured) {
      try {
        const user = await getAuthenticatedUser();
        const client = getSupabaseClient();

        const { data, error } = await client
          .from("folders")
          .insert([{ name, slug, user_id: user.id }])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        throw new Error(`Create folder failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const folders = await this.getFolders();
      const newFolder: Folder = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: DEFAULT_USER_ID,
        name,
        slug,
        created_at: new Date().toISOString(),
      };
      folders.unshift(newFolder);
      localStorage.setItem("ai_media_folders", JSON.stringify(folders));
      return newFolder;
    }
  },

  // --- ASSETS ---
  async getAssets(folderId: string): Promise<Asset[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const user = await getAuthenticatedUser();
        const { data, error } = await supabase
          .from("assets")
          .select("*")
          .eq("folder_id", folderId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new Error(`Fetch assets failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const assetsStr = localStorage.getItem("ai_media_assets") || "[]";
      const allAssets: Asset[] = JSON.parse(assetsStr);
      return allAssets
        .filter((a) => a.folder_id === folderId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async getPublicAssets(): Promise<Asset[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("assets")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new Error(`Fetch public assets failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const assetsStr = localStorage.getItem("ai_media_assets") || "[]";
      return JSON.parse(assetsStr);
    }
  },

  async createAsset(
    folderId: string,
    type: "image" | "video" | "text",
    storagePath: string,
    prompt: string,
    metadata: Record<string, unknown> = {}
  ): Promise<Asset> {
    if (isSupabaseConfigured) {
      try {
        const user = await getAuthenticatedUser();
        const client = getSupabaseClient();
        const { data, error } = await client
          .from("assets")
          .insert([
            {
              folder_id: folderId,
              user_id: user.id,
              type,
              storage_path: storagePath,
              prompt,
              metadata,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        throw new Error(`Create asset record failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const assetsStr = localStorage.getItem("ai_media_assets") || "[]";
      const allAssets: Asset[] = JSON.parse(assetsStr);
      const newAsset: Asset = {
        id: Math.random().toString(36).substring(2, 9),
        folder_id: folderId,
        user_id: DEFAULT_USER_ID,
        type,
        storage_path: storagePath,
        prompt,
        metadata,
        created_at: new Date().toISOString(),
      };
      allAssets.unshift(newAsset);
      localStorage.setItem("ai_media_assets", JSON.stringify(allAssets));
      return newAsset;
    }
  },

  // --- PROMPT GENERATIONS ---
  async getPromptGenerations(): Promise<PromptGeneration[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const user = await getAuthenticatedUser();
        const { data, error } = await supabase
          .from("prompt_generations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        throw new Error(`Fetch prompt history failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const promptGensStr = localStorage.getItem("ai_media_prompt_generations") || "[]";
      return JSON.parse(promptGensStr);
    }
  },

  async createPromptGeneration(goal: string, generatedPrompt: string): Promise<PromptGeneration> {
    if (isSupabaseConfigured && supabase) {
      try {
        const user = await getAuthenticatedUser();
        const { data, error } = await supabase
          .from("prompt_generations")
          .insert([{ goal, generated_prompt: generatedPrompt, user_id: user.id }])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        throw new Error(`Save prompt generation failed: ${getErrorMessage(err)}`);
      }
    } else {
      initMockDb();
      const gens = await this.getPromptGenerations();
      const newGen: PromptGeneration = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: DEFAULT_USER_ID,
        goal,
        generated_prompt: generatedPrompt,
        created_at: new Date().toISOString(),
      };
      gens.unshift(newGen);
      localStorage.setItem("ai_media_prompt_generations", JSON.stringify(gens));
      return newGen;
    }
  },

  // Storage upload helper
  async uploadFile(
    file: File | Blob,
    folderSlug: string,
    fileName: string
  ): Promise<string> {
    if (isSupabaseConfigured) {
      try {
        const user = await getAuthenticatedUser();
        const client = getSupabaseClient();
        const userId = user.id;
        const path = buildUploadPath(userId, folderSlug, fileName);

        let lastError: unknown;
        for (const bucket of STORAGE_BUCKETS) {
          const { error } = await client.storage.from(bucket).upload(path, file);
          if (!error) {
            const { data: publicData } = client.storage.from(bucket).getPublicUrl(path);
            if (!publicData?.publicUrl) {
              throw new Error(`Unable to generate public URL for bucket "${bucket}".`);
            }
            return publicData.publicUrl;
          }

          lastError = error;
          const typedError = error as { message?: unknown; status?: unknown };
          const message = typeof typedError.message === "string" ? typedError.message.toLowerCase() : "";
          const shouldRetry = message.includes("bucket") || message.includes("not found") || (typeof typedError.status === "number" && typedError.status === 404);
          if (!shouldRetry) break;
        }

        throw new Error(`Upload failed: ${getErrorMessage(lastError)}`);
      } catch (err) {
        throw new Error(`Upload failed: ${getErrorMessage(err)}`);
      }
    } else {
      // In mock mode, we create an object URL or return a random image/video/text placeholder
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }
  },
};
