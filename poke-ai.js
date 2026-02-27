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

// ▼▼▼ リザードン問題を解決した検索機能 ▼▼▼
function findPokemon(userText) {
    if (typeof POKE_DB === 'undefined') return [];
    
    // 名前の文字数が「長い順」に並び替える（リザードンを先に判定させるため）
    const sortedDB = [...POKE_DB].sort((a, b) => b.name.length - a.name.length);
    let matches = [];
    let searchTarget = userText;

    for (const p of sortedDB) {
        if (searchTarget.includes(p.name)) {
            matches.push(p);
            // 見つけた名前をテキストから消す（リザードンの後にリザードがヒットするのを防ぐ）
            searchTarget = searchTarget.replace(p.name, ""); 
        }
    }
    return matches;
}

// ▼▼▼ 横幅をフル活用する美しいカードレイアウトジェネレーター ▼▼▼
function createBeautifulCard(poke) {
    // 図鑑番号を数値化して公式画像APIから超高画質イラストを取得
    const pokeNum = parseInt(poke.no);
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeNum}.png`;

    const lines = poke.info.split('\n').map(l => l.trim()).filter(l => l !== "");
    
    // CSS Gridを使って横幅を自動で埋めるレスポンシブな表を作る
    let statsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 10px;">';
    let descHtml = '';
    let movesHtml = '';
    let currentSection = 'stats';
    
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        
        // 不要な文字列をスキップ
        if (l === poke.name || l === "No" || l === poke.no || l === "ポケモン図鑑絵" || l === "戻る" || l === "1" || l.includes("All rights reserved")) continue;
        
        if (l === "説明") {
            currentSection = 'desc';
            continue;
        }
        if (l === "種族値") {
            currentSection = 'stats';
            continue;
        }
        if (l.includes("わざ") || l.includes("ひでんマシン")) {
            currentSection = 'moves';
            movesHtml += `<div style="background:#222; color:#fff; padding:6px 10px; margin:15px 0 5px; font-weight:bold; border-radius:4px; width: 100%; box-sizing: border-box;">${l}</div><div style="display:flex; flex-wrap:wrap; gap:4px; padding:4px;">`;
            continue;
        }
        
        // 種族値や基本データのペアリング（バッジ化）
        if (currentSection === 'stats') {
            if (i + 1 < lines.length && lines[i].length <= 15 && lines[i+1].length <= 25 && !lines[i+1].includes("わざ") && lines[i+1] !== "説明") {
                statsHtml += `
                <div style="background:#fff; border: 1px solid #ddd; border-left:4px solid #e74c3c; padding:6px; border-radius:4px; box-shadow:1px 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-size:10px; color:#888; margin-bottom:2px;">${l}</div>
                    <div style="font-size:13px; font-weight:bold; color:#222;">${lines[i+1]}</div>
                </div>`;
                i++;
            } else {
                 statsHtml += `<div style="grid-column: 1 / -1; font-size:13px; padding:4px;">${l}</div>`;
            }
        } 
        // 説明文の装飾
        else if (currentSection === 'desc') {
            if (l !== "ファイアレッド" && l !== "リーフグリーン") {
                 // スペースを詰めて綺麗な文章にする
                 descHtml += `<div style="font-size:13px; margin-bottom:8px; padding:8px 12px; background:#e8f5e9; border-left:4px solid #1976d2; border-radius:4px; color:#0d47a1; line-height:1.5;">${l.replace(/　/g, '')}</div>`;
            }
        } 
        // 技リストをコンパクトなチップ状にまとめる
        else if (currentSection === 'moves') {
             if (l.length > 15) {
                 movesHtml += `<div style="width:100%; font-size:11px; color:#555; padding:2px; margin-top: 4px; border-bottom: 1px dashed #ccc;">${l}</div>`;
             } else {
                 movesHtml += `<span style="display:inline-block; background:#fff; border:1px solid #ccc; padding:4px 8px; font-size:12px; border-radius:12px; box-shadow:1px 1px 0 #ccc;">${l}</span>`;
             }
        }
    }
    if (currentSection === 'moves') movesHtml += '</div>';
    statsHtml += '</div>';
    
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
        <div style="padding:15px; max-height:400px; overflow-y:auto; background:#fafafa; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;">
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
    
    // 改良版の検索機能でポケモンを探す
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
