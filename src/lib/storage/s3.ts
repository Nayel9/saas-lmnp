import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  createPresignedPost,
  type PresignedPost,
} from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const TEN_MB = 10 * 1024 * 1024;

export function getS3Config() {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BUCKET,
    S3_FORCE_PATH_STYLE,
  } = process.env;
  if (!S3_BUCKET) throw new Error("S3_BUCKET manquant");
  if (!S3_REGION && !S3_ENDPOINT)
    throw new Error("S3_REGION ou S3_ENDPOINT requis");
  return {
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "auto",
    credentials:
      S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    bucket: S3_BUCKET,
    forcePathStyle: S3_FORCE_PATH_STYLE === "true",
  } as const;
}

let _client: S3Client | null = null;
export function getS3Client() {
  if (_client) return _client;
  const cfg = getS3Config();
  _client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: cfg.credentials,
  });
  return _client;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
}

export function buildStorageKey(params: {
  userId: string;
  entryId: string;
  fileName: string;
}) {
  const { userId, entryId, fileName } = params;
  const safe = sanitizeFileName(fileName);
  const uid = Math.random().toString(36).slice(2, 10);
  return `${userId}/${entryId}/${Date.now()}_${uid}_${safe}`;
}

export async function presignPost(params: {
  userId: string;
  entryId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  maxSize?: number;
  expiresSec?: number;
}): Promise<PresignedPost & { storageKey: string }> {
  const { bucket } = getS3Config();
  const client = getS3Client();
  const storageKey = buildStorageKey({
    userId: params.userId,
    entryId: params.entryId,
    fileName: params.fileName,
  });
  const max = params.maxSize ?? TEN_MB;
  const expires = params.expiresSec ?? 300;
  const policy = await createPresignedPost(client, {
    Bucket: bucket,
    Key: storageKey,
    Conditions: [
      ["content-length-range", 0, max],
      { "Content-Type": params.mimeType },
    ],
    Fields: { "Content-Type": params.mimeType },
    Expires: expires,
  });
  return { ...policy, storageKey };
}

export async function presignGet(params: {
  storageKey: string;
  expiresSec?: number;
}): Promise<string> {
  const client = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: getS3Config().bucket,
    Key: params.storageKey,
  });
  return await getSignedUrl(client, cmd, {
    expiresIn: params.expiresSec ?? 120,
  });
}

export async function presignGetWithDisposition(params: {
  storageKey: string;
  expiresSec?: number;
  disposition: string;
}): Promise<string> {
  const client = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: getS3Config().bucket,
    Key: params.storageKey,
    ResponseContentDisposition: params.disposition,
  });
  return await getSignedUrl(client, cmd, {
    expiresIn: params.expiresSec ?? 120,
  });
}

function localPathFor(storageKey: string) {
  const base = path.join(process.cwd(), ".uploads");
  return path.join(base, storageKey.replace(/^mock\//, ""));
}

export async function getObjectStream(storageKey: string): Promise<Readable> {
  // Chemin local mock: ne pas exiger la config S3
  if (storageKey.startsWith("mock/")) {
    const filePath = localPathFor(storageKey);
    return fs.createReadStream(filePath);
  }
  const client = getS3Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getS3Config().bucket, Key: storageKey }),
  );
  const body = res.Body as unknown;
  if (!body) throw new Error("STREAM_NOT_AVAILABLE");
  const maybePipe = (body as { pipe?: unknown }).pipe;
  if (typeof maybePipe === "function") {
    return body as Readable;
  }
  throw new Error("UNSUPPORTED_BODY_STREAM");
}

export async function deleteObject(storageKey: string) {
  // Court-circuit mock local sans exiger la config S3
  if (storageKey.startsWith("mock/")) {
    const filePath = localPathFor(storageKey);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("Failed to delete local upload", err);
    }
    return;
  }
  const { bucket } = getS3Config();
  const client = getS3Client();
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
  } catch (err) {
    console.warn("Failed to delete S3 object", err);
  }
}
