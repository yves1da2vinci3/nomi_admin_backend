import B2 from "backblaze-b2";

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const bucketId = process.env.B2_BUCKET_ID;
const bucketName = process.env.B2_BUCKET_NAME || "nomiBucket";
const downloadUrl = process.env.B2_DOWNLOAD_URL;

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

export async function uploadAdminImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  if (!keyId || !applicationKey || !bucketId || !downloadUrl) {
    throw new Error("Backblaze B2 credentials are not configured (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_DOWNLOAD_URL required)");
  }

  const b2FileName = `admin-scenarios/${filename}`;

  return await runWithB2Reauth("uploadAdminImage", async () => {
    const { data: { uploadUrl, authorizationToken } } = await b2.getUploadUrl({ bucketId: bucketId! });

    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName: b2FileName,
      data: buffer,
      contentType,
    });

    const url = `${downloadUrl}/file/${bucketName}/${b2FileName}`;
    new URL(url); // validate URL
    console.info("[B2] Image uploaded:", url);
    return url;
  });
}
