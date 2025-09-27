document.addEventListener('DOMContentLoaded', () => {
    // --- 状态管理 ---
    let learnableWords = [], sessionWords = [], currentIndex = 0, isReady = false;
    let selectedWordListIndices = [];
    let isAnswered = false;
    let activeModule = null; // 'pitch' or 'dictation'

    // --- 设置 ---
    const keyMaps = {
        qwerty: 'qwertyuiop'.split(''),
        abcdef: 'abcdefghijklmnopqrstuvwxyz'.split(''),
        numeric: '0123456789'.split(''),
    };
    const defaultSettings = {
        theme: 'light',
        interactionHint: 'show',
        sortBy: 'default',
        order: 'asc',
        showInfo: true,
        keyShortcut: 'qwerty',
        autoPlay: true,
        studyMode: false,
        kanaVisibility: 'always-show',
        jpVisibility: 'always-show',
    };
    let settings = {};

    // --- DOM 引用 ---
    const dom = {
        body: document.body,
        mainMenu: document.getElementById('main-menu'),
        overlay: document.getElementById('overlay'),
        audioPlayer: document.getElementById('audio-player'),

        // 通用面板
        drawer: document.getElementById('drawer'),
        closeDrawerBtn: document.getElementById('close-drawer-btn'),
        wordList: document.getElementById('word-list'),
        settingsModal: document.getElementById('settings-modal'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        wordListSelectionPanel: document.getElementById('word-list-selection-panel'),
        wordListChoices: document.getElementById('word-list-choices'),
        closeWordListSelectionBtn: document.getElementById('close-word-list-selection-btn'),
        
        // 主菜单元素
        startLearningBtn: document.getElementById('start-learning-btn'),
        startDictationBtn: document.getElementById('start-dictation-btn'),
        wordListDisplay: document.getElementById('word-list-display'),
        wordListNames: document.getElementById('word-list-names'),
        editWordListsBtn: document.getElementById('edit-word-lists-btn'),

        // 声调模块元素
        learningModule: document.getElementById('learning-module'),
        wordDisplay: document.getElementById('word-display-container'),
        wordInfo: document.getElementById('word-info-container'),
        pitchOptions: document.getElementById('pitch-options-container'),
        pitchExplanation: document.getElementById('pitch-explanation'),
        playAudioBtn: document.getElementById('play-audio-btn'),
        pitchProgressCurrent: document.getElementById('current-word-index'),
        pitchProgressTotal: document.getElementById('total-word-count'),


        // 听写模块元素
        dictationModule: document.getElementById('dictation-module'),
        dictationPlayAudioBtn: document.getElementById('dictation-play-audio-btn'),
        dictationInput: document.getElementById('dictation-input'),
        dictationAnswerContainer: document.getElementById('dictation-answer-container'),
        dictationAnswerFeedback: document.getElementById('dictation-answer-feedback'),
        dictationCorrectAnswer: document.getElementById('dictation-correct-answer'),
        dictationProgressCurrent: document.getElementById('current-word-index-dictation'),
        dictationProgressTotal: document.getElementById('total-word-count-dictation'),

        // 设置面板元素
        themeToggle: document.getElementById('theme-toggle'),
        interactionHintSelect: document.getElementById('interaction-hint-select'),
        sortBySelect: document.getElementById('sort-by-select'),
        orderSelect: document.getElementById('order-select'),
        keyShortcutSelect: document.getElementById('key-shortcut-select'),
        showInfoToggle: document.getElementById('show-info-toggle'),
        autoplayToggle: document.getElementById('autoplay-toggle'),
        studyModeToggle: document.getElementById('study-mode-toggle'),
        kanaVisibilitySelect: document.getElementById('kana-visibility-select'),
        jpVisibilitySelect: document.getElementById('jp-visibility-select'),
        jumpToInput: document.getElementById('jump-to-input'),
        jumpToBtn: document.getElementById('jump-to-btn'),
    };

    // --- 核心工具函数 ---
    const YOON_CHARS = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);
    const groupYoon = (text) => {
        if (!text) return [];
        const result = [];
        for (let i = 0; i < text.length; i++) {
            if (i + 1 < text.length && YOON_CHARS.has(text[i + 1])) {
                result.push(text[i] + text[i + 1]);
                i++;
            } else {
                result.push(text[i]);
            }
        }
        return result;
    };
    const getKana = (wordString) => {
        let result = wordString.replace(/([^\s\[]+)\[(.+?)\]/g, '$2');
        result = result.replace(/[^ぁ-んァ-ヶー]/g, '');
        return result;
    };
    const countMora = (kana) => groupYoon(kana).length;

    // --- 答案验证核心函数 (已重构) ---
    const generateValidAnswers = (wordString) => {
        const regex = /([^\s\[]+)\[(.+?)\]|([^\s\[]+)/g;
        let match;
        const segments = [];
        while ((match = regex.exec(wordString)) !== null) {
            if (match[1] && match[2]) {
                segments.push({ base: match[1], reading: match[2] });
            } else if (match[3]) {
                segments.push({ base: match[3], reading: match[3] });
            }
        }

        let combinations = new Set(['']);
        for (const segment of segments) {
            const newCombinations = new Set();
            for (const combo of combinations) {
                newCombinations.add(combo + segment.base);
                if (segment.base !== segment.reading) {
                    newCombinations.add(combo + segment.reading);
                }
            }
            combinations = newCombinations;
        }
        return combinations;
    };

    // --- 通用功能函数 ---
    const replayAudio = () => {
        dom.audioPlayer.currentTime = 0;
        dom.audioPlayer.play().catch(e => console.error("Audio replay failed:", e));
    };
    const navigate = (dir) => {
        if (sessionWords.length === 0) return;
        const newIndex = (currentIndex + dir + sessionWords.length) % sessionWords.length;
        if (activeModule === 'pitch') loadPitchWord(newIndex);
        else if (activeModule === 'dictation') loadDictationWord(newIndex);
    };

    // --- 设置管理 ---
    const applyVisibilitySettings = () => {
        dom.body.dataset.kanaVisibility = settings.kanaVisibility;
        dom.body.dataset.jpVisibility = settings.jpVisibility;
    };
    const loadSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('jpPitchSettings'));
            settings = { ...defaultSettings, ...saved };
        } catch (e) { settings = { ...defaultSettings }; }
        
        dom.body.dataset.theme = settings.theme;
        dom.themeToggle.checked = settings.theme === 'dark';
        applyVisibilitySettings();
        
        Object.keys(defaultSettings).forEach(key => {
            const elId = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            const el = document.getElementById(elId + '-select') || document.getElementById(elId + '-toggle');
            if (el) {
                if (el.type === 'checkbox') el.checked = settings[key];
                else el.value = settings[key];
            }
        });
        dom.body.dataset.interactionHint = settings.interactionHint;
    };
    const saveSettings = () => localStorage.setItem('jpPitchSettings', JSON.stringify(settings));

    // --- 数据与会话管理 ---
    const loadWordListSelection = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('jpWordListSelection'));
            if (Array.isArray(saved) && saved.length > 0 && saved.every(i => i >= 0 && i < data.length)) {
                selectedWordListIndices = saved;
            } else { selectedWordListIndices = [0]; }
        } catch (e) { selectedWordListIndices = [0]; }
        updateWordListDisplay();
    };
    const saveWordListSelection = () => localStorage.setItem('jpWordListSelection', JSON.stringify(selectedWordListIndices));
    const aggregateLearnableWords = () => {
        const aggregated = selectedWordListIndices.flatMap(index => data[index]?.data || []);
        learnableWords = aggregated.map((item, index) => ({
            id: index, japanese: item[0], pitch: item[1].replace(/[^⓪①②③④⑤⑥⑦⑧⑨⑩]/g, ''),
            pos: item[2], baseForm: item[3], gaikokugo: item[4], chinese: item[5], audio: item[6],
            kana: getKana(item[0]), moraCount: countMora(getKana(item[0])),
        })).filter(item => item.audio); // 确保有音频
    };
    const generateSessionWords = () => {
        let temp = [...learnableWords];
        if (settings.sortBy === 'length') temp.sort((a, b) => a.moraCount - b.moraCount);
        if (settings.order === 'desc') temp.reverse();
        else if (settings.order === 'random') temp.sort(() => Math.random() - 0.5);
        sessionWords = temp;
    };
    const saveProgress = () => {
        if (sessionWords[currentIndex]) {
            localStorage.setItem(`jp-${activeModule}-lastWordId`, sessionWords[currentIndex].id);
        }
    };
    const loadProgress = () => {
        const lastId = parseInt(localStorage.getItem(`jp-${activeModule}-lastWordId`), 10);
        if (!isNaN(lastId)) {
            const index = sessionWords.findIndex(word => word.id === lastId);
            return index > -1 ? index : 0;
        }
        return 0;
    };
    
    // ==================== 声调模块逻辑 ====================
    const renderWord = (wordString) => {
        dom.wordDisplay.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const regex = /([^\s\[]+)\[(.+?)\]|([^\s\[]+)/g;
        let match;
        while ((match = regex.exec(wordString)) !== null) {
            if (match[1] && match[2]) {
                const segment = document.createElement('div'); segment.className = 'word-segment';
                const kanjiSpan = document.createElement('span'); kanjiSpan.className = 'kanji'; kanjiSpan.textContent = match[1];
                const rtContainer = document.createElement('div'); rtContainer.className = 'rt-container';
                const morae = groupYoon(match[2]);
                morae.forEach(mora => { const moraSpan = document.createElement('span'); moraSpan.className = 'rt-mora'; moraSpan.textContent = mora; rtContainer.appendChild(moraSpan); });
                segment.appendChild(rtContainer); segment.appendChild(kanjiSpan); fragment.appendChild(segment);
            } else if (match[3]) {
                const morae = groupYoon(match[3]);
                morae.forEach(mora => {
                    const segment = document.createElement('div'); segment.className = 'word-segment';
                    const kanjiSpan = document.createElement('span'); kanjiSpan.className = 'kanji'; kanjiSpan.textContent = mora;
                    const rtContainer = document.createElement('div'); rtContainer.className = 'rt-container';
                    const moraSpan = document.createElement('span'); moraSpan.className = 'rt-mora visually-hidden'; moraSpan.textContent = mora; rtContainer.appendChild(moraSpan);
                    segment.appendChild(rtContainer); segment.appendChild(kanjiSpan); fragment.appendChild(segment);
                });
            }
        }
        dom.wordDisplay.appendChild(fragment);
    };
    const highlightPitch = (pitch) => {
        const wordData = sessionWords[currentIndex];
        if (pitch === -1 || pitch === undefined) return;
        const highPitchMoraeIndices = new Set();
        for (let i = 1; i <= wordData.moraCount; i++) {
            if ((pitch === 0 && i > 1) || (pitch === 1 && i === 1) || (pitch > 1 && i > 1 && i <= pitch)) {
                highPitchMoraeIndices.add(i);
            }
        }
        let moraCounter = 0;
        dom.wordDisplay.querySelectorAll('.word-segment').forEach(segment => {
            const kanjiSpan = segment.querySelector('.kanji');
            const moraSpans = segment.querySelectorAll('.rt-mora');
            let highCountInSegment = 0;
            moraSpans.forEach(moraSpan => {
                moraCounter++;
                if (highPitchMoraeIndices.has(moraCounter)) {
                    moraSpan.classList.add('highlight');
                    highCountInSegment++;
                }
            });
            if (highCountInSegment > 0) {
                kanjiSpan.classList.add(highCountInSegment === moraSpans.length ? 'highlight-strong' : 'highlight-soft');
            }
        });
    };
    const loadPitchWord = (index, playOnLoad = true) => {
        if (!sessionWords[index]) return;
        currentIndex = index;
        isAnswered = false;
        const wordData = sessionWords[index];
        dom.wordDisplay.classList.remove('answered');
        dom.pitchExplanation.classList.remove('visible');
        renderWord(wordData.japanese);
        dom.wordInfo.style.display = settings.showInfo ? 'block' : 'none';
        if (settings.showInfo) dom.wordInfo.innerHTML = [wordData.pos, wordData.baseForm, wordData.gaikokugo, wordData.chinese].filter(Boolean).join(' / ');
        dom.pitchProgressCurrent.textContent = currentIndex + 1;
        dom.audioPlayer.src = `audios/${wordData.audio}`;
        if (settings.autoPlay && playOnLoad) dom.audioPlayer.play().catch(e => {});
        dom.pitchOptions.innerHTML = '';
        const keyMap = keyMaps[settings.keyShortcut];
        for (let i = 0; i <= wordData.moraCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'pitch-option-btn';
            btn.dataset.pitch = i;
            btn.innerHTML = `<span>${'⓪①②③④⑤⑥⑦⑧⑨⑩'[i] || `[${i}]`}</span>`;
            if (i < keyMap.length) btn.innerHTML += `<span class="keyboard-hint hint-option">${keyMap[i]}</span>`;
            btn.addEventListener('click', handlePitchOptionClick);
            dom.pitchOptions.appendChild(btn);
        }
        if (settings.studyMode) showPitchAnswer();
        saveProgress();
    };
    const handlePitchOptionClick = (e) => {
        if (isAnswered) return;
        const btn = e.currentTarget;
        const selectedPitch = parseInt(btn.dataset.pitch, 10);
        const word = sessionWords[currentIndex];
        const correctPitches = word.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        if (correctPitches.includes(selectedPitch)) {
            btn.classList.add('correct');
            showPitchAnswer(selectedPitch);
        } else {
            const isAmbiguous = (correctPitches.includes(0) && selectedPitch === word.moraCount) || (correctPitches.includes(word.moraCount) && selectedPitch === 0);
            if (isAmbiguous) {
                btn.classList.add('ambiguous');
                const moraSymbol = '⓪①②③④⑤⑥⑦⑧⑨⑩'[word.moraCount] || `[${word.moraCount}]`;
                dom.pitchExplanation.textContent = `听觉上正确！但该词为 ${word.pitch} 调。⓪调和尾高调(${moraSymbol}调)的区别在于后接助词时，⓪调不降，尾高调会降。`;
                dom.pitchExplanation.classList.add('visible');
            } else {
                btn.classList.add('incorrect');
            }
            showPitchAnswer();
        }
    };
    const showPitchAnswer = (pitchToHighlight = -1) => {
        isAnswered = true;
        dom.wordDisplay.classList.add('answered');
        const correctPitches = sessionWords[currentIndex].pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        dom.pitchOptions.querySelectorAll('.pitch-option-btn').forEach(btn => {
            if (correctPitches.includes(parseInt(btn.dataset.pitch, 10))) btn.classList.add('correct');
            btn.disabled = true;
        });
        const pitch = pitchToHighlight !== -1 ? pitchToHighlight : correctPitches[Math.floor(Math.random() * correctPitches.length)];
        highlightPitch(pitch);
    };

    // ==================== 听写模块逻辑 ====================
    const loadDictationWord = (index, playOnLoad = true) => {
        if (!sessionWords[index]) return;
        currentIndex = index;
        isAnswered = false;
        const wordData = sessionWords[index];
        dom.dictationInput.value = '';
        dom.dictationInput.disabled = false;
        dom.dictationInput.classList.remove('correct', 'incorrect');
        dom.dictationAnswerContainer.classList.remove('visible');
        dom.dictationInput.focus();
        dom.dictationProgressCurrent.textContent = currentIndex + 1;
        dom.audioPlayer.src = `audios/${wordData.audio}`;
        if (settings.autoPlay && playOnLoad) dom.audioPlayer.play().catch(e => {});
        saveProgress();
    };
    
    // --- 核心修复：从0重构的答案验证算法 ---
    const checkDictationAnswer = () => {
        if (isAnswered) return;
        isAnswered = true;
        dom.dictationInput.disabled = true;
        
        // 步骤1：定义一个净化函数，它将移除所有非核心的日文字符
        const purifyString = (str) => {
            // 这个正则表达式匹配任何非（hiragana, katakana, kanji, or numbers）的字符
            // \u3040-\u309F: Hiragana
            // \u30A0-\u30FF: Katakana
            // \u4E00-\u9FAF: Common Kanji
            // \u3400-\u4DBF: Rare Kanji
            // 0-9: Numbers
            const nonCoreCharRegex = /[^ぁ-んァ-ヶー一-龯0-9]/g;
            return str.replace(nonCoreCharRegex, '');
        };

        const userInput = dom.dictationInput.value.trim();
        const wordData = sessionWords[currentIndex];
        
        // 步骤2：生成所有可能的原始答案组合
        const validRawAnswers = generateValidAnswers(wordData.japanese);
        
        // 步骤3：净化用户输入
        const purifiedUserInput = purifyString(userInput);
        
        let isCorrect = false;
        // 步骤4：遍历每一个原始答案，净化它，然后与净化后的用户输入进行比较
        for (const rawAnswer of validRawAnswers) {
            const purifiedAnswer = purifyString(rawAnswer);
            if (purifiedAnswer && purifiedAnswer === purifiedUserInput) {
                isCorrect = true;
                break; // 找到一个匹配就足够了
            }
        }
        
        // 步骤5：显示结果
        showDictationAnswer(isCorrect, wordData.japanese.replace(/\[.+?\]/g, ''));
    };

    const showDictationAnswer = (isCorrect, correctAnswer) => {
        if (isCorrect) {
            dom.dictationInput.classList.add('correct');
            dom.dictationAnswerFeedback.textContent = '正确！';
        } else {
            dom.dictationInput.classList.add('incorrect');
            dom.dictationAnswerFeedback.textContent = '错误。正解：';
        }
        dom.dictationCorrectAnswer.textContent = correctAnswer;
        dom.dictationAnswerContainer.classList.add('visible');
    };

    // ==================== 初始化与事件绑定 ====================
    const initialize = () => {
        loadSettings();
        loadWordListSelection();
        setupEventListeners();
    };
    
    const updateWordListDisplay = () => {
        const names = selectedWordListIndices.map(i => data[i]?.name || '未知表').join('，');
        dom.wordListNames.textContent = `当前：${names}`;
    };
    const populateWordListSelectionPanel = () => {
        dom.wordListChoices.innerHTML = data.map((list, index) => `
            <li class="word-list-item" data-index="${index}">
                <input type="checkbox" id="list-checkbox-${index}" ${selectedWordListIndices.includes(index) ? 'checked' : ''}>
                <label for="list-checkbox-${index}">${list.name}</label>
            </li>
        `).join('');
    };
    const populateDrawer = () => {
        dom.wordList.innerHTML = sessionWords.map((word, index) => `<li data-index="${index}" class="${index === currentIndex ? 'active' : ''}">${index + 1}. ${word.japanese.replace(/\[.*?\]/g, '')} ${word.chinese}</li>`).join('');
        const activeLi = dom.wordList.querySelector('.active');
        if (activeLi) activeLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    function setupEventListeners() {
        const togglePanel = (panel, force) => {
            const on = panel.classList.toggle('active', force);
            let anyPanelActive = [dom.drawer, dom.settingsModal, dom.wordListSelectionPanel].some(p => p.classList.contains('active'));
            dom.overlay.classList.toggle('active', anyPanelActive);
            if (panel === dom.wordListSelectionPanel && on) populateWordListSelectionPanel();
        };
        
        const startModule = (module) => {
            aggregateLearnableWords();
            if (learnableWords.length === 0) {
                alert("所选单词表中没有可学习的单词，请点击“编辑”重新选择。");
                return;
            }
            generateSessionWords();
            activeModule = module;
            dom.mainMenu.classList.remove('active');
            isReady = true;
            const startIndex = loadProgress();
            if (module === 'pitch') {
                dom.learningModule.classList.add('active');
                dom.pitchProgressTotal.textContent = sessionWords.length;
                loadPitchWord(startIndex);
            } else if (module === 'dictation') {
                dom.dictationModule.classList.add('active');
                dom.dictationProgressTotal.textContent = sessionWords.length;
                loadDictationWord(startIndex);
            }
        };

        dom.startLearningBtn.addEventListener('click', () => startModule('pitch'));
        dom.startDictationBtn.addEventListener('click', () => startModule('dictation'));
        
        const backToMainMenu = () => {
            dom.learningModule.classList.remove('active');
            dom.dictationModule.classList.remove('active');
            dom.mainMenu.classList.add('active');
            isReady = false;
            activeModule = null;
            dom.audioPlayer.pause();
        };
        document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', backToMainMenu));

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const dir = btn.id.includes('next') ? 1 : -1;
            btn.addEventListener('click', () => navigate(dir));
        });

        dom.playAudioBtn.addEventListener('click', replayAudio);
        dom.dictationPlayAudioBtn.addEventListener('click', replayAudio);
        
        document.querySelectorAll('.settings-trigger-btn').forEach(btn => btn.addEventListener('click', () => {
            dom.settingsModal.dataset.module = activeModule;
            togglePanel(dom.settingsModal, true);
        }));
        document.querySelectorAll('.drawer-trigger-btn').forEach(btn => btn.addEventListener('click', () => {
            populateDrawer();
            togglePanel(dom.drawer, true);
        }));
        dom.closeSettingsBtn.addEventListener('click', () => togglePanel(dom.settingsModal, false));
        dom.closeDrawerBtn.addEventListener('click', () => togglePanel(dom.drawer, false));
        
        dom.editWordListsBtn.addEventListener('click', () => togglePanel(dom.wordListSelectionPanel, true));
        dom.closeWordListSelectionBtn.addEventListener('click', () => {
            if (selectedWordListIndices.length === 0) {
                alert("请至少选择一个单词表！");
                return;
            }
            saveWordListSelection();
            updateWordListDisplay();
            togglePanel(dom.wordListSelectionPanel, false);
        });

        dom.wordListChoices.addEventListener('click', e => {
            const li = e.target.closest('li');
            if (li) {
                const cb = li.querySelector('input');
                if (e.target.tagName !== 'INPUT') cb.checked = !cb.checked;
                const idx = parseInt(li.dataset.index, 10);
                selectedWordListIndices = cb.checked
                    ? [...new Set([...selectedWordListIndices, idx])]
                    : selectedWordListIndices.filter(i => i !== idx);
            }
        });
        
        dom.overlay.addEventListener('click', () => [dom.drawer, dom.settingsModal, dom.wordListSelectionPanel].forEach(p => togglePanel(p, false)));
        
        dom.themeToggle.addEventListener('change', () => {
            settings.theme = dom.themeToggle.checked ? 'dark' : 'light';
            dom.body.dataset.theme = settings.theme;
            saveSettings();
        });

        dom.interactionHintSelect.addEventListener('change', (e) => {
            settings.interactionHint = e.target.value;
            dom.body.dataset.interactionHint = settings.interactionHint;
            saveSettings();
        });

        dom.kanaVisibilitySelect.addEventListener('change', (e) => {
            settings.kanaVisibility = e.target.value;
            applyVisibilitySettings();
            saveSettings();
        });

        dom.jpVisibilitySelect.addEventListener('change', (e) => {
            settings.jpVisibility = e.target.value;
            applyVisibilitySettings();
            saveSettings();
        });

        [dom.sortBySelect, dom.orderSelect].forEach(el => {
            el.addEventListener('change', () => {
                const key = el.id.startsWith('sort') ? 'sortBy' : 'order';
                settings[key] = el.value;
                saveSettings();
                if (isReady) {
                    generateSessionWords();
                    const newIndex = 0; // Always start from 0 after re-sorting
                    if (activeModule === 'pitch') {
                        dom.pitchProgressTotal.textContent = sessionWords.length;
                        loadPitchWord(newIndex);
                    } else if (activeModule === 'dictation') {
                        dom.dictationProgressTotal.textContent = sessionWords.length;
                        loadDictationWord(newIndex);
                    }
                }
            });
        });

        const simpleUpdater = (el, key, reloadOnChange) => {
            el.addEventListener('change', () => {
                settings[key] = el.type === 'checkbox' ? el.checked : el.value;
                saveSettings();
                if (reloadOnChange && isReady && activeModule === 'pitch') {
                    loadPitchWord(currentIndex, false);
                }
            });
        };
        simpleUpdater(dom.keyShortcutSelect, 'keyShortcut', true);
        simpleUpdater(dom.showInfoToggle, 'showInfo', true);
        simpleUpdater(dom.autoplayToggle, 'autoPlay', false);
        simpleUpdater(dom.studyModeToggle, 'studyMode', true);
        
        dom.jumpToBtn.addEventListener('click', () => {
            const idx = parseInt(dom.jumpToInput.value, 10) - 1;
            if (idx >= 0 && idx < sessionWords.length) {
                if (activeModule === 'pitch') loadPitchWord(idx);
                else if (activeModule === 'dictation') loadDictationWord(idx);
                togglePanel(dom.settingsModal, false);
            } else {
                alert(`请输入 1 到 ${sessionWords.length} 之间的有效数字。`);
            }
        });

        dom.wordList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li) {
                const index = parseInt(li.dataset.index, 10);
                if (activeModule === 'pitch') loadPitchWord(index);
                else if (activeModule === 'dictation') loadDictationWord(index);
                togglePanel(dom.drawer, false);
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!isReady || dom.overlay.classList.contains('active')) return;
            const isInputActive = document.activeElement === dom.dictationInput;

            if (e.key.toLowerCase() === 'r' && !isInputActive) {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                replayAudio();
                return;
            }

            if (e.key === 'Enter') {
                if (isInputActive && activeModule === 'dictation' && !isAnswered) {
                    e.preventDefault();
                    checkDictationAnswer();
                } else if (isAnswered) {
                    e.preventDefault();
                    navigate(1);
                }
                return;
            }
            
            if (isInputActive) return;

            if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); return; }

            if (activeModule === 'pitch') {
                const keyMap = keyMaps[settings.keyShortcut];
                const keyIndex = keyMap.indexOf(e.key.toLowerCase());
                const btns = dom.pitchOptions.querySelectorAll('.pitch-option-btn');
                if (keyIndex > -1 && btns[keyIndex] && !btns[keyIndex].disabled) {
                    e.preventDefault();
                    btns[keyIndex].click();
                }
            }
        });
    }

    initialize();
});