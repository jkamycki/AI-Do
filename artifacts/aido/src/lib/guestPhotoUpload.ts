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

async function legacyPhotoUpload(options: UploadGuestPhotoOptions): Promise<UploadResult> {
  const form = new FormData();
  form.append("guestName", options.guestName);
  if (options.guestEmail) form.append("guestEmail", options.guestEmail);
  if (options.caption) form.append("caption", options.caption);
  if (options.deviceId) form.append("deviceId", options.deviceId);
  form.append("photos", options.file);

  const response = await apiFetch(`/api/website/public/${encodeURIComponent(options.slug)}/photo-drop`, {
    method: "POST",
    headers: options.password ? { "X-Site-Password": options.password } : undefined,
    body: form,
  });
  const body = await parseJson(response);
  if (!response.ok) throw new Error(String(body.error || "Upload failed."));
  return body as UploadResult;
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
    // Keep the existing API upload as a safety net until production R2 CORS is
    // confirmed for direct browser PUTs.
    return legacyPhotoUpload(options);
  }
}
