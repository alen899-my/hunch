import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getGlobalToken } from './api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.187.251.145:3000/api';

export type UploadCategory = 'image' | 'video' | 'audio';

export interface PresignResult {
  uploadUrl?: string;
  key?: string;
  publicUrl?: string;
  category: UploadCategory;
  mimeType: string;
  useServerUpload?: boolean;
}

export interface UploadResult {
  key: string;
  publicUrl: string;
  category: UploadCategory;
  mimeType: string;
  size?: number;
}

export interface UploadProgressInfo {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  formattedProgress: string; // e.g. "1.2 / 3.4 MB" or "450 KB / 1.8 MB"
}

// ── Format byte sizes nicely ──────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatProgress(loaded: number, total: number): string {
  if (!total || total <= 0) {
    return formatBytes(loaded);
  }
  return `${formatBytes(loaded)} / ${formatBytes(total)}`;
}

// ── Upload function: Direct to Cloudflare R2 with Native Byte-Level Progress ───
export async function uploadToR2(
  localUri: string,
  mimeType: string,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<UploadResult> {
  const token = getGlobalToken();
  const filename = localUri.split('/').pop() || `file_${Date.now()}`;

  // 1. Get file size via FileSystem info or web fetch
  let fileSize = 0;
  try {
    if (Platform.OS === 'web') {
      const fileRes = await fetch(localUri);
      const blob = await fileRes.blob();
      fileSize = blob.size;
    } else {
      const info = await FileSystem.getInfoAsync(localUri);
      fileSize = info.exists && 'size' in info ? (info.size ?? 0) : 0;
    }
  } catch {}

  // Initial progress update showing total size
  if (fileSize > 0) {
    onProgress?.({
      percent: 5,
      loadedBytes: 0,
      totalBytes: fileSize,
      formattedProgress: formatProgress(0, fileSize),
    });
  }

  try {
    // 2. Ask server for a presigned PUT URL
    const presignRes = await fetch(`${BASE_URL}/upload/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mimeType, fileSize: fileSize || 1024 }),
    });

    const presignJson = await presignRes.json();

    // If server provides a direct R2 presigned upload URL, upload directly to R2
    if (presignJson.success && presignJson.data?.uploadUrl && !presignJson.data?.useServerUpload) {
      const { uploadUrl, key, publicUrl, category } = presignJson.data as PresignResult;

      if (uploadUrl && key && publicUrl) {
        if (Platform.OS === 'web') {
          const fileRes = await fetch(localUri);
          const blob = await fileRes.blob();
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: blob,
          });
          if (putRes.ok) {
            onProgress?.({
              percent: 100,
              loadedBytes: fileSize,
              totalBytes: fileSize,
              formattedProgress: formatProgress(fileSize, fileSize),
            });
            return { key, publicUrl, category, mimeType, size: fileSize };
          }
        } else {
          // Native binary streaming directly from disk to Cloudflare R2 with progress callback
          const uploadTask = FileSystem.createUploadTask(
            uploadUrl,
            localUri,
            {
              httpMethod: 'PUT',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                'Content-Type': mimeType,
              },
            },
            (data) => {
              const loaded = data.totalBytesSent;
              const total = data.totalBytesExpectedToSend > 0 ? data.totalBytesExpectedToSend : fileSize;
              const pct = total > 0 ? Math.min(Math.round((loaded / total) * 100), 99) : 50;
              onProgress?.({
                percent: pct,
                loadedBytes: loaded,
                totalBytes: total,
                formattedProgress: formatProgress(loaded, total),
              });
            }
          );

          const uploadRes = await uploadTask.uploadAsync();

          if (uploadRes && uploadRes.status >= 200 && uploadRes.status < 300) {
            onProgress?.({
              percent: 100,
              loadedBytes: fileSize,
              totalBytes: fileSize,
              formattedProgress: formatProgress(fileSize, fileSize),
            });
            return { key, publicUrl, category, mimeType, size: fileSize };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Presigned upload attempt failed, falling back to server upload:', err);
  }

  // Fallback: Native streaming upload to server (which saves to R2 or local disk) with progress
  const result = await uploadViaServer(localUri, mimeType, filename, fileSize, onProgress);
  onProgress?.({
    percent: 100,
    loadedBytes: fileSize,
    totalBytes: fileSize,
    formattedProgress: formatProgress(fileSize, fileSize),
  });
  return result;
}

// ── Native-safe multipart upload to server with progress ──────────────────────
export async function uploadViaServer(
  localUri: string,
  mimeType: string,
  filename: string,
  fileSize?: number,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<UploadResult> {
  const token = getGlobalToken();
  const knownTotal = fileSize || 0;

  if (Platform.OS === 'web') {
    const fileRes = await fetch(localUri);
    const blob = await fileRes.blob();
    const formData = new FormData();
    formData.append('file', blob, filename);

    const res = await fetch(`${BASE_URL}/upload/file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = await res.json();
    if (!json.success || !json.data?.publicUrl) {
      throw new Error(json.message || 'Upload failed');
    }
    return json.data as UploadResult;
  } else {
    // Native iOS/Android: use FileSystem.createUploadTask with progress
    const uploadTask = FileSystem.createUploadTask(
      `${BASE_URL}/upload/file`,
      localUri,
      {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        mimeType,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (data) => {
        const loaded = data.totalBytesSent;
        const total = data.totalBytesExpectedToSend > 0 ? data.totalBytesExpectedToSend : knownTotal;
        const pct = total > 0 ? Math.min(Math.round((loaded / total) * 100), 99) : 50;
        onProgress?.({
          percent: pct,
          loadedBytes: loaded,
          totalBytes: total,
          formattedProgress: formatProgress(loaded, total),
        });
      }
    );

    const res = await uploadTask.uploadAsync();

    if (!res || res.status >= 400) {
      throw new Error(`Upload failed with status ${res?.status}: ${res?.body}`);
    }

    const json = JSON.parse(res.body);
    if (!json.success || !json.data?.publicUrl) {
      throw new Error(json.message || 'Upload failed');
    }

    return json.data as UploadResult;
  }
}

// ── Delete a file ─────────────────────────────────────────────────────────────
export async function deleteUpload(key: string): Promise<void> {
  const token = getGlobalToken();
  await fetch(`${BASE_URL}/upload`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ key }),
  });
}
