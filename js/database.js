// --- Database Configuration ---
const DB_NAME = 'EbookReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let db;

// --- Database Initialization ---
function initDB() {
  console.log('Initializing database...');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(`Database error: ${event.target.error}`);
    };

    request.onupgradeneeded = (event) => {
      console.log('Database upgrade needed.');
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        console.log(`Creating object store: ${STORE_NAME}`);
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('Database initialized successfully.');
      resolve(db);
    };
  });
}

// --- CRUD Operations ---

function saveBook(bookData) {
  console.log('Attempting to save book:', bookData.name);
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('DB not initialized. Cannot save book.');
      return reject('Database not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(bookData);

    request.onsuccess = (event) => {
      console.log('Book saved successfully with ID:', event.target.result);
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Error saving book:', event.target.error);
      reject(`Error saving book: ${event.target.error}`);
    };
  });
}

function getBooks() {
  console.log('Attempting to get all books from DB.');
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('DB not initialized. Cannot get books.');
      return reject('Database not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      console.log('Successfully fetched all books.');
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Error getting books:', event.target.error);
      reject(`Error getting books: ${event.target.error}`);
    };
  });
}

function updateBook(bookData) {
  console.log('Attempting to update book with ID:', bookData.id);
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('DB not initialized. Cannot update book.');
      return reject('Database not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(bookData);

    request.onsuccess = () => {
      console.log('Book updated successfully.');
      resolve();
    };

    request.onerror = (event) => {
      console.error('Error updating book:', event.target.error);
      reject(`Error updating book: ${event.target.error}`);
    };
  });
}

function deleteBook(bookId) {
  console.log('Attempting to delete book with ID:', bookId);
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('DB not initialized. Cannot delete book.');
      return reject('Database not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(bookId);

    request.onsuccess = () => {
      console.log('Book deleted successfully.');
      resolve();
    };

    request.onerror = (event) => {
      console.error('Error deleting book:', event.target.error);
      reject(`Error deleting book: ${event.target.error}`);
    };
  });
}

export { initDB, saveBook, getBooks, updateBook, deleteBook };
