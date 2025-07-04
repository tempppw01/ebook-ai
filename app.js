import { initDB, saveBook, getBooks, updateBook, deleteBook } from './js/database.js';
import { renderBookList, renderTOC, renderBookmarks, hideTOC, hideBookmarks } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired. Starting app initialization.');

    // --- Global State ---
    let currentBook = null;
    let currentRendition = null;
    let currentBookData = null;

    // --- DOM Element References ---
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const bookViewDiv = document.getElementById('book-view');
    const initialMessage = document.getElementById('initial-message');
    const importBtn = document.getElementById('import-book-btn');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const themeSelect = document.getElementById('theme-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const openaiUrlInput = document.getElementById('openai-url');
    const openaiKeyInput = document.getElementById('openai-key');
    const openaiModelInput = document.getElementById('openai-model');
    const testOpenAIBtn = document.getElementById('test-openai-btn');
    const bottomNav = document.getElementById('bottom-nav');

    if (importBtn) {
        importBtn.disabled = true; // Disable import button until DB is ready
    }

    // --- Helper Functions ---
    function getSelectedText() {
        let text = "";
        if (window.getSelection) {
            text = window.getSelection().toString();
        } else if (document.selection && document.selection.type != "Control") {
            text = document.selection.createRange().text;
        }
        console.log('Selected text:', text);
        return text.trim();
    }

    function switchView(viewId) {
        console.log(`Attempting to switch view to: ${viewId}`);
        
        // Handle sidebar active state
        sidebarItems.forEach(item => {
            const targetPanelId = item.dataset.view === 'library-panel' ? 'library-reader-container' : item.dataset.view;
            item.classList.toggle('active', targetPanelId === viewId);
        });

        // Hide all main content panels first
        viewPanels.forEach(panel => {
            panel.classList.remove('active');
        });

        // Show the requested view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            console.log(`View switched to: ${viewId}`);
        } else {
            console.error(`View panel with ID "${viewId}" not found.`);
        }
    }

    function goHome() {
        console.log("Going to home view. Resetting state.");
        if (currentRendition) {
            console.log("Destroying current rendition.");
            currentRendition.destroy();
            currentRendition = null;
        }
        currentBook = null;
        currentBookData = null;

        bookViewDiv.innerHTML = '';
        if (initialMessage) initialMessage.style.display = 'flex';
        hideTOC();
        hideBookmarks();
        if (bottomNav) bottomNav.style.display = 'none';

        // Show library panel and hide reader view
        const libraryPanel = document.getElementById('library-panel');
        const readerView = document.getElementById('reader-view');
        if (libraryPanel) libraryPanel.classList.remove('hidden');
        if (readerView) readerView.classList.add('collapsed');

        // Ensure we are on the library/reader view
        switchView('library-reader-container');
        console.log("Home view rendered.");
    }

    // --- Main App Logic ---
    async function loadBook(bookData) {
        console.log("Attempting to load book:", bookData?.name, "with ID:", bookData?.id);
        if (!bookData) {
            console.error("loadBook called with null or undefined bookData.");
            return;
        }

        // Don't reset the entire view, just the book part
        if (currentRendition) {
            currentRendition.destroy();
        }

        currentBookData = bookData;
        bookViewDiv.innerHTML = '';
        if (initialMessage) initialMessage.style.display = 'none';

        // Hide library panel and show reader view
        const libraryPanel = document.getElementById('library-panel');
        const readerView = document.getElementById('reader-view');
        if (libraryPanel) libraryPanel.classList.add('hidden');
        if (readerView) readerView.classList.remove('collapsed');
        
        if (bottomNav) bottomNav.style.display = 'flex';
        console.log("Bottom navigation shown.");

        if (bookData.type === 'epub') {
            console.log("Loading EPUB book:", bookData.name);
            try {
                currentBook = ePub(bookData.content);
                await currentBook.ready;
                console.log("EPUB book ready.");
                currentRendition = currentBook.renderTo(bookViewDiv, { width: "100%", height: "100%" });
                console.log("EPUB rendered.");
                renderBookmarks(currentBookData, currentRendition);
                currentRendition.display(bookData.lastLocation || 0);
                applySettings();

                // --- Debugging TOC ---
                console.log("Checking EPUB navigation and TOC...");
                console.log("currentBook.navigation:", currentBook.navigation);
                console.log("currentBook.navigation.toc:", currentBook.navigation?.toc);
                console.log("currentRendition:", currentRendition);
                // --- End Debugging TOC ---

                if (currentBook.navigation && currentBook.navigation.toc) {
                    console.log("Rendering TOC...");
                    renderTOC(currentBook.navigation.toc, currentRendition);
                } else {
                    hideTOC();
                    console.log("No TOC found for EPUB.");
                }

                currentRendition.on('locationChanged', async (loc) => {
                    if (currentBookData && loc && loc.start && loc.start.cfi) {
                        currentBookData.lastLocation = loc.start.cfi;
                        try {
                            await updateBook(currentBookData);
                        } catch (dbError) {
                            console.error("Failed to update book last location in DB:", dbError);
                        }
                    }
                });
                if (addBookmarkBtn) addBookmarkBtn.style.display = 'inline-block';
                console.log("EPUB loaded successfully.");

            } catch (err) {
                console.error("Error loading EPUB:", err);
                bookViewDiv.innerHTML = `<div style="padding: 20px; color: red;">无法加载EPUB文件。请检查文件格式或控制台错误。错误详情: ${err.message}</div>`;
                hideTOC();
                hideBookmarks();
                if (bottomNav) bottomNav.style.display = 'none';
            }
        } else if (bookData.type === 'txt') {
            console.log("Loading TXT book:", bookData.name);
            currentRendition = null;
            hideTOC();
            hideBookmarks();
            if (addBookmarkBtn) addBookmarkBtn.style.display = 'none';

            currentBook = {
                ...bookData,
                currentPage: bookData.lastLocation || 0,
                pageSize: 2000,
                display: function() {
                    const start = this.currentPage * this.pageSize;
                    const end = start + this.pageSize;
                    const contentToShow = this.content.slice(start, end);
                    bookViewDiv.innerHTML = `<div id="txt-content" style="white-space: pre-wrap; padding: 20px; height: 100%; box-sizing: border-box;">${contentToShow}</div>`;
                    applySettings();
                },
                next: async function() {
                    if ((this.currentPage + 1) * this.pageSize < this.content.length) {
                        this.currentPage++;
                        this.display();
                        currentBookData.lastLocation = this.currentPage;
                        try {
                            await updateBook(currentBookData);
                        } catch (dbError) {
                            console.error("Failed to update TXT book last location in DB:", dbError);
                        }
                    }
                },
                prev: async function() {
                    if (this.currentPage > 0) {
                        this.currentPage--;
                        this.display();
                        currentBookData.lastLocation = this.currentPage;
                         try {
                            await updateBook(currentBookData);
                        } catch (dbError) {
                            console.error("Failed to update TXT book last location in DB:", dbError);
                        }
                    }
                }
            };
            currentBook.display();
            console.log("TXT book loaded successfully.");
        } else {
             console.error("Unsupported book type:", bookData.type);
             bookViewDiv.innerHTML = `<div style="padding: 20px; color: red;">不支持的文件格式: ${bookData.type}</div>`;
             hideTOC();
             hideBookmarks();
             if (bottomNav) bottomNav.style.display = 'none';
        }
    }

    async function updateLibraryUI() {
        console.log("Updating library UI...");
        try {
            const library = await getBooks();
            renderBookList(library, loadBook);
            console.log("Library UI updated.");
        } catch (error) {
            console.error("Failed to update library UI:", error);
            const bookListDiv = document.getElementById('book-list');
            if(bookListDiv) bookListDiv.innerHTML = `<p style="color: red;">无法加载书库: ${error.message}</p>`;
        }
    }

    function applySettings() {
        console.log("Applying settings...");
        const theme = themeSelect.value;
        const fontSize = fontSizeInput.value + 'px';

        document.body.classList.toggle('dark-mode', theme === 'dark');

        if (currentRendition) {
            currentRendition.themes.fontSize(fontSize);
        } else {
            const txtContentDiv = document.getElementById('txt-content');
            if (txtContentDiv) {
                txtContentDiv.style.fontSize = fontSize;
            }
        }
        saveSettings();
    }

    function saveSettings() {
        const settings = {
            theme: themeSelect.value,
            fontSize: fontSizeInput.value,
            openai: {
                url: openaiUrlInput.value,
                key: openaiKeyInput.value,
                model: openaiModelInput.value
            }
        };
        try {
            localStorage.setItem('ebookReaderSettings', JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage:", error);
        }
    }

    function loadSettings() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('ebookReaderSettings'));
            if (savedSettings) {
                themeSelect.value = savedSettings.theme || 'light';
                fontSizeInput.value = savedSettings.fontSize || 16;
                if (savedSettings.openai) {
                    openaiUrlInput.value = savedSettings.openai.url || '';
                    openaiKeyInput.value = savedSettings.openai.key || '';
                    openaiModelInput.value = savedSettings.openai.model || 'gpt-3.5-turbo';
                }
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage:", error);
        }
        applySettings();
    }

    // --- Event Listeners Setup ---
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPanelId = item.dataset.view === 'library-panel' ? 'library-reader-container' : item.dataset.view;
            switchView(targetPanelId);
        });
    });

    if (bookViewDiv) {
        bookViewDiv.addEventListener('contextmenu', (e) => {
            const selectedText = getSelectedText();
            if (selectedText && window.electronAPI) {
                e.preventDefault();
                window.electronAPI.showContextMenu(selectedText);
            }
        });

        bookViewDiv.addEventListener('click', (e) => {
            if (!currentBook) return;
            const rect = bookViewDiv.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width / 3) {
                if (currentRendition) currentRendition.prev();
                else if (currentBook.prev) currentBook.prev();
            } else if (clickX > rect.width * 2 / 3) {
                if (currentRendition) currentRendition.next();
                else if (currentBook.next) currentBook.next();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!currentBook) return;
        if (e.key === 'ArrowLeft') {
            if (currentRendition) currentRendition.prev();
            else if (currentBook.prev) currentBook.prev();
        } else if (e.key === 'ArrowRight') {
            if (currentRendition) currentRendition.next();
            else if (currentBook.next) currentBook.next();
        }
    });

    if (window.electronAPI) {
        window.electronAPI.onSummarizeWithAI(async (selectedText) => {
            const apiUrl = openaiUrlInput.value || 'https://api.openai.com/v1';
            const apiKey = openaiKeyInput.value;
            const apiModel = openaiModelInput.value || 'gpt-3.5-turbo';

            if (!apiKey) {
                alert('请在设置中配置 OpenAI API 密钥。');
                return;
            }
            if (!selectedText) return;

            const systemPrompt = `你是一个博学的阅读助手。请根据用户提供的以下文本片段，给出一个简洁、有帮助的总结。`;
            const userPrompt = `请总结以下内容：\n\n"${selectedText}"`;
            alert('正在请求 AI 总结，请稍候...');
            try {
                const response = await fetch(`${apiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: apiModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`API 请求失败: ${errorData.error?.message || response.statusText || '未知错误'}`);
                }

                const data = await response.json();
                const answer = data.choices[0]?.message?.content;

                if (answer) {
                    alert(`AI 总结:\n\n${answer}`);
                } else {
                    alert('未能从 API 获取有效回答。');
                }
            } catch (error) {
                console.error("Error during AI summarization:", error);
                alert(`发生错误: ${error.message}`);
            }
        });

        window.electronAPI.onDeleteBook(async (bookId) => {
            const confirmDelete = confirm('确定要删除这本书吗？');
            if (!confirmDelete) return;
            try {
                if (currentBookData && currentBookData.id === bookId) {
                    goHome();
                }
                await deleteBook(bookId);
                await updateLibraryUI();
            } catch (error) {
                console.error(`Error deleting book with ID ${bookId}:`, error);
                alert(`删除书籍时发生错误: ${error.message}`);
            }
        });
    }

    if (importBtn) {
        importBtn.onclick = () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt,.epub';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const bookData = { name: file.name, type: file.name.endsWith('.epub') ? 'epub' : 'txt', content: event.target.result, bookmarks: [], lastLocation: null };
                            await saveBook(bookData);
                            await updateLibraryUI();
                        } catch (error) {
                            console.error("Error during book import or save:", error);
                            alert(`导入书籍时发生错误: ${error.message}`);
                        }
                    };
                    if (file.name.endsWith('.epub')) {
                        reader.readAsArrayBuffer(file);
                    } else {
                        reader.readAsText(file, 'UTF-8');
                    }
                }
            };
            fileInput.click();
        };
    }

    if (prevPageBtn) prevPageBtn.onclick = () => {
        if (currentRendition) currentRendition.prev();
        else if (currentBook?.prev) currentBook.prev();
    };

    if (nextPageBtn) nextPageBtn.onclick = () => {
        if (currentRendition) currentRendition.next();
        else if (currentBook?.next) currentBook.next();
    };

    if (addBookmarkBtn) addBookmarkBtn.onclick = async () => {
        if (!currentRendition || !currentBookData || currentBookData.type !== 'epub') {
            alert("书签功能仅支持EPUB格式。");
            return;
        }
        try {
            const loc = await currentRendition.location.getCurrent();
            if (!loc || !loc.start || !loc.start.cfi) {
                 alert("无法获取当前阅读位置，无法添加书签。");
                 return;
            }
            const cfi = loc.start.cfi;
            const chapter = currentBook.navigation.get(cfi);
            const label = chapter ? chapter.label.trim() : `位置 ${loc.start.displayed.page}`;
            if (!currentBookData.bookmarks) currentBookData.bookmarks = [];
            currentBookData.bookmarks.push({ label, cfi });
            await updateBook(currentBookData);
            renderBookmarks(currentBookData, currentRendition);
        } catch (error) {
            console.error("Error adding bookmark:", error);
            alert(`添加书签时发生错误: ${error.message}`);
        }
    };

    if (themeSelect) themeSelect.onchange = applySettings;
    if (fontSizeInput) fontSizeInput.oninput = applySettings;
    if (openaiUrlInput) openaiUrlInput.oninput = saveSettings;
    if (openaiKeyInput) openaiKeyInput.oninput = saveSettings;
    if (openaiModelInput) openaiModelInput.oninput = saveSettings;

    if (testOpenAIBtn) {
        testOpenAIBtn.onclick = async () => {
            const apiUrl = openaiUrlInput.value || 'https://api.openai.com/v1';
            const apiKey = openaiKeyInput.value;
            if (!apiKey) {
                alert('请输入 API 密钥后再测试。');
                return;
            }
            testOpenAIBtn.disabled = true;
            testOpenAIBtn.textContent = '测试中...';
            try {
                const response = await fetch(`${apiUrl}/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data.data)) {
                         alert('连接成功！API 密钥有效。');
                    } else {
                         alert('连接失败：API 返回了意外的响应。请检查 API 地址和密钥。');
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    if (errorData && errorData.error && errorData.error.message) {
                         throw new Error(`API 请求失败: ${errorData.error.message}`);
                    } else {
                         throw new Error(`API 请求失败: ${response.statusText || '未知错误'}`);
                    }
                }
            } catch (error) {
                console.error("Error during OpenAI connection test:", error);
                alert(`测试失败: ${error.message}`);
            } finally {
                testOpenAIBtn.disabled = false;
                testOpenAIBtn.textContent = '测试连接';
            }
        };
    }

    // --- App Initialization ---
    try {
        await initDB();
        loadSettings();
        await updateLibraryUI();
        if (importBtn) {
            importBtn.disabled = false;
        }
        // The default view is already set in index.html with the 'active' class
        console.log('App initialization complete.');
    } catch (error) {
        console.error("Application initialization failed:", error);
        if(initialMessage) initialMessage.innerHTML = `<h2>应用初始化失败</h2><p>请检查开发者控制台获取更多信息。</p><p>错误详情: ${error.message}</p>`;
        if (importBtn) {
            importBtn.disabled = true;
        }
    }
});
