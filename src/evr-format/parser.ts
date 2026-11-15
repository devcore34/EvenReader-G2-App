import JSZip from 'jszip';
import type {
  EVRManifest,
  EVRBookContent,
  EVRNavigation,
  ScreenPage,
  TileData
} from './types.js';
import { validateEVRArchive } from './validator.js';

export class EVRDocument {
  private zip: JSZip;
  public readonly manifest: EVRManifest;
  private cachedContent?: EVRBookContent;
  private cachedNav?: EVRNavigation;

  constructor(zip: JSZip, manifest: EVRManifest) {
    this.zip = zip;
    this.manifest = manifest;
  }

  public static async load(data: ArrayBuffer | Uint8Array): Promise<EVRDocument> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch (err: any) {
      throw new Error(`Invalid archive: ${err.message}`);
    }

    const validation = await validateEVRArchive(zip);
    if (!validation.valid || !validation.manifest) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    return new EVRDocument(zip, validation.manifest);
  }

  public async getBookContent(): Promise<EVRBookContent> {
    if (this.cachedContent) return this.cachedContent;

    const file = this.zip.file('book.json');
    if (!file) throw new Error('Missing book.json');

    const text = await file.async('string');
    this.cachedContent = JSON.parse(text);
    return this.cachedContent!;
  }

  public async getNavigation(): Promise<EVRNavigation> {
    if (this.cachedNav) return this.cachedNav;

    const file = this.zip.file('navigation.json');
    if (!file) throw new Error('Missing navigation.json');

    const text = await file.async('string');
    this.cachedNav = JSON.parse(text);
    return this.cachedNav!;
  }

  public async getPage(screenIndex: number): Promise<ScreenPage> {
    if (screenIndex < 0 || screenIndex >= this.manifest.screenCount) {
      throw new Error(
        `Invalid screenIndex ${screenIndex} (total screens: ${this.manifest.screenCount})`
      );
    }

    const pageNumber = screenIndex + 1;
    const pageDir = `pages/${String(pageNumber).padStart(6, '0')}`;

    const tileConfigs = [
      { tileIndex: 0, col: 0, row: 0, x: 0, y: 0, containerID: 1, name: 'tile_00.png' },
      { tileIndex: 1, col: 1, row: 0, x: 288, y: 0, containerID: 2, name: 'tile_01.png' },
      { tileIndex: 2, col: 0, row: 1, x: 0, y: 144, containerID: 3, name: 'tile_02.png' },
      { tileIndex: 3, col: 1, row: 1, x: 288, y: 144, containerID: 4, name: 'tile_03.png' }
    ];

    const tiles: TileData[] = [];

    for (const cfg of tileConfigs) {
      const tilePath = `${pageDir}/${cfg.name}`;
      const file = this.zip.file(tilePath);
      if (!file) {
        throw new Error(`Tile not found: ${tilePath}`);
      }

      const pngBytes = await file.async('uint8array');

      tiles.push({
        tileIndex: cfg.tileIndex,
        col: cfg.col,
        row: cfg.row,
        x: cfg.x,
        y: cfg.y,
        width: 288,
        height: 144,
        containerID: cfg.containerID,
        pngBytes
      });
    }

    return {
      screenIndex,
      pageNumber,
      tiles: tiles as [TileData, TileData, TileData, TileData]
    };
  }

  public async getAsset(assetPath: string): Promise<Uint8Array | null> {
    const fullPath = assetPath.startsWith('assets/') ? assetPath : `assets/${assetPath}`;
    const file = this.zip.file(fullPath);
    if (!file) return null;
    return await file.async('uint8array');
  }
}
