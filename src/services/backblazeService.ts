import B2 from "backblaze-b2";

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const bucketId = process.env.B2_BUCKET_ID;
const bucketName = process.env.B2_BUCKET_NAME || "nomiBucket";
/** Base URL pour `…/file/{bucket}/{path}` — alias nomi_backend : `BACKBLAZE_BUCKET_URL`. */
const downloadUrl =
  process.env.B2_DOWNLOAD_URL || process.env.BACKBLAZE_BUCKET_URL;

if (!keyId || !applicationKey || !bucketId || !downloadUrl) {
  console.warn(
    "[B2] Backblaze credentials not fully configured — uploads will fail.",
    { hasKeyId: !!keyId, hasApplicationKey: !!applicationKey, hasBucketId: !!bucketId, hasDownloadUrl: !!downloadUrl }
  );
}

const b2 = new B2({
  applicationKeyId: keyId || "",
  applicationKey: applicationKey || "",
});

let authorization: { data: { downloadUrl: string; apiUrl: string } } | null = null;

const MAX_REAUTH = 2;

function invalidateAuthorization(): void {
  authorization = null;
}

function isUnauthorizedError(error: unknown): boolean {
  const e = error as Record<string, unknown> | undefined;
  const response = e?.response as { status?: number } | undefined;
  if (response?.status === 401) return true;
  const msg = typeof e?.message === "string" ? e.message : typeof error === "string" ? error : "";
  return /\b401\b/.test(msg) || /status code 401/i.test(msg);
}

async function runWithB2Reauth<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_REAUTH; attempt++) {
    try {
      await authorize();
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isUnauthorizedError(error) || attempt === MAX_REAUTH - 1) throw error;
      console.warn(`[B2] ${label}: 401 — invalidating session and retrying (attempt ${attempt + 1})`);
      invalidateAuthorization();
    }
  }
  throw lastError;
}

async function authorize(): Promise<void> {
  if (!keyId || !applicationKey) throw new Error("B2_KEY_ID and B2_APPLICATION_KEY must be set");
  if (!authorization) {
    authorization = await b2.authorize() as { data: { downloadUrl: string; apiUrl: string } };
    if (!authorization?.data?.downloadUrl) {
      throw new Error("Backblaze B2 authorization did not return downloadUrl");
    }
    console.info("[B2] Authorization successful");
  }
}

function requireB2Config(): void {
  if (!keyId || !applicationKey || !bucketId || !downloadUrl) {
    throw new Error(
      "Backblaze B2 n'est pas configuré (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, et B2_DOWNLOAD_URL ou BACKBLAZE_BUCKET_URL requis)"
    );
  }
}

function sanitizeB2FileName(fileName: string): string {
  const cleaned = fileName.replace(/^\/+/, "").replace(/\.\./g, "").trim();
  if (!cleaned || cleaned.length > 500) {
    throw new Error("Nom de fichier B2 invalide");
  }
  return cleaned;
}

/** Upload vers B2 avec une clé objet libre (préfixe inclus). */
export async function uploadB2File(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  requireB2Config();
  const b2FileName = sanitizeB2FileName(fileName);

  return await runWithB2Reauth("uploadB2File", async () => {
    const { data: { uploadUrl, authorizationToken } } = await b2.getUploadUrl({ bucketId: bucketId! });

    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName: b2FileName,
      data: buffer,
      contentType,
    });

    const url = `${downloadUrl}/file/${bucketName}/${b2FileName}`;
    new URL(url);
    console.info("[B2] File uploaded:", url);
    return url;
  });
}

export async function uploadAdminImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  return uploadB2File(buffer, `admin-scenarios/${filename}`, contentType);
}
