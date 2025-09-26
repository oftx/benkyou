document.addEventListener('DOMContentLoaded', () => {

    // --- DOM 元素获取 ---
    const mainMenu = document.getElementById('main-menu');
    const learningModule = document.getElementById('learning-module');
    const startBtn = document.getElementById('start-learning-btn');

    const wordDisplayContainer = document.getElementById('word-display-container');
    const wordInfoContainer = document.getElementById('word-info-container');
    const playAudioBtn = document.getElementById('play-audio-btn');
    const pitchHint = document.getElementById('pitch-hint');
    const pitchOptionsContainer = document.getElementById('pitch-options-container');
    const prevWordBtn = document.getElementById('prev-word-btn');
    const nextWordBtn = document.getElementById('next-word-btn');
    const audioPlayer = document.getElementById('audio-player');

    const settingsBtn = document.getElementById('settings-btn');
    const wordListBtn = document.getElementById('word-list-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const wordListPanel = document.getElementById('word-list-panel');
    const closePanelBtns = document.querySelectorAll('.close-panel-btn');

    // --- 设置项 ---
    const sortTypeSelect = document.getElementById('sort-type');
    const sortOrderSelect = document.getElementById('sort-order');
    const keyShortcutSelect = document.getElementById('key-shortcut');
    const showInfoToggle = document.getElementById('show-info-toggle');
    const autoplayToggle = document.getElementById('autoplay-toggle');
    const learningModeToggle = document.getElementById('learning-mode-toggle');
    const jumpToWordInput = document.getElementById('jump-to-word');
    const jumpBtn = document.getElementById('jump-btn');
    const wordListContent = document.getElementById('word-list-content');

    // --- 状态变量 ---
    let learnableWords = [];
    let sessionWords = [];
    let currentWordIndex = 0;
    let userSettings = {};

    const defaultSettings = {
        sortType: 'default',
        sortOrder: 'asc',
        keyShortcut: 'qwerty',
        showInfo: true,
        autoplay: true,
        learningMode: false,
        lastWordIndex: 0,
    };
    
    const keyMappings = {
        qwerty: 'qwertyuiop'.split(''),
        alphabet: 'abcdefghij'.split(''),
        numeric: '1234567890'.split(''),
    };

    // --- 初始化 ---
    function init() {
        if (!processData()) return; // 如果数据处理失败，则停止初始化
        loadSettings();
        updateSessionWords();
        renderWord(currentWordIndex);
        bindEvents();
    }

    // --- 数据处理 ---
    function processData() {
        // 【错误修复】: 增加一个检查，确保 `data` 变量已从 data.js 加载
        if (typeof data === 'undefined' || !Array.isArray(data)) {
            console.error("错误: 'data' 变量未加载或不是一个数组。请确保 data.js 在 app.js 之前被正确加载。");
            alert("错误：单词数据未能成功加载。请检查您的 data.js 文件是否与 index.html 在同一目录下，然后刷新页面。");
            return false; // 返回 false 表示处理失败
        }

        const smallKana = 'ゃゅょっぁぃぅぇぉ';
        // 使用 `data` 而不是 `window.data`
        learnableWords = data
            .map((item, index) => ({
                originalIndex: index,
                japanese: item[0],
                pitch: item[1],
                wordType: item[2],
                baseForm: item[3],
                foreign: item[4],
                chinese: item[5],
                audio: item[6],
            }))
            .filter(word => word.pitch && word.pitch.trim() !== "") // 排除无音调数据
            .map(word => {
                const kana = getKana(word.japanese);
                let moraCount = 0;
                // 修正拗音/促音的计算逻辑
                for (let i = 0; i < kana.length; i++) {
                    if (i + 1 < kana.length && smallKana.includes(kana[i+1])) {
                        // 当前假名和下一个小假名一起算一个音拍
                        moraCount++;
                        i++; 
                    } else if(kana[i] === 'ー') {
                        // 长音算一拍
                        moraCount++;
                    } else if(!smallKana.includes(kana[i])) {
                        // 正常假名算一拍
                         moraCount++;
                    }
                }
                word.kana = kana;
                word.moraCount = moraCount > 10 ? 10 : moraCount; // 将拍数限制在10以内
                return word;
            });
        return true; // 返回 true 表示处理成功
    }
    
    function getKana(japaneseStr) {
        const matches = japaneseStr.match(/\[(.*?)\]/g);
        if (!matches) return japaneseStr;
        return matches.map(m => m.slice(1, -1)).join('');
    }

    // --- 设置管理 ---
    function loadSettings() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('jpPitchSettings'));
            userSettings = { ...defaultSettings, ...savedSettings };
        } catch (e) {
            userSettings = defaultSettings;
        }
        
        sortTypeSelect.value = userSettings.sortType;
        sortOrderSelect.value = userSettings.sortOrder;
        keyShortcutSelect.value = userSettings.keyShortcut;
        showInfoToggle.checked = userSettings.showInfo;
        autoplayToggle.checked = userSettings.autoplay;
        learningModeToggle.checked = userSettings.learningMode;
        
        const lastIndex = userSettings.lastWordIndex || 0;
        currentWordIndex = lastIndex < sessionWords.length ? lastIndex : 0;
    }

    function saveSettings() {
        userSettings.lastWordIndex = currentWordIndex;
        localStorage.setItem('jpPitchSettings', JSON.stringify(userSettings));
    }

    function applySettingsChange() {
        updateSessionWords();
        currentWordIndex = 0; // 排序改变后从头开始
        renderWord(currentWordIndex);
        populateWordList();
        saveSettings();
    }
    
    // --- 会话单词列表管理 ---
    function updateSessionWords() {
        let words = [...learnableWords];

        // 排序
        if (userSettings.sortType === 'length') {
            words.sort((a, b) => a.moraCount - b.moraCount);
        } else { // default
            words.sort((a, b) => a.originalIndex - b.originalIndex);
        }

        // 顺序
        if (userSettings.sortOrder === 'desc') {
            words.reverse();
        } else if (userSettings.sortOrder === 'random') {
            for (let i = words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [words[i], words[j]] = [words[j], words[i]];
            }
        }
        
        sessionWords = words;
        jumpToWordInput.max = sessionWords.length;
    }

    // --- 渲染逻辑 ---
    function renderWord(index) {
        if (index < 0 || index >= sessionWords.length) return;
        
        currentWordIndex = index;
        const word = sessionWords[index];

        const rubyHTML = word.japanese
            .replace(/([\u4e00-\u9faf々]+)\[(.*?)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
            .replace(/([ぁ-んァ-ヶー]+)\[(.*?)\]/g, '<ruby>$1<rt>$2</rt></ruby>'); // 支持假名也带读音
        wordDisplayContainer.innerHTML = rubyHTML;

        wordInfoContainer.style.display = userSettings.showInfo ? 'block' : 'none';
        if (userSettings.showInfo) {
            let info = '';
            if (word.wordType) info += `<p>词性: ${word.wordType}</p>`;
            if (word.baseForm) info += `<p>基本形: ${word.baseForm}</p>`;
            if (word.foreign) info += `<p>外来语: ${word.foreign}</p>`;
            if (word.chinese) {
                // 正确处理带HTML标签的中文释义
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = word.chinese;
                const chineseText = tempDiv.textContent || tempDiv.innerText || "";
                info += `<p>中文: ${chineseText}</p>`;
            }
            wordInfoContainer.innerHTML = info;
        }

        pitchOptionsContainer.innerHTML = '';
        const numOptions = word.moraCount + 1;
        const keys = keyMappings[userSettings.keyShortcut];
        for (let i = 0; i < numOptions; i++) {
            const optionWrapper = document.createElement('div');
            optionWrapper.className = 'pitch-option';
            
            const btn = document.createElement('button');
            btn.textContent = `⓪①②③④⑤⑥⑦⑧⑨⑩`[i];
            btn.dataset.pitch = i;

            const shortcutHint = document.createElement('span');
            shortcutHint.className = 'shortcut-hint';
            shortcutHint.textContent = keys[i] || '';

            optionWrapper.appendChild(btn);
            optionWrapper.appendChild(shortcutHint);
            pitchOptionsContainer.appendChild(optionWrapper);
        }
        
        pitchHint.textContent = '';
        
        if (userSettings.autoplay && !settingsPanel.classList.contains('is-open') && !wordListPanel.classList.contains('is-open')) {
            playAudio();
        }
        
        if (userSettings.learningMode) {
            revealAnswer();
        }
        
        saveSettings();
    }
    
    function playAudio() {
        const word = sessionWords[currentWordIndex];
        if (word && word.audio) {
            audioPlayer.src = `audios/${word.audio}`;
            audioPlayer.play().catch(e => console.error("音频播放失败:", e));
        }
    }
    
    function revealAnswer() {
        const word = sessionWords[currentWordIndex];
        const correctPitches = word.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        
        const buttons = pitchOptionsContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            const pitchValue = parseInt(btn.dataset.pitch, 10);
            if (correctPitches.includes(pitchValue)) {
                btn.classList.add('correct');
            }
            btn.disabled = true;
        });
    }

    // --- 交互逻辑 ---
    function handleOptionSelection(selectedPitchStr) {
        const selectedPitch = parseInt(selectedPitchStr, 10);
        const word = sessionWords[currentWordIndex];
        const correctPitches = word.pitch.split('').map(p => '⓪①②③④⑤⑥⑦⑧⑨⑩'.indexOf(p));
        const N = word.moraCount;

        const isCorrect = correctPitches.includes(selectedPitch);
        const isAmbiguousCase = (correctPitches.includes(0) && selectedPitch === N) || (correctPitches.includes(N) && selectedPitch === 0);
        
        const targetButton = pitchOptionsContainer.querySelector(`button[data-pitch="${selectedPitch}"]`);
        if (!targetButton) return;

        if (isCorrect) {
            targetButton.classList.add('correct');
            if (correctPitches.length > 1) {
                const otherCorrect = correctPitches.find(p => p !== selectedPitch);
                if(otherCorrect !== undefined) {
                   pitchHint.textContent = `提示：${'⓪①②③④⑤⑥⑦⑧⑨⑩'[otherCorrect]} 也是正确的读音。`;
                }
            }
        } else if (isAmbiguousCase) {
            targetButton.classList.add('ambiguous');
            pitchHint.innerHTML = `听觉正确！但 <b>⓪调(平板型)</b> 与 <b>${'⓪①②③④⑤⑥⑦⑧⑨⑩'[N]}调(尾高型)</b> 的区别在于其后接助词时音调是否下降。`;
        } else {
            targetButton.classList.add('incorrect');
        }

        correctPitches.forEach(p => {
            const correctBtn = pitchOptionsContainer.querySelector(`button[data-pitch="${p}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
        });

        pitchOptionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
    }
    
    function nextWord() {
        if (currentWordIndex < sessionWords.length - 1) {
            renderWord(currentWordIndex + 1);
        }
    }
    
    function prevWord() {
        if (currentWordIndex > 0) {
            renderWord(currentWordIndex - 1);
        }
    }
    
    function populateWordList() {
        const list = document.createElement('ul');
        sessionWords.forEach((word, index) => {
            const item = document.createElement('li');
            const japaneseText = word.japanese.replace(/\[.*?\]/g, '');
            const chineseText = (word.chinese.includes('<') ? '...' : word.chinese).split('（')[0]; // 简化中文显示
            item.textContent = `${index + 1}. ${japaneseText} ${chineseText}`;
            item.dataset.index = index;
            if(index === currentWordIndex) {
                item.classList.add('current');
            }
            list.appendChild(item);
        });
        wordListContent.innerHTML = '';
        wordListContent.appendChild(list);
    }

    // --- 事件绑定 ---
    function bindEvents() {
        startBtn.addEventListener('click', () => {
            mainMenu.classList.remove('active');
            learningModule.classList.add('active');
            // 第一次进入时，如果设置了自动播放，则播放音频
            if (userSettings.autoplay) playAudio();
        });

        playAudioBtn.addEventListener('click', playAudio);
        nextWordBtn.addEventListener('click', nextWord);
        prevWordBtn.addEventListener('click', prevWord);
        
        pitchOptionsContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
                handleOptionSelection(e.target.dataset.pitch);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!learningModule.classList.contains('active') || settingsPanel.classList.contains('is-open') || wordListPanel.classList.contains('is-open')) return;

            if (e.key === 'Enter') {
                nextWordBtn.click();
            } else if (e.key.toLowerCase() === 'r') {
                playAudioBtn.click();
            } else {
                const keys = keyMappings[userSettings.keyShortcut];
                const keyIndex = keys.indexOf(e.key.toLowerCase());
                if (keyIndex !== -1) {
                    const button = pitchOptionsContainer.querySelector(`button[data-pitch="${keyIndex}"]`);
                    if (button && !button.disabled) {
                        button.click();
                    }
                }
            }
        });
        
        settingsBtn.addEventListener('click', () => settingsPanel.classList.add('is-open'));
        wordListBtn.addEventListener('click', () => {
            populateWordList();
            wordListPanel.classList.add('is-open');
        });
        closePanelBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.currentTarget.closest('.panel').classList.remove('is-open');
        }));
        
        sortTypeSelect.addEventListener('change', (e) => { userSettings.sortType = e.target.value; applySettingsChange(); });
        sortOrderSelect.addEventListener('change', (e) => { userSettings.sortOrder = e.target.value; applySettingsChange(); });
        keyShortcutSelect.addEventListener('change', (e) => { userSettings.keyShortcut = e.target.value; renderWord(currentWordIndex); saveSettings(); });
        showInfoToggle.addEventListener('change', (e) => { userSettings.showInfo = e.target.checked; renderWord(currentWordIndex); saveSettings(); });
        autoplayToggle.addEventListener('change', (e) => { userSettings.autoplay = e.target.checked; saveSettings(); });
        learningModeToggle.addEventListener('change', (e) => { userSettings.learningMode = e.target.checked; renderWord(currentWordIndex); saveSettings(); });

        jumpBtn.addEventListener('click', () => {
            const targetIndex = parseInt(jumpToWordInput.value, 10) - 1;
            if (targetIndex >= 0 && targetIndex < sessionWords.length) {
                renderWord(targetIndex);
                settingsPanel.classList.remove('is-open');
            } else {
                alert(`请输入 1 到 ${sessionWords.length} 之间的有效数字。`);
            }
        });
        
        wordListContent.addEventListener('click', (e) => {
           const listItem = e.target.closest('li');
           if (listItem) {
               const index = parseInt(listItem.dataset.index, 10);
               renderWord(index);
               wordListPanel.classList.remove('is-open');
           }
        });
    }

    // --- 启动应用 ---
    init();
});