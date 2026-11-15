import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  type StoredBook,
  saveBookToDb,
  getAllBooksFromDb,
  deleteBookFromDb,
  saveReadingPosition,
  getAllReadingPositions
} from './services/db.js';
import { EVRDocument, type EVRReadingPosition } from '@even-reader/evr-format';
import { evenBridge } from './services/even-bridge.js';
import { LibraryView } from './components/LibraryView.js';
import { ActiveReaderView } from './components/ActiveReaderView.js';

export const App: React.FC = () => {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [positions, setPositions] = useState<Record<string, EVRReadingPosition>>({});
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null);
  const [activeEvrDoc, setActiveEvrDoc] = useState<EVRDocument | null>(null);
  const [currentScreenIdx, setCurrentScreenIdx] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastEventLog, setLastEventLog] = useState<string>(
    'Ожидание событий кольца Even R1 или очков G2 (свайп вверх/вниз)'
  );

  const activeBookRef = useRef<StoredBook | null>(null);
  activeBookRef.current = activeBook;
  const activeEvrDocRef = useRef<EVRDocument | null>(null);
  activeEvrDocRef.current = activeEvrDoc;
  const currentScreenIdxRef = useRef<number>(currentScreenIdx);
  currentScreenIdxRef.current = currentScreenIdx;

  const reloadLibrary = useCallback(async () => {
    try {
      const storedBooks = await getAllBooksFromDb();
      const storedPositions = await getAllReadingPositions();
      setBooks(storedBooks);
      setPositions(storedPositions);

      if (storedBooks.length === 0) {
        await loadDemoBook();
      }
    } catch (err) {
      console.error('Failed to load books from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    evenBridge.init().catch(console.error);
    reloadLibrary();
  }, [reloadLibrary]);

  const loadDemoBook = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/demo-book.evr');
      if (!res.ok) throw new Error('Demo book file not found on server');
      const buffer = await res.arrayBuffer();
      await importEvrBuffer(buffer);
    } catch (err) {
      console.warn('Could not auto-load demo book from public:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const importEvrBuffer = async (buffer: ArrayBuffer) => {
    setIsProcessing(true);
    try {
      const doc = await EVRDocument.load(buffer);
      const manifest = doc.manifest;

      const newBook: StoredBook = {
        id: manifest.id,
        title: manifest.title,
        author: manifest.author,
        screenCount: manifest.screenCount,
        sectionCount: manifest.sectionCount,
        language: manifest.language || 'ru',
        createdAt: manifest.createdAt,
        addedAt: Date.now(),
        evrBuffer: buffer
      };

      await saveBookToDb(newBook);
      await reloadLibrary();
    } catch (err: any) {
      alert('Ошибка при импорте книги: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const goToScreen = useCallback(async (newIdx: number) => {
    const doc = activeEvrDocRef.current;
    const book = activeBookRef.current;
    if (!doc || !book) return;

    const clampedIdx = Math.max(0, Math.min(doc.manifest.screenCount - 1, newIdx));
    setCurrentScreenIdx(clampedIdx);

    const position: EVRReadingPosition = {
      bookId: book.id,
      screenIndex: clampedIdx,
      totalScreens: doc.manifest.screenCount,
      progressPercent: Math.round(((clampedIdx + 1) / doc.manifest.screenCount) * 100),
      updatedAt: Date.now()
    };
    await saveReadingPosition(position);
    setPositions((prev) => ({ ...prev, [book.id]: position }));

    try {
      const page = await doc.getPage(clampedIdx);
      await evenBridge.updateScreenTiles([
        page.tiles[0].pngBytes,
        page.tiles[1].pngBytes,
        page.tiles[2].pngBytes,
        page.tiles[3].pngBytes
      ]);
    } catch (err) {
      console.error('Failed to stream screen to G2:', err);
    }
  }, []);

  const handleOpenBook = async (book: StoredBook) => {
    setIsProcessing(true);
    try {
      const doc = await EVRDocument.load(book.evrBuffer);
      setActiveBook(book);
      setActiveEvrDoc(doc);

      const savedPos = positions[book.id];
      const startIdx = savedPos ? savedPos.screenIndex : 0;
      setCurrentScreenIdx(startIdx);

      await evenBridge.setupReaderPage();

      const page = await doc.getPage(startIdx);
      await evenBridge.updateScreenTiles([
        page.tiles[0].pngBytes,
        page.tiles[1].pngBytes,
        page.tiles[2].pngBytes,
        page.tiles[3].pngBytes
      ]);
    } catch (err: any) {
      alert('Не удалось открыть книгу: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseBook = async () => {
    await evenBridge.closeReader();
    setActiveBook(null);
    setActiveEvrDoc(null);
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm('Удалить эту книгу из библиотеки?')) {
      await deleteBookFromDb(id);
      await reloadLibrary();
    }
  };

  const handleResetPosition = async (id: string) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;

    const resetPos: EVRReadingPosition = {
      bookId: id,
      screenIndex: 0,
      totalScreens: book.screenCount,
      progressPercent: 0,
      updatedAt: Date.now()
    };
    await saveReadingPosition(resetPos);
    setPositions((prev) => ({ ...prev, [id]: resetPos }));

    if (activeBook?.id === id) {
      goToScreen(0);
    }
  };

  useEffect(() => {
    const unsubscribe = evenBridge.addListener({
      onNextScreen: () => {
        setLastEventLog('Even R1: Свайп вверх -> Следующий экран');
        if (activeEvrDocRef.current) {
          goToScreen(currentScreenIdxRef.current + 1);
        }
      },
      onPrevScreen: () => {
        setLastEventLog('Even R1: Свайп вниз -> Предыдущий экран');
        if (activeEvrDocRef.current) {
          goToScreen(currentScreenIdxRef.current - 1);
        }
      },
      onSingleClick: () => {
        setLastEventLog('Even R1: Одиночный клик (Пауза / Инфо)');
      },
      onDoubleClick: () => {
        setLastEventLog('Even R1: Двойной клик -> Возврат в библиотеку');
        handleCloseBook();
      },
      onLongPress: () => {
        setLastEventLog('Even R1: Длительное нажатие -> Меню чтения');
      },
      onRawEvent: (event, source) => {
        console.log(`Raw event from ${source}:`, event);
      }
    });

    return () => unsubscribe();
  }, [goToScreen]);

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {activeBook && activeEvrDoc ? (
        <ActiveReaderView
          book={activeBook}
          evrDoc={activeEvrDoc}
          currentScreenIdx={currentScreenIdx}
          onScreenChange={goToScreen}
          onClose={handleCloseBook}
          onResetPosition={() => handleResetPosition(activeBook.id)}
          lastEventLog={lastEventLog}
        />
      ) : (
        <LibraryView
          books={books}
          positions={positions}
          onOpenBook={handleOpenBook}
          onDeleteBook={handleDeleteBook}
          onResetPosition={handleResetPosition}
          onImportEvr={importEvrBuffer}
          onLoadDemoBook={loadDemoBook}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};
