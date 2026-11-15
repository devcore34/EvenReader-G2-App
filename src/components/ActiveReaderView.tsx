import React, { useState, useEffect } from 'react';
import type { StoredBook } from '../services/db.js';
import type { EVRDocument, ScreenPage, NavigationNode } from '@even-reader/evr-format';
import { pngBytesToDataUrl } from '../services/image-decoder.js';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  List,
  Radio,
  X
} from 'lucide-react';

interface ActiveReaderViewProps {
  book: StoredBook;
  evrDoc: EVRDocument;
  currentScreenIdx: number;
  onScreenChange: (newIdx: number) => void;
  onClose: () => void;
  onResetPosition: () => void;
  lastEventLog: string;
}

export const ActiveReaderView: React.FC<ActiveReaderViewProps> = ({
  book,
  evrDoc,
  currentScreenIdx,
  onScreenChange,
  onClose,
  onResetPosition,
  lastEventLog
}) => {
  const [, setCurrentPage] = useState<ScreenPage | null>(null);
  const [tileUrls, setTileUrls] = useState<[string, string, string, string] | null>(null);
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [toc, setToc] = useState<NavigationNode[]>([]);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchEndY - touchStartY;
    if (diff < -35) {
      onScreenChange(Math.min(totalScreens - 1, currentScreenIdx + 1));
    } else if (diff > 35) {
      onScreenChange(Math.max(0, currentScreenIdx - 1));
    }
    setTouchStartY(null);
  };

  useEffect(() => {
    evrDoc.getNavigation().then((nav) => setToc(nav.toc)).catch(console.error);
  }, [evrDoc]);

  useEffect(() => {
    let active = true;

    evrDoc.getPage(currentScreenIdx).then((page) => {
      if (!active) return;
      setCurrentPage(page);

      const urls: [string, string, string, string] = [
        pngBytesToDataUrl(page.tiles[0].pngBytes),
        pngBytesToDataUrl(page.tiles[1].pngBytes),
        pngBytesToDataUrl(page.tiles[2].pngBytes),
        pngBytesToDataUrl(page.tiles[3].pngBytes)
      ];
      setTileUrls(urls);
    }).catch(console.error);

    return () => {
      active = false;
      if (tileUrls) {
        tileUrls.forEach((u) => URL.revokeObjectURL(u));
      }
    };
  }, [currentScreenIdx, evrDoc]);

  const totalScreens = evrDoc.manifest.screenCount;
  const progressPercent = Math.min(
    100,
    Math.round(((currentScreenIdx + 1) / totalScreens) * 100)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-black text-white overflow-hidden">
      <header className="h-16 px-5 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Библиотека</span>
          </button>

          <div className="h-5 w-px bg-zinc-800 mx-1" />

          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {book.title}
            </h2>
            <div className="text-[11px] text-zinc-500 font-mono">
              {book.author} • Экран {currentScreenIdx + 1} из {totalScreens} ({progressPercent}%)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
              isTocOpen
                ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Оглавление
          </button>

          <button
            onClick={onResetPosition}
            title="Сбросить к первому экрану"
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="relative p-5 rounded-3xl bg-zinc-950 border border-zinc-850 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 text-[11px] font-mono text-zinc-500">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                EVEN REALITIES G2 • ACTIVE STREAM
              </span>
              <span>576 × 288 (2×2 GRID)</span>
            </div>

            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="relative overflow-hidden rounded-md bg-black border border-zinc-900 shadow-inner select-none cursor-pointer"
              style={{
                width: 576,
                height: 288
              }}
            >
              {tileUrls ? (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                  <img
                    src={tileUrls[0]}
                    alt="TL Container 1"
                    className="w-[288px] h-[144px] object-cover pointer-events-none select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <img
                    src={tileUrls[1]}
                    alt="TR Container 2"
                    className="w-[288px] h-[144px] object-cover pointer-events-none select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <img
                    src={tileUrls[2]}
                    alt="BL Container 3"
                    className="w-[288px] h-[144px] object-cover pointer-events-none select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <img
                    src={tileUrls[3]}
                    alt="BR Container 4"
                    className="w-[288px] h-[144px] object-cover pointer-events-none select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-xs text-zinc-600">
                  Загрузка тайлов экрана...
                </div>
              )}

              {showGrid && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px border-r border-dashed border-emerald-500/40" />
                  <div className="absolute left-0 right-0 top-1/2 h-px border-b border-dashed border-emerald-500/40" />
                </div>
              )}
            </div>

            <div className="w-full mt-3 flex items-center justify-between text-xs text-zinc-500 font-mono">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="hover:text-emerald-400 transition"
              >
                {showGrid ? '[Скрыть сетку]' : '[Показать сетку 2×2]'}
              </button>
              <span>Черный фон: пиксели выключены (прозрачно)</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={() => onScreenChange(Math.max(0, currentScreenIdx - 1))}
              disabled={currentScreenIdx <= 0}
              className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Предыдущий экран"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1.5 w-64">
              <input
                type="range"
                min={0}
                max={totalScreens - 1}
                value={currentScreenIdx}
                onChange={(e) => onScreenChange(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="text-[11px] font-mono text-zinc-400">
                Экран {currentScreenIdx + 1} из {totalScreens}
              </div>
            </div>

            <button
              onClick={() => onScreenChange(Math.min(totalScreens - 1, currentScreenIdx + 1))}
              disabled={currentScreenIdx >= totalScreens - 1}
              className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Следующий экран"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center gap-2.5 text-xs font-mono text-zinc-400">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Управление: {lastEventLog}</span>
          </div>
        </div>

        {isTocOpen && (
          <aside className="w-72 bg-zinc-950 border-l border-zinc-900 p-4 flex flex-col shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Главы и разделы
              </h3>
              <button
                onClick={() => setIsTocOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {toc.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4">Оглавление не задано</div>
              ) : (
                toc.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    onClick={() => {
                      onScreenChange(item.screenIndex || 0);
                      setIsTocOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition ${
                      currentScreenIdx === item.screenIndex
                        ? 'bg-emerald-950 text-emerald-400 font-bold border border-emerald-800'
                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                    }`}
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
