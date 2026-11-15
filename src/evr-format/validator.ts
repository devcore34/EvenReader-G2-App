import type JSZip from 'jszip';
import type { EVRManifest } from './types.js';

export interface EVRValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: EVRManifest;
}

export const MAX_SAFE_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_SAFE_PAGE_COUNT = 10000;

export function isSafeZipEntryPath(entryPath: string): boolean {
  if (!entryPath || typeof entryPath !== 'string') return false;
  const normalized = entryPath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.includes('/..') ||
    normalized.includes(':')
  ) {
    return false;
  }
  return true;
}

export function validateManifest(manifest: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest is not an object'] };
  }

  if (manifest.format !== 'EVR') {
    errors.push(`Invalid format: expected 'EVR', got '${manifest.format}'`);
  }

  if (!manifest.formatVersion || typeof manifest.formatVersion !== 'string') {
    errors.push('Missing formatVersion');
  }

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Missing id');
  }

  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('Missing title');
  }

  if (typeof manifest.screenCount !== 'number' || manifest.screenCount < 0) {
    errors.push('screenCount must be non-negative integer');
  } else if (manifest.screenCount > MAX_SAFE_PAGE_COUNT) {
    errors.push(`screenCount exceeds limit (${MAX_SAFE_PAGE_COUNT})`);
  }

  if (
    !manifest.resolution ||
    manifest.resolution.width !== 576 ||
    manifest.resolution.height !== 288
  ) {
    errors.push(
      `resolution must be 576x288, got ${manifest.resolution?.width}x${manifest.resolution?.height}`
    );
  }

  if (
    !manifest.tileConfig ||
    manifest.tileConfig.cols !== 2 ||
    manifest.tileConfig.rows !== 2 ||
    manifest.tileConfig.tileWidth !== 288 ||
    manifest.tileConfig.tileHeight !== 144
  ) {
    errors.push('tileConfig must be 2x2 with 288x144 tiles');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function validateEVRArchive(zip: JSZip): Promise<EVRValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const relativePath of Object.keys(zip.files)) {
    if (!isSafeZipEntryPath(relativePath)) {
      errors.push(`Unsafe path detected: "${relativePath}"`);
      return { valid: false, errors, warnings };
    }
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    errors.push('Missing manifest.json');
    return { valid: false, errors, warnings };
  }

  let manifest: EVRManifest;
  try {
    const text = await manifestFile.async('string');
    manifest = JSON.parse(text);
  } catch (err: any) {
    errors.push(`Malformed manifest.json: ${err.message}`);
    return { valid: false, errors, warnings };
  }

  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.valid) {
    errors.push(...manifestCheck.errors);
  }

  const bookFile = zip.file('book.json');
  if (!bookFile) {
    errors.push('Missing book.json');
  } else {
    try {
      const bookText = await bookFile.async('string');
      const bookData = JSON.parse(bookText);
      if (!bookData || !Array.isArray(bookData.blocks)) {
        errors.push('book.json must contain blocks array');
      }
    } catch (err: any) {
      errors.push(`Malformed book.json: ${err.message}`);
    }
  }

  const navFile = zip.file('navigation.json');
  if (!navFile) {
    errors.push('Missing navigation.json');
  } else {
    try {
      const navText = await navFile.async('string');
      const navData = JSON.parse(navText);
      if (!navData || !Array.isArray(navData.toc)) {
        errors.push('navigation.json must contain toc array');
      }
    } catch (err: any) {
      errors.push(`Malformed navigation.json: ${err.message}`);
    }
  }

  const screenCount = manifest?.screenCount ?? 0;
  if (screenCount === 0) {
    warnings.push('Document contains 0 screens');
  }

  for (let s = 1; s <= screenCount; s++) {
    const pageDir = `pages/${String(s).padStart(6, '0')}`;
    const requiredTiles = ['tile_00.png', 'tile_01.png', 'tile_02.png', 'tile_03.png'];

    for (const tileName of requiredTiles) {
      const tilePath = `${pageDir}/${tileName}`;
      if (!zip.file(tilePath)) {
        errors.push(`Missing tile: "${tilePath}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest: errors.length === 0 ? manifest : undefined
  };
}
