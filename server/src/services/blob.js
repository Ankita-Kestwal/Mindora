// Microsoft Azure Blob Storage — private file storage for uploaded documents.
// Files live at  users/{uid}/syllabi/{syllabusId}/{fileName}  in a PRIVATE container.
// The browser never receives storage credentials; downloads are streamed through the API
// after the user's Firebase token has been checked.
import { BlobServiceClient } from '@azure/storage-blob';
import { env } from '../config/env.js';

let container = null;
let ensured = false;

export function blobConfigured() {
  const cs = env.azure.storageConnectionString;
  return Boolean(cs && !cs.startsWith('paste'));
}

async function client() {
  if (!blobConfigured()) {
    throw Object.assign(new Error('Azure Blob Storage is not configured. Add AZURE_STORAGE_CONNECTION_STRING to server/.env.'), { status: 503, code: 'blob/not-configured' });
  }
  if (!container) {
    try {
      container = BlobServiceClient.fromConnectionString(env.azure.storageConnectionString).getContainerClient(env.azure.storageContainer);
    } catch {
      throw Object.assign(new Error('AZURE_STORAGE_CONNECTION_STRING is not valid. Copy it again from the storage account → Access keys.'), { status: 503, code: 'blob/bad-config' });
    }
  }
  if (!ensured) {
    try { await container.createIfNotExists(); ensured = true; } catch (e) { throw friendly(e); }
  }
  return container;
}

function friendly(e) {
  const code = e?.code || e?.details?.errorCode || '';
  if (/AuthenticationFailed|AuthorizationFailure/i.test(code)) return Object.assign(new Error('Azure Storage rejected the key. Copy the connection string again from Access keys.'), { status: 502 });
  if (/ENOTFOUND|ECONNREFUSED/i.test(e?.code || e?.message)) return Object.assign(new Error('Can’t reach Azure Storage. Check the connection string and your internet.'), { status: 502 });
  return Object.assign(new Error(`Azure Storage error: ${e.message}`), { status: 502 });
}

export async function uploadBlob(path, buffer, contentType) {
  const c = await client();
  try {
    await c.getBlockBlobClient(path).uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  } catch (e) { throw friendly(e); }
}

export async function downloadBlob(path) {
  const c = await client();
  try { return await c.getBlockBlobClient(path).downloadToBuffer(); } catch (e) {
    if (e.statusCode === 404) throw Object.assign(new Error('File not found in storage.'), { status: 404 });
    throw friendly(e);
  }
}

export async function deleteBlob(path) {
  const c = await client();
  try { await c.getBlockBlobClient(path).deleteIfExists(); } catch (e) { throw friendly(e); }
}

export function resetBlobForTests() { container = null; ensured = false; }
