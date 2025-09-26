document.addEventListener('DOMContentLoaded', () => {

    let learnableWords = [], sessionWords = [], currentIndex = 0, isReady = false;
    let selectedWordListIndices = [];
    let isAnswered = false;

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
    };
    let settings = {};

    const dom = {
        body: document.body,
        mainMenu: document.getElementById('main-menu'),
        learningModule: document.getElementById('learning-module'),
        startBtn: document.getElementById('start-learning-btn'),
        wordDisplay: document.getElementById('word-display-container'),
        wordInfo: document.getElementById('word-info-container'),
        pitchOptions: document.getElementById('pitch-options-container'),
        pitchExplanation: document.getElementById('pitch-explanation'),
        audioPlayer: document.getElementById('audio-player'),
        playAudioBtn: document.getElementById('play-audio-btn'),
        prevBtn: document.getElementById('prev-button'),
        nextBtn: document.getElementById('next-button'),
        currentIndexDisplay: document.getElementById('current-word-index'),
        totalCountDisplay: document.getElementById('total-word-count'),
        navigationControls: document.querySelector('.navigation-controls'),
        drawer: document.getElementById('drawer'),
        drawerBtn: document.getElementById('drawer-btn'),
        closeDrawerBtn: document.getElementById('close-drawer-btn'),
        wordList: document.getElementById('word-list'),
        settingsModal: document.getElementById('settings-modal'),
        settingsBtn: document.getElementById('settings-btn'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        interactionHintSelect: document.getElementById('interaction-hint-select'),
        sortBySelect: document.getElementById('sort-by-select'),
        orderSelect: document.getElementById('order-select'),
        keyShortcutSelect: document.getElementById('key-shortcut-select'),
        showInfoToggle: document.getElementById('show-info-toggle'),
        autoplayToggle: document.getElementById('autoplay-toggle'),
        studyModeToggle: document.getElementById('study-mode-toggle'),
        jumpToInput: document.getElementById('jump-to-input'),
        jumpToBtn: document.getElementById('jump-to-btn'),
        overlay: document.getElementById('overlay'),
        wordListDisplay: document.getElementById('word-list-display'),
        wordListNames: document.getElementById('word-list-names'),
        editWordListsBtn: document.getElementById('edit-word-lists-btn'),
        wordListSelectionPanel: document.getElementById('word-list-selection-panel'),
        wordListChoices: document.getElementById('word-list-choices'),
        closeWordListSelectionBtn: document.getElementById('close-word-list-selection-btn'),
        backToMainMenuBtn: document.getElementById('back-to-main-menu-btn'),
    };

    // --- 核心修复：新增 groupYoon 辅助函数 ---
    const YOON_CHARS = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);
    const groupYoon = (text) => {
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

    const parseWordToRuby = (wordString) => {
        const regex = /([^\s\[]+)\[(.+?)\]|([^\s\[]+)/g;
        let html = '';
        let match;
        while ((match = regex.exec(wordString)) !== null) {
            if (match[1] && match[2]) {
                const base = match[1];
                const rubyText = match[2];
                // 使用 groupYoon 来正确组合拗音
                const rubySpans = groupYoon(rubyText).map(mora => `<span class="ruby-char">${mora}</span>`).join('');
                html += `<ruby>${base}<rt>${rubySpans}</rt></ruby>`;
            } else if (match[3]) {
                // 使用 groupYoon 来正确组合拗音
                html += groupYoon(match[3]).map(mora => `<span>${mora}</span>`).join('');
            }
        }
        return html;
    };

    const getKana = (wordString) => {
        let result = wordString.replace(/([^\s\[]+)\[(.+?)\]/g, '$2');
        result = result.replace(/[^ぁ-んァ-ヶー]/g, '');
        return result;
    };
    const countMora = (kana) => groupYoon(kana).length;
    const applyHintSetting = (hintValue) => dom.body.dataset.interactionHint = hintValue;
    const replayAudio = () => {
        dom.audioPlayer.currentTime = 0;
        dom.audioPlayer.play().catch(e => console.log("Audio replay failed:", e));
    };

    const highlightPitch = (pitch) => {
        const wordData = sessionWords[currentIndex];
        if (pitch === -1) return;

        const highPitchMorae = new Set();
        for (let i = 1; i <= wordData.moraCount; i++) {
            if (
                (pitch === 0 && i > 1) ||
                (pitch === 1 && i === 1) ||
                (pitch > 1 && i > 1 && i <= pitch)
            ) {
                highPitchMorae.add(i);
            }
        }
        
        const moraElements = [...dom.wordDisplay.querySelectorAll('span:not(.keyboard-hint), .ruby-char')];
        
        moraElements.forEach((el, index) => {
            const moraIndex = index + 1;
            const parentEl = el.closest('span, ruby');
            if (highPitchMorae.has(moraIndex)) {
                parentEl.classList.add('highlight-strong');
            }
        });
    };

    const loadSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('jpPitchSettings'));
            settings = { ...defaultSettings, ...saved };
        } catch (e) { settings = { ...defaultSettings }; }
        if (!keyMaps[settings.keyShortcut]) settings.keyShortcut = defaultSettings.keyShortcut;
        if (!['show', 'partial', 'hide'].includes(settings.interactionHint)) settings.interactionHint = defaultSettings.interactionHint;
        dom.body.dataset.theme = settings.theme;
        dom.themeToggle.checked = settings.theme === 'dark';
        applyHintSetting(settings.interactionHint);
        dom.interactionHintSelect.value = settings.interactionHint;
        dom.sortBySelect.value = settings.sortBy;
        dom.orderSelect.value = settings.order;
        dom.keyShortcutSelect.value = settings.keyShortcut;
        dom.showInfoToggle.checked = settings.showInfo;
        dom.autoplayToggle.checked = settings.autoPlay;
        dom.studyModeToggle.checked = settings.studyMode;
    };
    const saveSettings = () => localStorage.setItem('jpPitchSettings', JSON.stringify(settings));
    const saveProgress = () => { if (sessionWords[currentIndex]) localStorage.setItem('jpPitchLastWordId', sessionWords[currentIndex].id); };

    const loadWordListSelection = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('jpWordListSelection'));
            if (Array.isArray(saved) && saved.length > 0 && saved.every(i => i >= 0 && i < data.length)) {
                selectedWordListIndices = saved;
            } else { selectedWordListIndices = [0]; }
        } catch (e) { selectedWordListIndices = [0]; }
    };
    const saveWordListSelection = () => localStorage.setItem('jpWordListSelection', JSON.stringify(selectedWordListIndices));

    const aggregateLearnableWords = () => {
        const aggregated = selectedWordListIndices.flatMap(index => data[index]?.data || []);
        learnableWords = aggregated.map((item, index) => ({
            id: index, japanese: item[0], pitch: item[1].replace(/[^⓪①②③④⑤⑥⑦⑧⑨⑩]/g, ''),
            pos: item[2], baseForm: item[3], gaikokugo: item[4], chinese: item[5], audio: item[6],
            kana: getKana(item[0]), moraCount: countMora(getKana(item[0])),
        })).filter(item => item.pitch && item.moraCount > 0);
    };

    const loadProgress = () => {
        const lastId = parseInt(localStorage.getItem('jpPitchLastWordId'), 10);
        if (!isNaN(lastId)) {
            const index = sessionWords.findIndex(word => word.id === lastId);
            return index > -1 ? index : 0;
        }
        return 0;
    };
    
    const generateSessionWords = () => {
        let temp = [...learnableWords];
        if (settings.sortBy === 'length') temp.sort((a, b) => a.moraCount - b.moraCount);
        if (settings.order === 'desc') temp.reverse();
        else if (settings.order === 'random') temp.sort(() => Math.random() - 0.5);
        sessionWords = temp;
    };

    const loadWord = (index, playOnLoad = true) => {
        if (!sessionWords[index]) return;
        currentIndex = index;
        isAnswered = false;
        const wordData = sessionWords[index];
        dom.pitchExplanation.classList.remove('visible');
        dom.wordDisplay.innerHTML = parseWordToRuby(wordData.japanese);
        dom.wordInfo.style.display = settings.showInfo ? 'block' : 'none';
        if (settings.showInfo) dom.wordInfo.innerHTML = [wordData.pos, wordData.baseForm, wordData.gaikokugo, wordData.chinese].filter(Boolean).join(' / ');
        dom.currentIndexDisplay.textContent = currentIndex + 1;
        dom.audioPlayer.src = `audios/${wordData.audio}`;
        if (settings.autoPlay && playOnLoad) dom.audioPlayer.play().catch(e => console.log("Auto-play blocked."));
        dom.pitchOptions.innerHTML = '';
        const keyMap = keyMaps[settings.keyShortcut];
        for (let i = 0; i <= wordData.moraCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'pitch-option-btn';
            btn.dataset.pitch = i;
            btn.innerHTML = `<span>${'⓪①②③④⑤⑥⑦⑧⑨⑩'[i] || `[${i}]`}</span>`;
            if (i < keyMap.length) btn.innerHTML += `<span class="keyboard-hint hint-option">${keyMap[i]}</span>`;
            btn.addEventListener('click', handleOptionClick);
            dom.pitchOptions.appendChild(btn);
        }
        if (settings.studyMode) {
            showAnswer();
        }
        saveProgress();
    };

    const handleOptionClick = (e) => {
        if (isAnswered) return;
        const btn = e.currentTarget;
        const selectedPitch = parseInt(btn.dataset.pitch, 10);
        const word = sessionWords[currentIndex];
        const correctPitches = word.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        
        if (correctPitches.includes(selectedPitch)) {
            btn.classList.add('correct');
            showAnswer(selectedPitch);
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
            showAnswer();
        }
    };
    
    const showAnswer = (pitchToHighlight = -1) => {
        isAnswered = true;
        const correctPitches = sessionWords[currentIndex].pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        dom.pitchOptions.querySelectorAll('.pitch-option-btn').forEach(btn => {
            if (correctPitches.includes(parseInt(btn.dataset.pitch, 10))) btn.classList.add('correct');
            btn.disabled = true;
        });
        
        if (pitchToHighlight !== -1) {
            highlightPitch(pitchToHighlight);
        } else {
            const pitch = correctPitches[Math.floor(Math.random() * correctPitches.length)];
            highlightPitch(pitch);
        }
    };

    const navigate = (dir) => { if (sessionWords.length > 0) loadWord((currentIndex + dir + sessionWords.length) % sessionWords.length); };
    
    const displayFatalError = (msg) => {
        dom.wordDisplay.innerHTML = `<h2>${msg}</h2>`;
        dom.wordInfo.textContent = '请更改单词表选择。';
        dom.pitchOptions.innerHTML = '';
        dom.navigationControls.style.display = 'none';
        ['drawerBtn', 'settingsBtn', 'playAudioBtn'].forEach(k => dom[k] && (dom[k].disabled = true));
        dom.totalCountDisplay.textContent = 0;
        dom.currentIndexDisplay.textContent = 0;
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
        dom.wordList.innerHTML = sessionWords.map((word, index) => `<li data-index="${index}" class="${index === currentIndex ? 'active' : ''}">${index + 1}. ${word.japanese.replace(/\s/g, '')} ${word.chinese}</li>`).join('');
        const activeLi = dom.wordList.querySelector('.active');
        if (activeLi) activeLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const initialize = () => {
        loadSettings();
        loadWordListSelection();
        setupEventListeners();
        updateWordListDisplay();
    };

    const setupEventListeners = () => {
        const togglePanel = (panel, force) => {
            const on = panel.classList.toggle('active', force);
            let anyPanelActive = [dom.drawer, dom.settingsModal, dom.wordListSelectionPanel].some(p => p.classList.contains('active'));
            dom.overlay.classList.toggle('active', anyPanelActive);
            if(panel === dom.drawer && on) populateDrawer();
            if(panel === dom.wordListSelectionPanel && on) populateWordListSelectionPanel();
        };

        dom.startBtn.addEventListener('click', () => {
            aggregateLearnableWords();
            generateSessionWords();
            if (sessionWords.length === 0) {
                alert("所选单词表中没有可学习的单词，请点击“编辑”重新选择。");
                return;
            }
            dom.mainMenu.classList.remove('active');
            dom.learningModule.classList.add('active');
            dom.totalCountDisplay.textContent = sessionWords.length;
            currentIndex = loadProgress();
            loadWord(currentIndex, settings.autoPlay);
            isReady = true;
        });

        dom.backToMainMenuBtn.addEventListener('click', () => {
            dom.learningModule.classList.remove('active');
            dom.mainMenu.classList.add('active');
            isReady = false;
            dom.audioPlayer.pause();
        });
        
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
        
        dom.nextBtn.addEventListener('click', () => navigate(1));
        dom.prevBtn.addEventListener('click', () => navigate(-1));
        dom.playAudioBtn.addEventListener('click', replayAudio);

        dom.drawerBtn.addEventListener('click', () => togglePanel(dom.drawer, true));
        dom.closeDrawerBtn.addEventListener('click', () => togglePanel(dom.drawer, false));
        dom.settingsBtn.addEventListener('click', () => togglePanel(dom.settingsModal, true));
        dom.closeSettingsBtn.addEventListener('click', () => togglePanel(dom.settingsModal, false));
        
        dom.wordListChoices.addEventListener('click', e => {
            const li = e.target.closest('li');
            if (li) {
                const cb = li.querySelector('input');
                if (e.target.tagName !== 'INPUT') cb.checked = !cb.checked;
                const idx = parseInt(li.dataset.index, 10);
                if (cb.checked) {
                    if (!selectedWordListIndices.includes(idx)) selectedWordListIndices.push(idx);
                } else {
                    selectedWordListIndices = selectedWordListIndices.filter(i => i !== idx);
                }
            }
        });
        
        dom.overlay.addEventListener('click', () => {
            [dom.drawer, dom.settingsModal, dom.wordListSelectionPanel].forEach(p => togglePanel(p, false));
        });
        
        dom.themeToggle.addEventListener('change', () => {
            settings.theme = dom.themeToggle.checked ? 'dark' : 'light';
            dom.body.dataset.theme = settings.theme;
            saveSettings();
        });

        dom.interactionHintSelect.addEventListener('change', (e) => {
            settings.interactionHint = e.target.value;
            applyHintSetting(settings.interactionHint);
            saveSettings();
        });

        [dom.sortBySelect, dom.orderSelect].forEach(el => {
            el.addEventListener('change', () => {
                settings[el.id.startsWith('sort') ? 'sortBy' : 'order'] = el.value;
                saveSettings();
                if (isReady) {
                    generateSessionWords();
                    loadWord(0);
                }
            });
        });

        const simpleUpdater = (el, key, reload) => el.addEventListener('change', () => {
            settings[key] = el.type === 'checkbox' ? el.checked : el.value;
            saveSettings();
            if (reload && isReady) {
                loadWord(currentIndex, false);
            }
        });
        simpleUpdater(dom.keyShortcutSelect, 'keyShortcut', true);
        simpleUpdater(dom.showInfoToggle, 'showInfo', true);
        simpleUpdater(dom.autoplayToggle, 'autoPlay');
        simpleUpdater(dom.studyModeToggle, 'studyMode', true);
        
        dom.jumpToBtn.addEventListener('click', () => {
            const idx = parseInt(dom.jumpToInput.value, 10) - 1;
            if (idx >= 0 && idx < sessionWords.length) {
                loadWord(idx);
                togglePanel(dom.settingsModal, false);
            } else {
                alert(`请输入 1 到 ${sessionWords.length} 之间的有效数字。`);
            }
        });

        dom.wordList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li) {
                loadWord(parseInt(li.dataset.index, 10));
                togglePanel(dom.drawer, false);
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!isReady || !dom.learningModule.classList.contains('active') || dom.overlay.classList.contains('active') || document.activeElement.tagName === 'INPUT') return;
            
            if (e.key.toLowerCase() === 'r') {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault(); replayAudio(); return;
            }

            if (e.key === 'Enter' && isAnswered) {
                e.preventDefault();
                navigate(1);
                return;
            }

            if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); return; }

            const keyMap = keyMaps[settings.keyShortcut];
            const keyIndex = keyMap.indexOf(e.key.toLowerCase());
            const btns = dom.pitchOptions.querySelectorAll('.pitch-option-btn');
            if (keyIndex > -1 && btns[keyIndex] && !btns[keyIndex].disabled) {
                e.preventDefault(); btns[keyIndex].click();
            }
        });
    };
    
    initialize();
});