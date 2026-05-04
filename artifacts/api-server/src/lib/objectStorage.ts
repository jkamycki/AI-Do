import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable, PassThrough } from "stream";
import { randomUUID } from "crypto";
import {
  type StorageFile,
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured.");
  return bucket;
}

function getPrivatePrefix(): string {
  return (process.env.R2_PRIVATE_PREFIX ?? "private").replace(/\/$/, "");
}

function getPublicPrefix(): string {
  return (process.env.R2_PUBLIC_PREFIX ?? "public").replace(/\/$/, "");
}

export class R2File implements StorageFile {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    public readonly name: string,
  ) {}

  async exists(): Promise<[boolean]> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }),
      );
      return [true];
    } catch (err: unknown) {
      const anyErr = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        anyErr?.name === "NotFound" ||
        anyErr?.name === "NoSuchKey" ||
        anyErr?.$metadata?.httpStatusCode === 404
      ) {
        return [false];
      }
      throw err;
    }
  }

  async getMetadata(): Promise<
    [{ contentType: string; size: string; metadata: Record<string, string> }]
  > {
    const res = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }),
    );
    return [
      {
        contentType: res.ContentType ?? "application/octet-stream",
        size: String(res.ContentLength ?? 0),
        metadata: res.Metadata ?? {},
      },
    ];
  }

  async download(): Promise<[Buffer]> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.name }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return [Buffer.concat(chunks)];
  }

  createReadStream(): Readable {
    const pass = new PassThrough();
    const { client, bucket, name: key } = this;

    (async () => {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
          pass.write(chunk);
        }
        pass.end();
      } catch (err) {
        pass.destroy(err as Error);
      }
    })();

    return pass;
  }

  async setMetadata({
    metadata,
  }: {
    metadata: Record<string, string>;
  }): Promise<void> {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }),
    );
    const existing = head.Metadata ?? {};
    const contentType = head.ContentType ?? "application/octet-stream";

    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: this.name,
        CopySource: `${this.bucket}/${this.name}`,
        MetadataDirective: "REPLACE",
        ContentType: contentType,
        Metadata: { ...existing, ...metadata },
      }),
    );
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private get client(): S3Client {
    return createR2Client();
  }

  private get bucket(): string {
    return getBucketName();
  }

  async searchPublicObject(filePath: string): Promise<R2File | null> {
    const prefix = getPublicPrefix();
    const key = `${prefix}/${filePath}`;
    const file = new R2File(this.client, this.bucket, key);
    const [exists] = await file.exists();
    return exists ? file : null;
  }

  async downloadObject(
    file: R2File,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType,
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = metadata.size;
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const prefix = getPrivatePrefix();
    const objectId = randomUUID();
    const key = `${prefix}/uploads/${objectId}`;

    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 900 },
    );
  }

  normalizeObjectEntityPath(rawPath: string): string {
    try {
      const url = new URL(rawPath);
      const prefix = getPrivatePrefix();
      const bucket = getBucketName();

      // Pathname is /<bucket>/<key> for path-style, or /<key> for vhost-style
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === bucket) parts.shift();

      const key = parts.join("/");
      const normalizedPrefix = `${prefix}/uploads/`;

      if (key.startsWith(normalizedPrefix)) {
        return `/objects/uploads/${key.slice(normalizedPrefix.length)}`;
      }

      return rawPath;
    } catch {
      return rawPath;
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<R2File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const prefix = getPrivatePrefix();
    const entityId = objectPath.slice("/objects/".length);
    const key = `${prefix}/${entityId}`;

    const file = new R2File(this.client, this.bucket, key);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();

    return file;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: R2File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = "uploads",
  ): Promise<string> {
    const prefix = getPublicPrefix();
    const key = `${prefix}/${folder}/${fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    // Return a URL that the public-objects route can actually serve.
    // searchPublicObject() prepends the public prefix internally, so we only
    // include the folder + fileName here.
    return `/api/storage/public-objects/${folder}/${fileName}`;
  }
}
