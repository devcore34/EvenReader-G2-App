import { openDB, type IDBPDatabase } from 'idb';
import type { EVRReadingPosition } from '@even-reader/evr-format';

export interface StoredBook {
  id: string;
  title: string;
  author: string;
  screenCount: number;
  sectionCount: number;
  language: string;
  createdAt: string;
  addedAt: number;
  evrBuffer: ArrayBuffer;
}

const DB_NAME = 'even_reader_pro_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'bookId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

export async function saveBookToDb(book: StoredBook): Promise<void> {
  const db = await getDb();
  await db.put('books', book);
}

export async function getBookFromDb(id: string): Promise<StoredBook | undefined> {
  const db = await getDb();
  return await db.get('books', id);
}

export async function getAllBooksFromDb(): Promise<StoredBook[]> {
  const db = await getDb();
  return await db.getAll('books');
}

export async function deleteBookFromDb(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('books', id);
  await db.delete('positions', id);
}

export async function saveReadingPosition(position: EVRReadingPosition): Promise<void> {
  const db = await getDb();
  await db.put('positions', position);
}

export async function getReadingPosition(bookId: string): Promise<EVRReadingPosition | undefined> {
  const db = await getDb();
  return await db.get('positions', bookId);
}

export async function getAllReadingPositions(): Promise<Record<string, EVRReadingPosition>> {
  const db = await getDb();
  const list: EVRReadingPosition[] = await db.getAll('positions');
  const map: Record<string, EVRReadingPosition> = {};
  for (const pos of list) {
    map[pos.bookId] = pos;
  }
  return map;
}
