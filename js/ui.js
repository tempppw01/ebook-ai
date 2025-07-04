import { updateBook } from './database.js';

// --- UI Rendering ---

function renderBookList(library, onBookSelect) {
  const bookListDiv = document.getElementById('book-list');
  const noBooksMessage = document.getElementById('no-books-message');

  if (!bookListDiv) return; // Exit if the main list container is missing
  bookListDiv.innerHTML = '';

  if (noBooksMessage) {
    if (library.length === 0) {
      noBooksMessage.style.display = 'block';
    } else {
      noBooksMessage.style.display = 'none';
    }
  }
  
  if (library.length > 0) {
    library.forEach((book) => {
      const bookItem = document.createElement('div');
      bookItem.className = 'book-item';
      // Add left-click listener to open the book
      bookItem.onclick = () => {
        // Revoke old blob URLs to prevent memory leaks
        library.forEach(b => {
          if (b.cover && b.cover.startsWith('blob:')) {
            URL.revokeObjectURL(b.cover);
          }
        });
        onBookSelect(book);
      };

      // Add right-click listener for context menu
      bookItem.addEventListener('contextmenu', (e) => {
          e.preventDefault(); // Prevent the default browser context menu
          if (window.electronAPI) {
              window.electronAPI.showBookContextMenu(book.id); // Send book ID to main process
          }
      });

      const img = document.createElement('img');
      const placeholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTAwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNjY2MiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZmZmIj5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4=';
      img.src = book.cover || placeholder;

      const title = document.createElement('p');
      title.textContent = book.name;
      title.className = 'book-title';

      bookItem.appendChild(img);
      bookItem.appendChild(title);
      bookListDiv.appendChild(bookItem);

      // Fetch cover if it's missing (and not already attempted)
      if (book.type === 'epub' && !book.cover) {
        try {
            const epubBook = ePub(book.content);
            epubBook.coverUrl().then(async (url) => {
              if (url) {
                // Create a blob URL to avoid CORS issues with some servers
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                img.src = blobUrl;
                book.cover = blobUrl; // Note: Blob URLs are temporary
              }
            }).catch(err => console.warn("Could not get cover for", book.name, err));
        } catch (e) {
            console.warn("Could not parse epub for cover:", book.name, e);
        }
      }
    });
  }
}

function renderTOC(toc, rendition) {
  const tocListDiv = document.getElementById('toc-list');
  const tocContainer = document.getElementById('toc-container');
  tocListDiv.innerHTML = '';
  tocContainer.style.display = 'block';

  function buildTOCList(items) {
    let ul = document.createElement('ul');
    items.forEach(item => {
      let li = document.createElement('li');
      let link = document.createElement('a');
      link.textContent = item.label.trim();
      link.href = item.href;
      link.onclick = (e) => {
        e.preventDefault();
        if (rendition) rendition.display(item.href);
      };
      li.appendChild(link);
      if (item.subitems && item.subitems.length > 0) {
        li.appendChild(buildTOCList(item.subitems));
      }
      ul.appendChild(li);
    });
    return ul;
  }

  if (toc && toc.length > 0) {
    tocListDiv.appendChild(buildTOCList(toc));
  } else {
    tocListDiv.innerHTML = '<p>未找到目录。</p>';
  }
}

function renderBookmarks(bookData, rendition) {
  const bookmarksListDiv = document.getElementById('bookmarks-list');
  const bookmarksContainer = document.getElementById('bookmarks-container');
  bookmarksListDiv.innerHTML = '';
  const bookmarks = bookData.bookmarks || [];

  if (bookmarks.length === 0) {
    bookmarksContainer.style.display = 'none'; // Hide container if no bookmarks
    return;
  }

  bookmarksContainer.style.display = 'block'; // Show container if there are bookmarks

  bookmarks.forEach((bookmark, index) => {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    
    const text = document.createElement('span');
    text.className = 'bookmark-text';
    text.textContent = bookmark.label;
    text.onclick = () => {
      if (rendition) rendition.display(bookmark.cfi);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-bookmark-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      bookData.bookmarks.splice(index, 1);
      await updateBook(bookData);
      renderBookmarks(bookData, rendition); // Re-render
    };

    item.appendChild(text);
    item.appendChild(deleteBtn);
    bookmarksListDiv.appendChild(item);
  });
}

function hideTOC() {
    const tocContainer = document.getElementById('toc-container');
    if (tocContainer) tocContainer.style.display = 'none';
}

function hideBookmarks() {
    const bookmarksContainer = document.getElementById('bookmarks-container');
    if (bookmarksContainer) bookmarksContainer.style.display = 'none';
}

export { renderBookList, renderTOC, renderBookmarks, hideTOC, hideBookmarks };
