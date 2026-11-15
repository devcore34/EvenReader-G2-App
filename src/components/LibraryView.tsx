import React, { useRef } from 'react';
import type { StoredBook } from '../services/db.js';
import type { EVRReadingPosition } from '@even-reader/evr-format';
import {
  BookOpen,
  Glasses,
  Upload,
  Sparkles,
  Trash2,
  RotateCcw,
  Layers,
  WifiOff
} from 'lucide-react';

interface LibraryViewProps {
  books: StoredBook[];
  positions: Record<string, EVRReadingPosition>;
  onOpenBook: (book: StoredBook) => void;
  onDeleteBook: (id: string) => void;
  onResetPosition: (id: string) => void;
  onImportEvr: (buffer: ArrayBuffer) => Promise<void>;
  onLoadDemoBook: () => Promise<void>;
  isProcessing: boolean;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  positions,
  onOpenBook,
  onDeleteBook,
  onResetPosition,
  onImportEvr,
  onLoadDemoBook,
  isProcessing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      await onImportEvr(buffer);
    } catch (err: any) {
      alert('Ошибка при импорте EVR: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5 max-w-4xl mx-auto w-full overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".evr"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">БИБЛИОТЕКА EVR</h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              100% Автономно
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Книги хранятся локально в IndexedDB и транслируются на дисплей Even Realities G2
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white flex items-center gap-2 transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            Загрузить .EVR
          </button>

          <button
            onClick={onLoadDemoBook}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-950/70 border border-emerald-800/80 hover:bg-emerald-900/60 text-emerald-300 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Демо-книга (Матфизика)
          </button>
        </div>
      </div>

      <div className="py-6">
        {books.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50">
            <BookOpen className="w-12 h-12 text-zinc-700 mb-3" />
            <h3 className="text-sm font-bold text-zinc-300">Ваша библиотека пуста</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-5">
              Загрузите готовый файл книги в формате .evr или откройте демонстрационный курс по
              математической физике.
            </p>
            <button
              onClick={onLoadDemoBook}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" />
              Загрузить тестовую книгу
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map((book) => {
              const pos = positions[book.id];
              const currentScreen = pos ? pos.screenIndex + 1 : 1;
              const totalScreens = book.screenCount || 1;
              const percent = Math.min(
                100,
                Math.round((currentScreen / totalScreens) * 100)
              );

              return (
                <div
                  key={book.id}
                  className="group bg-zinc-950 border border-zinc-800/80 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between transition shadow-lg shadow-black/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded bg-zinc-900">
                        {book.language.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                      {book.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">{book.author}</p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono mt-3">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-600" />
                        {book.screenCount} экранов
                      </span>
                      <span>•</span>
                      <span>{book.sectionCount} глав</span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                        <span className="text-zinc-400">
                          Экран {currentScreen} из {totalScreens}
                        </span>
                        <span className="text-emerald-400 font-bold">{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {pos && pos.screenIndex > 0 && (
                        <button
                          onClick={() => onResetPosition(book.id)}
                          title="Сбросить к началу"
                          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteBook(book.id)}
                        title="Удалить книгу"
                        className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => onOpenBook(book)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition"
                    >
                      <Glasses className="w-4 h-4" />
                      {pos && pos.screenIndex > 0 ? 'Продолжить' : 'Читать на G2'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
