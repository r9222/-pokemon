// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// 設定の復元
let isAiMode = localStorage.getItem('tama_ai_mode') !== 'false'; 
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';
let currentAudio = null;

const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ai-checkbox').checked = isAiMode;
    document.getElementById('tts-checkbox').checked = isTTSEnabled;
    updateToggleText();
});

function toggleMode() {
    isAiMode = document.getElementById('ai-checkbox').checked;
    localStorage.setItem('tama_ai_mode', isAiMode);
    updateToggleText();
}

function toggleTTS() {
    isTTSEnabled = document.getElementById('tts-checkbox').checked;
    localStorage.setItem('tama_tts_enabled', isTTSEnabled);
    if (!isTTSEnabled && currentAudio) currentAudio.pause();
    updateToggleText();
}

function updateToggleText() {
    const aiText = document.getElementById('ai-status-text');
    const ttsText = document.getElementById('tts-status-text');
    aiText.innerText = isAiMode ? "AI：ON" : "AI：OFF";
    aiText.style.background = isAiMode ? "#e8f5e9" : "#fff"; 
    ttsText.innerText = isTTSEnabled ? "読上：ON" : "読上：OFF";
    ttsText.style.background = isTTSEnabled ? "#e8f5e9" : "#fff";
}

// 検索機能
function findPokemon(userText) {
    if (typeof POKE_DB === 'undefined') return [];
    const sortedDB = [...POKE_DB].sort((a, b) => b.name.length - a.name.length);
    let matches = [];
    let searchTarget = userText;
    for (const p of sortedDB) {
        if (searchTarget.includes(p.name)) {
            matches.push(p);
            searchTarget = searchTarget.replace(p.name, ""); 
        }
    }
    return matches;
}

// ▼▼▼ 技データを束ねて「カード化」する神ジェネレーター ▼▼▼
function createBeautifulCard(poke) {
    const pokeNum = parseInt(poke.no);
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;

    const lines = poke.info.split('\n').map(l => l.trim()).filter(l => l !== "");
    
    let statsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 10px;">';
    let descHtml = '';
    let movesHtml = '';
    
    let currentSection = 'basic';
    let moveBuffer = [];
    let movesCols = 0;
    let isHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        
        // ゴミテキストをスキップ
        if (l === poke.name || l === "No" || l === poke.no || l === "ポケモン図鑑絵" || l === "戻る" || l === "1" || l.includes("All rights reserved") || l.includes("Present by")) continue;
        
        if (l === "説明") { currentSection = 'desc'; continue; }
        if (l === "種族値") { currentSection = 'stats'; continue; }
        
        // ▼ 技セクションの判定（データ数によって7個か6個か切り替える）
        if (l === "レベルアップで覚えるわざ" || l === "覚えるわざマシン・ひでんマシン" || l.includes("おぼえられるわざマシン・ひでんマシンはありません")) {
            if (l.includes("ありません")) {
                movesHtml += `<div style="font-size:12px; color:#888; padding:8px; text-align:center;">${l}</div>`;
                continue;
            }
            currentSection = 'moves';
            movesCols = 7;
            isHeader = true;
            moveBuffer = [];
            movesHtml += `<div style="background:#dd0b2d; color:#fff; padding:6px 10px; margin:20px 0 10px; font-weight:bold; border-radius:4px; font-size:14px; box-shadow: 1px 1px 2px rgba(0,0,0,0.3); text-align:center;">${l}</div>`;
            continue;
        }
        if (l === "タマゴわざ" || l === "教えてもらえるわざ") {
            currentSection = 'moves';
            movesCols = 6;
            isHeader = true;
            moveBuffer = [];
            movesHtml += `<div style="background:#222; color:#fff; padding:6px 10px; margin:20px 0 10px; font-weight:bold; border-radius:4px; font-size:14px; box-shadow: 1px 1px 2px rgba(0,0,0,0.3); text-align:center;">${l}</div>`;
            continue;
        }

        // ▼ 種族値や基本データのバッジ化
        if (currentSection === 'stats' || currentSection === 'basic') {
            if (i + 1 < lines.length && lines[i].length <= 15 && lines[i+1].length <= 30 && !lines[i+1].includes("わざ") && lines[i+1] !== "説明" && lines[i+1] !== "種族値") {
                statsHtml += `
                <div style="background:#fff; border: 1px solid #ddd; border-left:4px solid #e74c3c; padding:6px; border-radius:4px; box-shadow:1px 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-size:10px; color:#888; margin-bottom:2px;">${l}</div>
                    <div style="font-size:13px; font-weight:bold; color:#222;">${lines[i+1]}</div>
                </div>`;
                i++;
            } else {
                 statsHtml += `<div style="grid-column: 1 / -1; font-size:13px; padding:4px; border-bottom:1px dashed #ccc;">${l}</div>`;
            }
        } 
        // ▼ 説明文の装飾
        else if (currentSection === 'desc') {
            if (l !== "ファイアレッド" && l !== "リーフグリーン" && l !== "説明") {
                 descHtml += `<div style="font-size:13px; margin-bottom:8px; padding:8px 12px; background:#e8f5e9; border-left:4px solid #1976d2; border-radius:4px; color:#0d47a1; line-height:1.5;">${l.replace(/　/g, '')}</div>`;
            }
        } 
        // ▼ 技リストを「カード」に束ねる超技術
        else if (currentSection === 'moves') {
            moveBuffer.push(l);
            // 指定した数（7個 or 6個）データが溜まったら、1つのカードにする！
            if (moveBuffer.length === movesCols) {
                if (isHeader) {
                    isHeader = false; // ヘッダー行（レベル, わざ名...）はスキップ
                    moveBuffer = [];
                } else {
                    if (movesCols === 7) {
                        let cond = moveBuffer[0] === "-" ? "基本" : moveBuffer[0];
                        movesHtml += `
                        <div style="background:#fff; border:1px solid #ddd; border-left:5px solid #3498db; border-radius:6px; padding:8px; margin-bottom:8px; box-shadow:1px 1px 3px rgba(0,0,0,0.1);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span style="font-weight:bold; font-size:15px; color:#222;">${moveBuffer[1]}</span>
                                <span style="font-size:11px; background:#eee; color:#555; padding:2px 8px; border-radius:10px; font-weight:bold;">${cond}</span>
                            </div>
                            <div style="display:flex; gap:6px; font-size:11px; color:#666; margin-bottom:6px; align-items:center;">
                                <span style="background:#f1c40f; color:#222; padding:2px 6px; border-radius:4px; font-weight:bold;">${moveBuffer[2]}</span>
                                <span>威力: <b style="color:#e74c3c;">${moveBuffer[3]}</b></span>
                                <span>命中: <b>${moveBuffer[4]}</b></span>
                                <span>PP: <b>${moveBuffer[5]}</b></span>
                            </div>
                            <div style="font-size:12px; color:#444; line-height:1.4;">${moveBuffer[6]}</div>
                        </div>`;
                    } else if (movesCols === 6) {
                        movesHtml += `
                        <div style="background:#fff; border:1px solid #ddd; border-left:5px solid #9b59b6; border-radius:6px; padding:8px; margin-bottom:8px; box-shadow:1px 1px 3px rgba(0,0,0,0.1);">
                            <div style="font-weight:bold; font-size:15px; margin-bottom:6px; color:#222;">${moveBuffer[0]}</div>
                            <div style="display:flex; gap:6px; font-size:11px; color:#666; margin-bottom:6px; align-items:center;">
                                <span style="background:#f1c40f; color:#222; padding:2px 6px; border-radius:4px; font-weight:bold;">${moveBuffer[1]}</span>
                                <span>威力: <b style="color:#e74c3c;">${moveBuffer[2]}</b></span>
                                <span>命中: <b>${moveBuffer[3]}</b></span>
                                <span>PP: <b>${moveBuffer[4]}</b></span>
                            </div>
                            <div style="font-size:12px; color:#444; line-height:1.4;">${moveBuffer[5]}</div>
                        </div>`;
                    }
                    moveBuffer = []; // 次の技のためにリセット
                }
            }
        }
    }
    statsHtml += '</div>';
    
    // 全体を合体させて出力
    return `
    <div class="data-card" style="display:flex; flex-direction:column; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);">
        <div class="data-card-header" style="display:flex; justify-content:space-between; background: #222; color: #fff; padding: 10px;">
            <span>No.${poke.no} ${poke.name}</span>
            <span style="font-size:10px; opacity: 0.8;">DB抽出完了</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; padding:15px; background:radial-gradient(circle, #fff 0%, #f0f0f0 100%); gap:15px; border-bottom:2px solid #222;">
            <div style="flex: 0 0 120px; display:flex; justify-content:center; align-items:center;">
                <img src="${imgUrl}" style="width:120px; height:120px; object-fit:contain; filter:drop-shadow(2px 4px 4px rgba(0,0,0,0.3));">
            </div>
            <div style="flex: 1; min-width:180px; align-self: center;">
                ${descHtml}
            </div>
        </div>
        <div style="padding:15px; max-height:450px; overflow-y:auto; background:#fafafa; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;">
            ${statsHtml}
            ${movesHtml}
        </div>
    </div>`;
}

function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<br><a href="$1" target="_blank" class="search-link">🔗 詳しく見る</a>');
}

async function speakText(text) {
    if (!isTTSEnabled) return;
    if (currentAudio) currentAudio.pause();
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, "。参考サイトを確認してたま！").replace(/[*#_`]/g, ""); 
    const apiUrl = `https://api.tts.quest/v3/voicevox/synthesis?speaker=13&text=${encodeURIComponent(cleanText)}`;
    try {
        currentAudio = new Audio(apiUrl);
        currentAudio.play();
    } catch (e) { console.error("TTSエラー:", e); }
}

function initMic() {
    if (!('webkitSpeechRecognition' in window)) { alert("音声入力非対応だたま！"); return; }
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.onstart = () => {
        isRecording = true;
        if (currentAudio) currentAudio.pause();
        seStart.play().catch(e => {});
        document.getElementById('mic-btn').classList.add('active');
        document.getElementById('mic-status').innerText = "聞き取り中...";
    };
    recognition.onresult = (e) => {
        document.getElementById('chat-input').value = e.results[0][0].transcript;
        askPokemonAI();
    };
    recognition.onend = () => stopMic();
    recognition.start();
}
function toggleMic() { if (isRecording) recognition.stop(); else initMic(); }
function stopMic() { isRecording = false; document.getElementById('mic-btn').classList.remove('active'); document.getElementById('mic-status').innerText = "タップして話す"; }

// ▼▼▼ メインロジック ▼▼▼
async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const userText = inputEl.value.trim();
    if (!userText) return;

    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += `<div class="msg user"><div class="text">${userText}</div></div>`;
    inputEl.value = '';
    
    const directMatches = findPokemon(userText);
    
    // ⚡ 【AI：OFF】アバターを完全に消して、美しいカードを表示！ ⚡
    if (!isAiMode && directMatches.length > 0) {
        seReceive.play().catch(e => {});
        directMatches.forEach(p => {
            chatBox.innerHTML += createBeautifulCard(p);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
    }

    // 💬 【AI：ON】いつものたまちゃん 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = directMatches.length > 0 ? directMatches.map(p => `【${p.name}】\n${p.info}`).join("\n\n") : lastCheatSheet;
    if (cheatSheet) lastCheatSheet = cheatSheet;

    const fullPrompt = `${typeof SYSTEM_PROMPT !== 'undefined' ? SYSTEM_PROMPT : ''}\n\n=== カンペ ===\n${cheatSheet || "なし"}\n\n=== 質問 ===\n${userText}`;

    try {
        const res = await fetch(gasUrl, { method: "POST", body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) });
        const data = await res.json();
        let reply = data.candidates[0].content.parts[0].text;
        
        document.getElementById(loadingId).remove();
        
        chatBox.innerHTML += `
            <div class="msg bot">
                <img src="tamachan.png" class="avatar">
                <div class="text">${linkify(reply)}</div>
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (isTTSEnabled) {
            seReceive.play().catch(e => {});
            speakText(reply);
        }
    } catch (e) {
        document.getElementById(loadingId).innerText = "通信エラーだたま！";
    }
}
