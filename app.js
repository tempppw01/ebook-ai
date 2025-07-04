import { initDB, saveBook, getBooks, updateBook } from './js/database.js';
import { renderBookList, renderTOC, renderBookmarks, hideTOC, hideBookmarks } from './js/ui.js';

// This event fires when the initial HTML document has been completely loaded and parsed,
// without waiting for stylesheets, images, and subframes to finish loading.
// This is the safest place to start executing our application logic.
document.addEventListener('DOMContentLoaded', async () => {

    // --- Global State ---
    let currentBook = null;
    let currentRendition = null;
    let currentBookData = null;

    // --- DOM Element References ---
    // Get all element references once the DOM is ready.
    const bookViewDiv = document.getElementById('book-view');
    const initialMessage = document.getElementById('initial-message');
    const importBtn = document.getElementById('import-book-btn');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const askBtn = document.getElementById('askBtn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const themeSelect = document.getElementById('theme-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const openaiUrlInput = document.getElementById('openai-url');
    const openaiKeyInput = document.getElementById('openai-key');
    const openaiModelInput = document.getElementById('openai-model');

    // --- Main App Logic ---
    async function loadBook(bookData) {
        currentBookData = bookData;
        bookViewDiv.innerHTML = '';
        if(initialMessage) initialMessage.style.display = 'none';

        if (bookData.type === 'epub') {
            currentBook = ePub(bookData.content);
            try {
                await currentBook.ready;
                currentRendition = currentBook.renderTo(bookViewDiv, { width: "100%", height: "100%" });
                // Must render bookmarks *after* rendition is created
                renderBookmarks(currentBookData, currentRendition);
                currentRendition.display(bookData.lastLocation);
                applySettings();

                if (currentBook.navigation && currentBook.navigation.toc) {
                    renderTOC(currentBook.navigation.toc, currentRendition);
                } else {
                    hideTOC();
                }

                currentRendition.on('locationChanged', async (loc) => {
                    if (currentBookData) {
                        currentBookData.lastLocation = loc.start.cfi;
                        await updateBook(currentBookData);
                    }
                });
            } catch (err) {
                console.error("Error loading EPUB:", err);
                bookViewDiv.innerHTML = `<div style="padding: 20px; color: red;">无法加载EPUB文件。请检查文件格式或控制台错误。</div>`;
                hideTOC();
                hideBookmarks();
            }
        } else { // txt
            currentRendition = null;
            hideTOC();
            hideBookmarks(); // Also hide bookmarks for TXT files
            currentBook = {
                ...bookData,
                currentPage: bookData.lastLocation || 0,
                pageSize: 2000,
                display: function() {
                    const start = this.currentPage * this.pageSize;
                    const end = start + this.pageSize;
                    bookViewDiv.innerHTML = `<div id="txt-content" style="white-space: pre-wrap; padding: 20px; height: 100%; box-sizing: border-box;">${this.content.slice(start, end)}</div>`;
                    applySettings();
                },
                next: async function() {
                    if ((this.currentPage + 1) * this.pageSize < this.content.length) {
                        this.currentPage++;
                        this.display();
                        currentBookData.lastLocation = this.currentPage;
                        await updateBook(currentBookData);
                    }
                },
                prev: async function() {
                    if (this.currentPage > 0) {
                        this.currentPage--;
                        this.display();
                        currentBookData.lastLocation = this.currentPage;
                        await updateBook(currentBookData);
                    }
                }
            };
            currentBook.display();
        }
    }

    async function updateLibraryUI() {
        const library = await getBooks();
        renderBookList(library, loadBook);
    }

    function applySettings() {
        document.body.classList.toggle('dark-mode', themeSelect.value === 'dark');
        const fontSize = fontSizeInput.value + 'px';
        if (currentRendition) {
            currentRendition.themes.fontSize(fontSize);
        } else {
            const txtContentDiv = document.getElementById('txt-content');
            if (txtContentDiv) txtContentDiv.style.fontSize = fontSize;
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
        localStorage.setItem('ebookReaderSettings', JSON.stringify(settings));
    }

    function loadSettings() {
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
        applySettings();
    }

    // --- Event Listeners Setup ---
    // This is now done synchronously as soon as the DOM is ready.
    importBtn.onclick = () => {
        console.log("Import button clicked. Creating file input.");
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,.epub';
        fileInput.style.display = 'none'; // Keep it hidden

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            // IMPORTANT: Clean up the input element from the DOM right after it's used.
            document.body.removeChild(fileInput);
            
            if (!file) {
                console.log("File selection cancelled.");
                return;
            }

            console.log(`File selected: ${file.name}`);
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    console.log("FileReader has loaded the file.");
                    const bookData = {
                        name: file.name,
                        type: file.name.endsWith('.epub') ? 'epub' : 'txt',
                        content: event.target.result,
                        bookmarks: [],
                        lastLocation: null
                    };
                    console.log("Book data prepared. Saving to database...");
                    await saveBook(bookData);
                    console.log("Book saved. Updating library UI...");
                    await updateLibraryUI();
                    console.log(`Book "${bookData.name}" import process complete.`);
                } catch (error) {
                    console.error("Error during book import process:", error);
                    alert(`导入书籍时发生错误: ${error.message}`);
                }
            };
            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                alert(`读取文件时发生错误。`);
            };

            if (file.name.endsWith('.epub')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file, 'UTF-8');
            }
        };
        
        // Append to body to ensure click works across browsers, then trigger click.
        document.body.appendChild(fileInput);
        fileInput.click();
    };

    prevPageBtn.onclick = () => {
        if (currentRendition) currentRendition.prev();
        else if (currentBook?.type === 'txt') currentBook.prev();
    };

    nextPageBtn.onclick = () => {
        if (currentRendition) currentRendition.next();
        else if (currentBook?.type === 'txt') currentBook.next();
    };

    addBookmarkBtn.onclick = async () => {
        if (!currentRendition || !currentBookData || currentBookData.type !== 'epub') {
            alert("书签功能仅支持EPUB格式。");
            return;
        }
        const loc = await currentRendition.location.getCurrent();
        const cfi = loc.start.cfi;
        const chapter = currentBook.navigation.get(cfi);
        const label = chapter ? chapter.label.trim() : `位置 ${loc.start.displayed.page}`;
        if (!currentBookData.bookmarks) currentBookData.bookmarks = [];
        currentBookData.bookmarks.push({ label, cfi });
        await updateBook(currentBookData);
        renderBookmarks(currentBookData, currentRendition);
    };

    askBtn.onclick = async () => {
        const questionInput = document.getElementById('question');
        const question = questionInput.value;
        if (!question) {
            alert('请输入问题。');
            return;
        }
        const apiUrl = openaiUrlInput.value || 'https://api.openai.com/v1';
        const apiKey = openaiKeyInput.value;
        const apiModel = openaiModelInput.value || 'gpt-3.5-turbo';

        if (!apiKey) {
            alert('请在设置中配置 OpenAI API 密钥。');
            return;
        }

        let context = "我正在阅读";
        if (currentBookData) {
            context += `书籍《${currentBookData.name}》。`;
            // 尝试获取当前章节或文本片段作为上下文
            try {
                if (currentRendition && currentRendition.location) {
                    const loc = await currentRendition.location.getCurrent();
                    const cfi = loc.start.cfi;
                    const chapter = currentBook.navigation.get(cfi);
                    if (chapter && chapter.href) {
                        const fullChapter = await currentBook.get(chapter.href);
                        const chapterText = await fullChapter.text();
                        context += `当前章节是 "${chapter.label.trim()}"。以下是章节的部分内容：\n\n${chapterText.substring(0, 2000)}...`;
                    }
                } else if (currentBook?.type === 'txt') {
                    const start = currentBook.currentPage * currentBook.pageSize;
                    const end = start + currentBook.pageSize;
                    context += `以下是当前页面的内容：\n\n${currentBook.content.slice(start, end)}`;
                }
            } catch (e) {
                console.error("无法获取书籍上下文:", e);
                context += "但我无法获取当前页面的具体内容。";
            }
        } else {
            context = "我正在使用一个电子书阅读器。";
        }


        askBtn.disabled = true;
        askBtn.textContent = '思考中...';

        try {
            const response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: apiModel,
                    messages: [
                        { role: 'system', content: `你是一个博学的阅读助手。请根据用户提供的书籍内容和问题，给出简洁、有帮助的回答。${context}` },
                        { role: 'user', content: question }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API 请求失败: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const answer = data.choices[0]?.message?.content;

            if (answer) {
                // 为了简单起见，我们直接用 alert 显示答案。
                // 在更复杂的应用中，可以将其显示在一个专门的 UI 元素里。
                alert(`回答:\n\n${answer}`);
            } else {
                alert('未能从 API 获取有效回答。');
            }

        } catch (error) {
            console.error('与 OpenAI API 交互时发生错误:', error);
            alert(`发生错误: ${error.message}`);
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = '提问';
            questionInput.value = ''; // 清空问题输入框
        }
    };

    settingsBtn.onclick = () => {
        settingsMenu.classList.toggle('hidden');
    };

    themeSelect.onchange = applySettings;
    fontSizeInput.oninput = applySettings;
    openaiUrlInput.oninput = saveSettings;
    openaiKeyInput.oninput = saveSettings;
    openaiModelInput.oninput = saveSettings;

    // --- App Initialization ---
    // Now that listeners are attached, perform the async setup.
    try {
        await initDB();
        loadSettings(); // This also calls applySettings
        await updateLibraryUI();
    } catch (error) {
        console.error("Application initialization failed:", error);
        initialMessage.innerHTML = "<h2>应用初始化失败</h2><p>请检查控制台错误信息。</p>";
    }
});
