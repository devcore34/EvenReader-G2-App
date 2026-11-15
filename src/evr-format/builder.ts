import JSZip from 'jszip';
import type {
  EVRManifest,
  EVRBookContent,
  EVRNavigation,
  NavigationNode,
  BookBlock
} from './types.js';

export interface EVRMetadataInput {
  id?: string;
  title: string;
  author?: string;
  language?: string;
  description?: string;
  rendererVersion?: string;
}

export class EVRBuilder {
  private zip: JSZip;
  private metadata: EVRMetadataInput;
  private blocks: BookBlock[] = [];
  private toc: NavigationNode[] = [];
  private pages: Map<number, [Uint8Array, Uint8Array, Uint8Array, Uint8Array]> = new Map();
  private assets: Map<string, Uint8Array> = new Map();

  constructor(metadata: EVRMetadataInput) {
    this.zip = new JSZip();
    this.metadata = {
      id: metadata.id || `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: metadata.title || 'Untitled Document',
      author: metadata.author || 'Unknown Author',
      language: metadata.language || 'ru',
      description: metadata.description || '',
      rendererVersion: metadata.rendererVersion || '1.0.0'
    };
  }

  public setBookContent(content: EVRBookContent | BookBlock[]): this {
    if (Array.isArray(content)) {
      this.blocks = content;
    } else {
      this.blocks = content.blocks;
    }
    return this;
  }

  public addBlock(block: BookBlock): this {
    this.blocks.push(block);
    return this;
  }

  public setNavigation(navigation: EVRNavigation | NavigationNode[]): this {
    if (Array.isArray(navigation)) {
      this.toc = navigation;
    } else {
      this.toc = navigation.toc;
    }
    return this;
  }

  public addNavigationItem(node: NavigationNode): this {
    this.toc.push(node);
    return this;
  }

  public addScreenTiles(
    screenIndex: number,
    tiles: [Uint8Array, Uint8Array, Uint8Array, Uint8Array]
  ): this {
    this.pages.set(screenIndex, tiles);
    return this;
  }

  public addAsset(path: string, data: Uint8Array): this {
    const cleanPath = path.replace(/^\/+/, '');
    this.assets.set(cleanPath, data);
    return this;
  }

  public async build(): Promise<Uint8Array> {
    const screenCount = this.pages.size;

    const manifest: EVRManifest = {
      format: 'EVR',
      formatVersion: '1.0.0',
      id: this.metadata.id!,
      title: this.metadata.title,
      author: this.metadata.author!,
      language: this.metadata.language!,
      createdAt: new Date().toISOString(),
      screenCount,
      sectionCount: this.toc.length,
      resolution: {
        width: 576,
        height: 288
      },
      tileConfig: {
        cols: 2,
        rows: 2,
        tileWidth: 288,
        tileHeight: 144
      },
      rendererVersion: this.metadata.rendererVersion!,
      description: this.metadata.description
    };

    this.zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const bookContent: EVRBookContent = {
      blocks: this.blocks
    };
    this.zip.file('book.json', JSON.stringify(bookContent, null, 2));

    const navigation: EVRNavigation = {
      toc: this.toc
    };
    this.zip.file('navigation.json', JSON.stringify(navigation, null, 2));

    const sortedIndices = Array.from(this.pages.keys()).sort((a, b) => a - b);
    for (let i = 0; i < sortedIndices.length; i++) {
      const screenIdx = sortedIndices[i];
      const pageNum = i + 1;
      const pageDir = `pages/${String(pageNum).padStart(6, '0')}`;
      const tiles = this.pages.get(screenIdx)!;

      this.zip.file(`${pageDir}/tile_00.png`, tiles[0]);
      this.zip.file(`${pageDir}/tile_01.png`, tiles[1]);
      this.zip.file(`${pageDir}/tile_02.png`, tiles[2]);
      this.zip.file(`${pageDir}/tile_03.png`, tiles[3]);
    }

    for (const [assetPath, data] of this.assets.entries()) {
      this.zip.file(`assets/${assetPath}`, data);
    }

    return await this.zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }
}
