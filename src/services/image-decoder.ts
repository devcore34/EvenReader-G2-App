import { rgbaToGray4, TILE_WIDTH, TILE_HEIGHT } from '@even-reader/evr-format';

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function getSharedCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = TILE_WIDTH;
    sharedCanvas.height = TILE_HEIGHT;
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true })!;
  }
  return { canvas: sharedCanvas, ctx: sharedCtx! };
}

export async function decodePngTileToGray4(pngBytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' });

  if (typeof createImageBitmap !== 'undefined') {
    const bitmap = await createImageBitmap(blob);
    const { ctx } = getSharedCanvas();
    ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    ctx.drawImage(bitmap, 0, 0, TILE_WIDTH, TILE_HEIGHT);
    const imgData = ctx.getImageData(0, 0, TILE_WIDTH, TILE_HEIGHT);
    return rgbaToGray4(imgData.data, TILE_WIDTH, TILE_HEIGHT);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const { ctx } = getSharedCanvas();
      ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
      ctx.drawImage(img, 0, 0, TILE_WIDTH, TILE_HEIGHT);
      URL.revokeObjectURL(url);
      const imgData = ctx.getImageData(0, 0, TILE_WIDTH, TILE_HEIGHT);
      resolve(rgbaToGray4(imgData.data, TILE_WIDTH, TILE_HEIGHT));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load tile image: ' + e));
    };
    img.src = url;
  });
}

export function pngBytesToDataUrl(pngBytes: Uint8Array): string {
  const blob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' });
  return URL.createObjectURL(blob);
}
