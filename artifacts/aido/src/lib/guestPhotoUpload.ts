import { apiFetch } from "@/lib/authFetch";

type UploadGuestPhotoOptions = {
  slug: string;
  file: File;
  guestName: string;
  guestEmail?: string;
  caption?: string;
  deviceId?: string;
  deviceFingerprint?: string;
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

class RecoverableGuestPhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoverableGuestPhotoUploadError";
  }
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

async function uploadGuestPhotoViaApi(options: UploadGuestPhotoOptions): Promise<UploadResult> {
  const form = new FormData();
  form.append("guestName", options.guestName);
  if (options.guestEmail) form.append("guestEmail", options.guestEmail);
  if (options.caption) form.append("caption", options.caption);
  if (options.deviceId) form.append("deviceId", options.deviceId);
  if (options.deviceFingerprint) form.append("deviceFingerprint", options.deviceFingerprint);
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

async function uploadGuestPhotoDirect(options: UploadGuestPhotoOptions): Promise<UploadResult> {
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
      deviceFingerprint: options.deviceFingerprint || undefined,
      fileName: options.file.name,
      contentType: options.file.type || "image/jpeg",
      fileSize: options.file.size,
    }),
  });
  const createBody = await parseJson(createResponse);
  if (!createResponse.ok) {
    const message = String(createBody.error || "Could not prepare upload.");
    if (createResponse.status >= 500) throw new RecoverableGuestPhotoUploadError(message);
    throw new Error(message);
  }

  const uploadUrl = String(createBody.uploadUrl || "");
  const objectPath = String(createBody.objectPath || "");
  if (!uploadUrl || !objectPath) throw new RecoverableGuestPhotoUploadError("Upload URL was not created.");

  try {
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": options.file.type || "image/jpeg" },
      body: options.file,
    });
    if (!putResponse.ok) throw new RecoverableGuestPhotoUploadError("Photo storage upload failed.");
  } catch (error) {
    if (error instanceof RecoverableGuestPhotoUploadError) throw error;
    throw new RecoverableGuestPhotoUploadError("Photo storage upload failed.");
  }

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
      deviceFingerprint: options.deviceFingerprint || undefined,
      objectPath,
      originalName: String(createBody.originalName || options.file.name),
      contentType: options.file.type || "image/jpeg",
      fileSize: options.file.size,
    }),
  });
  const completeBody = await parseJson(completeResponse);
  if (!completeResponse.ok) {
    const message = String(completeBody.error || "Could not finish upload.");
    if (completeResponse.status >= 500) throw new RecoverableGuestPhotoUploadError(message);
    throw new Error(message);
  }
  return completeBody as UploadResult;
}

export async function uploadGuestPhoto(options: UploadGuestPhotoOptions): Promise<UploadResult> {
  try {
    return await uploadGuestPhotoDirect(options);
  } catch (error) {
    if (error instanceof RecoverableGuestPhotoUploadError) {
      return uploadGuestPhotoViaApi(options);
    }
    if (error instanceof Error) throw error;
    throw new Error("Photo upload failed.");
  }
}
