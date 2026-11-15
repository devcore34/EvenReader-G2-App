import {
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
  OsEventTypeList,
  EventSourceType,
  ImageRawDataUpdateResult,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ImageContainerProperty,
  TextContainerProperty,
  ImageRawDataUpdate,
  validateEvenHubPageContainer
} from '@evenrealities/even_hub_sdk';
import { decodePngTileToGray4 } from './image-decoder.js';

export interface G2EventListener {
  onNextScreen?: () => void;
  onPrevScreen?: () => void;
  onSingleClick?: () => void;
  onDoubleClick?: () => void;
  onLongPress?: () => void;
  onRawEvent?: (event: EvenHubEvent, sourceDesc: string) => void;
}

class EvenBridgeService {
  private bridge: EvenAppBridge | null = null;
  private isInitialized = false;
  private isPageCreated = false;
  private activeListeners: G2EventListener[] = [];
  private unsubscribeEvent: (() => void) | null = null;
  private updateQueue: Promise<void> = Promise.resolve();

  public isConnectedToBridge(): boolean {
    return this.isInitialized && this.bridge !== null;
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      this.bridge = await waitForEvenAppBridge();
      this.isInitialized = true;

      this.unsubscribeEvent = this.bridge.onEvenHubEvent((event) => {
        this.dispatchEvenHubEvent(event);
      });

      return true;
    } catch {
      this.setupBrowserKeyboardFallback();
      return false;
    }
  }

  public async setupReaderPage(): Promise<boolean> {
    if (!this.bridge) return false;

    const imageObjects = [
      new ImageContainerProperty({
        containerID: 1,
        containerName: 'img_tl',
        xPosition: 0,
        yPosition: 0,
        width: 288,
        height: 144,
        zOrderIndex: 0
      }),
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img_tr',
        xPosition: 288,
        yPosition: 0,
        width: 288,
        height: 144,
        zOrderIndex: 1
      }),
      new ImageContainerProperty({
        containerID: 3,
        containerName: 'img_bl',
        xPosition: 0,
        yPosition: 144,
        width: 288,
        height: 144,
        zOrderIndex: 2
      }),
      new ImageContainerProperty({
        containerID: 4,
        containerName: 'img_br',
        xPosition: 288,
        yPosition: 144,
        width: 288,
        height: 144,
        zOrderIndex: 3
      })
    ];

    const textObjects = [
      new TextContainerProperty({
        containerID: 5,
        containerName: 'event_capture',
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
        zOrderIndex: 4,
        isEventCapture: 1,
        content: ''
      })
    ];

    const pagePayload = {
      containerTotalNum: 5,
      imageObject: imageObjects,
      textObject: textObjects
    };

    const validation = validateEvenHubPageContainer(pagePayload);
    if (!validation.valid) {
      console.error('Validation error:', validation);
      return false;
    }

    try {
      if (!this.isPageCreated) {
        const startupContainer = new CreateStartUpPageContainer(pagePayload);
        await this.bridge.createStartUpPageContainer(startupContainer);
        this.isPageCreated = true;
      } else {
        const rebuildContainer = new RebuildPageContainer(pagePayload);
        await this.bridge.rebuildPageContainer(rebuildContainer);
      }
      return true;
    } catch (err) {
      console.error('Failed to configure page:', err);
      return false;
    }
  }

  private currentTransferId = 0;

  public async updateScreenTiles(
    tiles: [Uint8Array, Uint8Array, Uint8Array, Uint8Array]
  ): Promise<boolean> {
    if (!this.bridge) {
      return true;
    }

    const transferId = ++this.currentTransferId;

    return new Promise<boolean>((resolve) => {
      this.updateQueue = this.updateQueue.then(async () => {
        if (transferId !== this.currentTransferId) {
          resolve(true);
          return;
        }

        try {
          const containerIDs = [1, 2, 3, 4];

          for (let i = 0; i < 4; i++) {
            if (transferId !== this.currentTransferId) {
              resolve(true);
              return;
            }

            const pngBytes = tiles[i];
            const gray4Data = await decodePngTileToGray4(pngBytes);

            const rawUpdate = new ImageRawDataUpdate({
              containerID: containerIDs[i],
              containerName: `img_tile_${i}`,
              imageData: gray4Data
            });

            const result = await this.bridge!.updateImageRawData(rawUpdate);

            if (result !== ImageRawDataUpdateResult.success) {
              console.warn(`Tile ${i + 1} status:`, result);
            }

            await new Promise((r) => setTimeout(r, 40));
          }

          resolve(true);
        } catch (err) {
          console.error('Failed to update tiles:', err);
          resolve(false);
        }
      });
    });
  }

  public async closeReader(): Promise<void> {
    if (!this.bridge) return;
    try {
      await this.bridge.shutDownPageContainer(0);
      this.isPageCreated = false;
    } catch (err) {
      console.warn('Error during shutdown:', err);
    }
  }

  public addListener(listener: G2EventListener): () => void {
    this.activeListeners.push(listener);
    return () => {
      this.activeListeners = this.activeListeners.filter((l) => l !== listener);
    };
  }

  private dispatchEvenHubEvent(event: EvenHubEvent) {
    const rawAny = event as any;
    const evType: OsEventTypeList | undefined =
      event.textEvent?.eventType ??
      event.sysEvent?.eventType ??
      event.listEvent?.eventType ??
      event.jsonData?.eventType ??
      event.jsonData?.Event_Type ??
      rawAny?.eventType ??
      rawAny?.Event_Type;

    const eventSource: EventSourceType | undefined =
      event.sysEvent?.eventSource ??
      event.jsonData?.eventSource ??
      rawAny?.eventSource;

    let sourceDesc = 'Even R1 Ring / Glasses';
    if (eventSource === EventSourceType.TOUCH_EVENT_FROM_RING) {
      sourceDesc = 'Even R1 Ring';
    } else if (eventSource === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R) {
      sourceDesc = 'Right Glasses Temple';
    } else if (eventSource === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L) {
      sourceDesc = 'Left Glasses Temple';
    }

    const rawAction = String(
      event.jsonData?.action || rawAny?.action || ''
    ).toLowerCase();

    for (const listener of this.activeListeners) {
      listener.onRawEvent?.(event, sourceDesc);

      const isScrollTop =
        evType === OsEventTypeList.SCROLL_TOP_EVENT ||
        rawAction === 'up' ||
        rawAction === 'swipe_up' ||
        rawAction === 'scroll_top';

      const isScrollBottom =
        evType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
        rawAction === 'down' ||
        rawAction === 'swipe_down' ||
        rawAction === 'scroll_bottom';

      const isClick =
        evType === OsEventTypeList.CLICK_EVENT ||
        rawAction === 'click';

      const isDoubleClick =
        evType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
        rawAction === 'double_click';

      const isLongPress =
        evType === OsEventTypeList.LONG_PRESS_EVENT ||
        rawAction === 'long_press';

      if (isScrollTop) {
        listener.onNextScreen?.();
      } else if (isScrollBottom) {
        listener.onPrevScreen?.();
      } else if (isClick) {
        listener.onSingleClick?.();
      } else if (isDoubleClick) {
        listener.onDoubleClick?.();
      } else if (isLongPress) {
        listener.onLongPress?.();
      }
    }
  }

  private setupBrowserKeyboardFallback() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        e.key === ' ' ||
        e.key === 'j' ||
        e.key === 'w'
      ) {
        e.preventDefault();
        for (const l of this.activeListeners) l.onNextScreen?.();
      } else if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp' ||
        e.key === 'k' ||
        e.key === 's'
      ) {
        e.preventDefault();
        for (const l of this.activeListeners) l.onPrevScreen?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        for (const l of this.activeListeners) l.onSingleClick?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        for (const l of this.activeListeners) l.onDoubleClick?.();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        for (const l of this.activeListeners) l.onLongPress?.();
      }
    });

    let lastWheelTime = 0;
    window.addEventListener(
      'wheel',
      (e) => {
        const now = Date.now();
        if (now - lastWheelTime < 250) return;
        if (Math.abs(e.deltaY) < 15) return;

        lastWheelTime = now;
        if (e.deltaY > 0) {
          for (const l of this.activeListeners) l.onNextScreen?.();
        } else {
          for (const l of this.activeListeners) l.onPrevScreen?.();
        }
      },
      { passive: true }
    );
  }
}

export const evenBridge = new EvenBridgeService();
