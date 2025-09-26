document.addEventListener('DOMContentLoaded', () => {

    // --- 全局状态和变量 ---
    let learnableWords = [];
    let sessionWords = [];
    let currentIndex = 0;
    const keyMaps = {
        qwerty: 'qwertyuiop'.split(''),
        abcdef: 'abcdefghijklmnopqrstuvwxyz'.split(''),
        numeric: '1234567890'.split(''),
    };

    // --- 默认设置 ---
    const defaultSettings = {
        sortBy: 'default',
        order: 'asc',
        showInfo: true,
        keyShortcut: 'qwerty',
        autoPlay: true,
        studyMode: false,
    };
    let settings = {};

    // --- DOM 元素获取 ---
    const dom = {
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
        // 抽屉
        drawer: document.getElementById('drawer'),
        drawerBtn: document.getElementById('drawer-btn'),
        closeDrawerBtn: document.getElementById('close-drawer-btn'),
        wordList: document.getElementById('word-list'),
        // 设置
        settingsModal: document.getElementById('settings-modal'),
        settingsBtn: document.getElementById('settings-btn'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        sortBySelect: document.getElementById('sort-by-select'),
        orderSelect: document.getElementById('order-select'),
        keyShortcutSelect: document.getElementById('key-shortcut-select'),
        showInfoToggle: document.getElementById('show-info-toggle'),
        autoplayToggle: document.getElementById('autoplay-toggle'),
        studyModeToggle: document.getElementById('study-mode-toggle'),
        jumpToInput: document.getElementById('jump-to-input'),
        jumpToBtn: document.getElementById('jump-to-btn'),
        // 遮罩
        overlay: document.getElementById('overlay'),
    };

    // --- 功能函数 ---

    /**
     * 解析单词字符串 `漢[かん]字[じ]` 为 HTML ruby 标签
     * @param {string} wordString - The input string.
     * @returns {string} HTML string with <ruby> tags.
     */
    const parseWordToRuby = (wordString) => {
        if (!wordString) return '';
        const regex = /(.+?)\[(.+?)\]/g;
        return wordString.replace(regex, '<ruby>$1<rt>$2</rt></ruby>');
    };

    /**
     * 提取假名部分用于计算长度
     * @param {string} wordString - The input string.
     * @returns {string} The kana part of the word.
     */
    const getKana = (wordString) => {
        if (!wordString) return '';
        let kana = '';
        const matches = wordString.matchAll(/\[(.*?)\]/g);
        for (const match of matches) {
            kana += match[1];
        }
        return kana || wordString; // Fallback for plain kana words
    };

    /**
     * 计算假名音节数 (mora)，拗音算一个
     * @param {string} kana - The kana string.
     * @returns {number} The number of moras.
     */
    const countMora = (kana) => {
        const smallKana = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'っ']);
        let moraCount = 0;
        for (let i = 0; i < kana.length; i++) {
            if (!smallKana.has(kana[i])) {
                moraCount++;
            }
        }
        return moraCount;
    };

    /**
     * 加载和应用设置
     */
    const loadSettings = () => {
        const savedSettings = JSON.parse(localStorage.getItem('jpPitchSettings'));
        settings = { ...defaultSettings, ...savedSettings };

        // 应用到UI
        dom.sortBySelect.value = settings.sortBy;
        dom.orderSelect.value = settings.order;
        dom.keyShortcutSelect.value = settings.keyShortcut;
        dom.showInfoToggle.checked = settings.showInfo;
        dom.autoplayToggle.checked = settings.autoPlay;
        dom.studyModeToggle.checked = settings.studyMode;
    };
    
    /**
     * 保存设置
     */
    const saveSettings = () => {
        localStorage.setItem('jpPitchSettings', JSON.stringify(settings));
    };

    /**
     * 保存进度
     */
    const saveProgress = () => {
        localStorage.setItem('jpPitchProgress', currentIndex);
    };

    /**
     * 加载进度
     */
    const loadProgress = () => {
        const savedIndex = localStorage.getItem('jpPitchProgress');
        return savedIndex ? parseInt(savedIndex, 10) : 0;
    };
    
    /**
     * 根据设置生成会话单词列表
     */
    const generateSessionWords = () => {
        let tempWords = [...learnableWords];

        // 1. 排序
        if (settings.sortBy === 'length') {
            tempWords.sort((a, b) => a.moraCount - b.moraCount);
        }
        // 'default' is already sorted by array order

        // 2. 顺序
        if (settings.order === 'desc') {
            tempWords.reverse();
        } else if (settings.order === 'random') {
            tempWords.sort(() => Math.random() - 0.5);
        }
        
        sessionWords = tempWords;
        dom.totalCountDisplay.textContent = sessionWords.length;
        dom.jumpToInput.max = sessionWords.length;
    };

    /**
     * 加载指定索引的单词
     * @param {number} index - The index in sessionWords.
     */
    const loadWord = (index) => {
        if (index < 0 || index >= sessionWords.length) return;
        
        currentIndex = index;
        const wordData = sessionWords[index];
        
        // 清理旧状态
        dom.pitchExplanation.textContent = '';
        dom.pitchExplanation.style.visibility = 'hidden';
        
        // 显示单词
        dom.wordDisplay.innerHTML = parseWordToRuby(wordData.japanese);
        
        // 显示单词信息
        dom.wordInfo.style.display = settings.showInfo ? 'block' : 'none';
        if (settings.showInfo) {
            let infoParts = [wordData.pos, wordData.baseForm, wordData.gaikokugo, wordData.chinese]
                .filter(p => p && p.trim() !== '').join(' / ');
            dom.wordInfo.innerHTML = infoParts;
        }

        // 更新进度显示
        dom.currentIndexDisplay.textContent = currentIndex + 1;

        // 设置音频
        dom.audioPlayer.src = `audios/${wordData.audio}`;
        if (settings.autoPlay) {
            dom.audioPlayer.play().catch(e => console.log("Autoplay blocked."));
        }

        // 生成音调选项
        dom.pitchOptions.innerHTML = '';
        const moraCount = wordData.moraCount;
        const keyMap = keyMaps[settings.keyShortcut];
        for (let i = 0; i <= moraCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'pitch-option-btn';
            btn.dataset.pitch = i;
            
            const pitchText = document.createElement('span');
            pitchText.textContent = `⓪①②③④⑤⑥⑦⑧⑨⑩`[i];
            btn.appendChild(pitchText);

            if (i < keyMap.length) {
                const hint = document.createElement('span');
                hint.className = 'keyboard-hint';
                hint.textContent = keyMap[i];
                btn.appendChild(hint);
            }
            
            btn.addEventListener('click', handleOptionClick);
            dom.pitchOptions.appendChild(btn);
        }

        // 学习模式
        if (settings.studyMode) {
            showAnswer();
        }

        saveProgress();
    };

    /**
     * 处理音调选项点击
     * @param {Event} e - The click event.
     */
    function handleOptionClick(e) {
        const selectedBtn = e.currentTarget;
        const selectedPitch = selectedBtn.dataset.pitch;
        const wordData = sessionWords[currentIndex];
        const correctPitches = wordData.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        const moraCount = wordData.moraCount;

        const isCorrect = correctPitches.includes(parseInt(selectedPitch));
        
        // 绿-灰-红 逻辑
        if (isCorrect) {
            selectedBtn.classList.add('correct');
        } else {
            const isAmbiguous = (correctPitches.includes(0) && parseInt(selectedPitch) === moraCount) ||
                                (correctPitches.includes(moraCount) && parseInt(selectedPitch) === 0);
            if (isAmbiguous) {
                selectedBtn.classList.add('ambiguous');
                dom.pitchExplanation.textContent = `听觉上正确！但该词为 ${wordData.pitch} 调。⓪调和尾高调(${'⓪①②③④⑤⑥⑦⑧⑨⑩'[moraCount]}调)的区别在于后接助词时，⓪调不降，尾高调会降。`;
                dom.pitchExplanation.style.visibility = 'visible';
            } else {
                selectedBtn.classList.add('incorrect');
            }
        }
        
        showAnswer();
    }
    
    /**
     * 显示正确答案并禁用按钮
     */
    const showAnswer = () => {
        const wordData = sessionWords[currentIndex];
        const correctPitches = wordData.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));

        const optionBtns = dom.pitchOptions.querySelectorAll('.pitch-option-btn');
        optionBtns.forEach(btn => {
            const pitchValue = parseInt(btn.dataset.pitch);
            if (correctPitches.includes(pitchValue) && !btn.classList.contains('correct')) {
                 btn.classList.add('correct');
            }
            btn.disabled = true;
        });
    };

    const nextWord = () => loadWord((currentIndex + 1) % sessionWords.length);
    const prevWord = () => loadWord((currentIndex - 1 + sessionWords.length) % sessionWords.length);
    
    /**
     * 初始化应用
     */
    const initialize = () => {
        // 1. 数据预处理
        learnableWords = data.map((item, index) => {
            const japanese = item[0];
            const kana = getKana(japanese);
            return {
                id: index,
                japanese: japanese,
                pitch: item[1].replace(/[^⓪①②③④⑤⑥⑦⑧⑨⑩]/g, ''), // 清理音调数据
                pos: item[2],
                baseForm: item[3],
                gaikokugo: item[4],
                chinese: item[5],
                audio: item[6],
                kana: kana,
                moraCount: countMora(kana),
            };
        }).filter(item => item.pitch); // 过滤掉没有音调的数据

        // 2. 加载设置和进度
        loadSettings();
        generateSessionWords();
        const savedIndex = loadProgress();
        currentIndex = (savedIndex < sessionWords.length) ? savedIndex : 0;
        
        // 3. 初始加载
        loadWord(currentIndex);

        // 4. 绑定事件监听
        setupEventListeners();
    };

    // --- 事件监听设置 ---
    const setupEventListeners = () => {
        // 视图切换
        dom.startBtn.addEventListener('click', () => {
            dom.mainMenu.classList.remove('active');
            dom.learningModule.classList.add('active');
        });
        
        // 导航
        dom.nextBtn.addEventListener('click', nextWord);
        dom.prevBtn.addEventListener('click', prevWord);
        dom.playAudioBtn.addEventListener('click', () => dom.audioPlayer.play());

        // 抽屉
        const toggleDrawer = (force) => {
            const isActive = dom.drawer.classList.toggle('active', force);
            dom.overlay.classList.toggle('active', isActive);
            if (isActive) populateDrawer();
        };
        dom.drawerBtn.addEventListener('click', () => toggleDrawer(true));
        dom.closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));

        // 设置
        const toggleSettings = (force) => {
            const isActive = dom.settingsModal.classList.toggle('active', force);
            dom.overlay.classList.toggle('active', isActive);
        };
        dom.settingsBtn.addEventListener('click', () => toggleSettings(true));
        dom.closeSettingsBtn.addEventListener('click', () => toggleSettings(false));

        // 遮罩
        dom.overlay.addEventListener('click', () => {
            toggleDrawer(false);
            toggleSettings(false);
        });

        // 设置项变更
        [dom.sortBySelect, dom.orderSelect].forEach(el => {
            el.addEventListener('change', () => {
                settings.sortBy = dom.sortBySelect.value;
                settings.order = dom.orderSelect.value;
                saveSettings();
                generateSessionWords();
                loadWord(0); // 重置到第一个
            });
        });

        const simpleSettingUpdater = (el, key) => {
            const eventType = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(eventType, () => {
                settings[key] = el.type === 'checkbox' ? el.checked : el.value;
                saveSettings();
                // 一些设置需要即时刷新
                if (key === 'showInfo' || key === 'studyMode') {
                    loadWord(currentIndex);
                }
            });
        };
        simpleSettingUpdater(dom.keyShortcutSelect, 'keyShortcut');
        simpleSettingUpdater(dom.showInfoToggle, 'showInfo');
        simpleSettingUpdater(dom.autoplayToggle, 'autoPlay');
        simpleSettingUpdater(dom.studyModeToggle, 'studyMode');

        // 跳转功能
        dom.jumpToBtn.addEventListener('click', () => {
            const targetIndex = parseInt(dom.jumpToInput.value, 10) - 1;
            if (targetIndex >= 0 && targetIndex < sessionWords.length) {
                loadWord(targetIndex);
                toggleSettings(false);
            }
        });

        // 单词列表点击跳转
        dom.wordList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const index = parseInt(e.target.dataset.index, 10);
                loadWord(index);
                toggleDrawer(false);
            }
        });

        // 键盘快捷键
        window.addEventListener('keydown', (e) => {
            if (dom.learningModule.classList.contains('active')) {
                // 防止在输入框中触发
                if (document.activeElement.tagName === 'INPUT') return;

                if (e.key === 'Enter') {
                    e.preventDefault();
                    nextWord();
                } else if (e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    dom.audioPlayer.play();
                } else {
                    const keyMap = keyMaps[settings.keyShortcut];
                    const keyIndex = keyMap.indexOf(e.key.toLowerCase());
                    if (keyIndex !== -1) {
                        const optionBtns = dom.pitchOptions.querySelectorAll('.pitch-option-btn');
                        if (optionBtns[keyIndex] && !optionBtns[keyIndex].disabled) {
                            optionBtns[keyIndex].click();
                        }
                    }
                }
            }
        });
    };
    
    // 填充抽屉内容
    const populateDrawer = () => {
        dom.wordList.innerHTML = '';
        sessionWords.forEach((word, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${word.japanese} ${word.chinese}`;
            li.dataset.index = index;
            if (index === currentIndex) {
                li.classList.add('active');
            }
            dom.wordList.appendChild(li);
        });
        // 滚动到当前项
        const activeLi = dom.wordList.querySelector('.active');
        if (activeLi) {
            activeLi.scrollIntoView({ block: 'center' });
        }
    };
    

    // --- 启动应用 ---
    initialize();

});