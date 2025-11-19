/**
 * S3 Client Module (T022)
 *
 * Provides S3 client factory and operations for draft storage.
 * This is foundational infrastructure used by s3-draft-client.ts.
 *
 * Security notes:
 * - Uses AWS SDK default credential chain (no hardcoded credentials)
 * - Does NOT set ServerSideEncryption header (bucket default SSE-S3 handles this)
 * - Signed URLs are time-limited for secure access
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { serverEnv } from './env';

// =============================================================================
// Types
// =============================================================================

export interface SignedUrlParams {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds, default 3600
}

export interface SignedUploadUrlParams extends SignedUrlParams {
  contentType: string;
}

export interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export interface GetObjectParams {
  bucket: string;
  key: string;
}

export interface DeleteObjectParams {
  bucket: string;
  key: string;
}

export interface GetObjectResult {
  body: Uint8Array;
  contentType: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EXPIRATION_SECONDS = 3600; // 1 hour

// =============================================================================
// S3 Client Factory
// =============================================================================

/**
 * Creates a configured S3 client using environment settings.
 * Uses AWS SDK default credential provider chain.
 */
export function createS3Client(): S3Client {
  return new S3Client({
    region: serverEnv.AWS_REGION,
  });
}

// Singleton client for internal use
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

// =============================================================================
// Validation Helpers
// =============================================================================

function validateBucket(bucket: string): void {
  if (!bucket || bucket.trim() === '') {
    throw new Error('bucket is required and cannot be empty');
  }
}

function validateKey(key: string): void {
  if (!key || key.trim() === '') {
    throw new Error('key is required and cannot be empty');
  }
}

function validateContentType(contentType: string): void {
  if (!contentType || contentType.trim() === '') {
    throw new Error('contentType is required and cannot be empty');
  }
}

// =============================================================================
// Signed URL Generation
// =============================================================================

/**
 * Generate a pre-signed URL for downloading (GET) an object.
 *
 * @param params - Bucket, key, and optional expiration
 * @returns Pre-signed URL string
 */
export async function getSignedDownloadUrl(
  params: SignedUrlParams
): Promise<string> {
  validateBucket(params.bucket);
  validateKey(params.key);

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: params.expiresIn ?? DEFAULT_EXPIRATION_SECONDS,
  });

  return url;
}

/**
 * Generate a pre-signed URL for uploading (PUT) an object.
 * The Content-Type header is included in the signature.
 *
 * @param params - Bucket, key, content type, and optional expiration
 * @returns Pre-signed URL string
 */
export async function getSignedUploadUrl(
  params: SignedUploadUrlParams
): Promise<string> {
  validateBucket(params.bucket);
  validateKey(params.key);
  validateContentType(params.contentType);

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: params.expiresIn ?? DEFAULT_EXPIRATION_SECONDS,
  });

  return url;
}

// =============================================================================
// Object Operations
// =============================================================================

/**
 * Upload an object to S3.
 *
 * Note: Does NOT set ServerSideEncryption header.
 * The bucket is configured with SSE-S3 as default encryption.
 *
 * @param params - Bucket, key, body content, and content type
 */
export async function putObject(params: PutObjectParams): Promise<void> {
  validateBucket(params.bucket);
  validateKey(params.key);
  validateContentType(params.contentType);

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    // NOTE: No ServerSideEncryption header - bucket default SSE-S3 handles this
  });

  await client.send(command);
}

/**
 * Retrieve an object from S3.
 *
 * @param params - Bucket and key
 * @returns Object body as Uint8Array and content type
 * @throws NoSuchKey if object doesn't exist
 * @throws AccessDenied if permission denied
 */
export async function getObject(
  params: GetObjectParams
): Promise<GetObjectResult> {
  validateBucket(params.bucket);
  validateKey(params.key);

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Empty body returned for key: ${params.key}`);
  }

  // AWS SDK v3 returns a stream, convert to Uint8Array
  const body = await response.Body.transformToByteArray();
  const contentType = response.ContentType ?? 'application/octet-stream';

  return {
    body,
    contentType,
  };
}

/**
 * Delete an object from S3.
 *
 * Note: S3 delete is idempotent - deleting a non-existent key succeeds silently.
 *
 * @param params - Bucket and key
 * @throws AccessDenied if permission denied
 */
export async function deleteObject(params: DeleteObjectParams): Promise<void> {
  validateBucket(params.bucket);
  validateKey(params.key);

  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  await client.send(command);
}
