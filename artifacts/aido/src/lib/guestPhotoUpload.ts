import { apiFetch } from "@/lib/authFetch";

type UploadGuestPhotoOptions = {
  slug: string;
  file: File;
  guestName: string;
  guestEmail?: string;
  caption?: string;
  deviceId?: string;
  password?: string;
};

type UploadResult = {
  success?: boolean;
  message?: string;
  usage?: {
    limit: number;
    uploadedCount: number;
    remaining: number;
    maxPerUpload?: number;
  };
};

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export async function uploadGuestPhoto(options: UploadGuestPhotoOptions): Promise<UploadResult> {
  try {
    const createResponse = await apiFetch(`/api/website/public/${encodeURIComponent(options.slug)}/photo-drop/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.password ? { "X-Site-Password": options.password } : {}),
      },
      body: JSON.stringify({
        guestName: options.guestName,
        guestEmail: options.guestEmail || undefined,
        caption: options.caption || undefined,
        deviceId: options.deviceId || undefined,
        fileName: options.file.name,
        contentType: options.file.type || "image/jpeg",
        fileSize: options.file.size,
      }),
    });
    const createBody = await parseJson(createResponse);
    if (!createResponse.ok) throw new Error(String(createBody.error || "Could not prepare upload."));

    const uploadUrl = String(createBody.uploadUrl || "");
    const objectPath = String(createBody.objectPath || "");
    if (!uploadUrl || !objectPath) throw new Error("Upload URL was not created.");

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": options.file.type || "image/jpeg" },
      body: options.file,
    });
    if (!putResponse.ok) throw new Error("Photo storage upload failed.");

    const completeResponse = await apiFetch(`/api/website/public/${encodeURIComponent(options.slug)}/photo-drop/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.password ? { "X-Site-Password": options.password } : {}),
      },
      body: JSON.stringify({
        guestName: options.guestName,
        guestEmail: options.guestEmail || undefined,
        caption: options.caption || undefined,
        deviceId: options.deviceId || undefined,
        objectPath,
        originalName: String(createBody.originalName || options.file.name),
        contentType: options.file.type || "image/jpeg",
        fileSize: options.file.size,
      }),
    });
    const completeBody = await parseJson(completeResponse);
    if (!completeResponse.ok) throw new Error(String(completeBody.error || "Could not finish upload."));
    return completeBody as UploadResult;
  } catch (error) {
    // Guest photos should go directly to object storage. Falling back to the
    // legacy API upload can push large photo buffers through the Render process
    // during busy events, which is the exact scale bottleneck this flow avoids.
    if (error instanceof Error) throw error;
    throw new Error("Photo upload failed.");
  }
}
