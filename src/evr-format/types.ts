export interface EVRResolution {
  width: number;
  height: number;
}

export interface EVRTileConfig {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

export interface EVRManifest {
  format: 'EVR';
  formatVersion: '1.0.0';
  id: string;
  title: string;
  author: string;
  language: string;
  createdAt: string;
  updatedAt?: string;
  screenCount: number;
  sectionCount: number;
  resolution: EVRResolution;
  tileConfig: EVRTileConfig;
  rendererVersion: string;
  description?: string;
  coverImage?: string;
}

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'mathInline'
  | 'mathDisplay'
  | 'plot'
  | 'image'
  | 'table'
  | 'list'
  | 'pageBreak';

export interface BaseBlock {
  type: BlockType;
  id?: string;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: number;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface MathInlineBlock extends BaseBlock {
  type: 'mathInline';
  latex: string;
  rawText?: string;
}

export interface MathDisplayBlock extends BaseBlock {
  type: 'mathDisplay';
  latex: string;
  rawText?: string;
  svg?: string;
}

export interface PlotFunction {
  fn: string;
  color?: string;
  label?: string;
}

export interface PlotBlock extends BaseBlock {
  type: 'plot';
  title?: string;
  functions: PlotFunction[];
  xRange?: [number, number];
  yRange?: [number, number];
  showGrid?: boolean;
  showAxes?: boolean;
  caption?: string;
  svg?: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  assetPath: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  items: string[];
  ordered: boolean;
}

export interface PageBreakBlock extends BaseBlock {
  type: 'pageBreak';
}

export type BookBlock =
  | HeadingBlock
  | ParagraphBlock
  | MathInlineBlock
  | MathDisplayBlock
  | PlotBlock
  | ImageBlock
  | TableBlock
  | ListBlock
  | PageBreakBlock;

export interface EVRBookContent {
  blocks: BookBlock[];
}

export interface NavigationNode {
  id: string;
  title: string;
  screenIndex: number;
  level: number;
  children?: NavigationNode[];
}

export interface EVRNavigation {
  toc: NavigationNode[];
}

export interface TileData {
  tileIndex: number;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  containerID: number;
  pngBytes: Uint8Array;
  gray4Bytes?: Uint8Array;
}

export interface ScreenPage {
  screenIndex: number;
  pageNumber: number;
  tiles: [TileData, TileData, TileData, TileData];
}

export interface EVRReadingPosition {
  bookId: string;
  screenIndex: number;
  totalScreens: number;
  chapterTitle?: string;
  updatedAt: number;
  progressPercent: number;
}
