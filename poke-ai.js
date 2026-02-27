// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// AIモードと読み上げの設定（ローカルストレージから復元、デフォルトはON）
let isAiMode = localStorage.getItem('tama_ai_mode') !== 'false'; 
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';
let currentAudio = null;

const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

// 画面読み込み時にトグルとテキストの状態を合わせる
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ai-checkbox').checked = isAiMode;
    document.getElementById('tts-checkbox').checked = isTTSEnabled;
    updateToggleText();
});

// ▼▼▼ トグルスイッチとテキストの連動 ▼▼▼
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

// ▼▼▼ 横幅100%テーブルジェネレーター ▼▼▼
function createDataTable(infoText) {
    const lines = infoText.split('\n').map(l => l.trim()).filter(l => l !== "");
    let html = '<table class="poke-table"><tbody>';
    
    for (let i = 0; i < lines.length; i++) {
        // コロン（半角・全角）で区切って表にする
        if (lines[i].includes('：') || lines[i].includes(':')) {
            let parts = lines[i].split(/[：:]/);
            html += `<tr><th>${parts[0].trim()}</th><td>${parts.slice(1).join('：').trim()}</td></tr>`;
        } else {
            // 区切りがない場合は見出しとして扱う
            html += `<tr><td colspan="2" style="background:#eee; text-align:center;">${lines[i]}</td></tr>`;
        }
    }
    html += '</tbody></table>';
    return html;
}

// URL自動リンク化
function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<br><a href="$1" target="_blank" class="search-link">🔗 詳しく見る</a>');
}

// 読み上げ（VOICEVOX 青山龍星）
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

// マイク制御
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

// ▼▼▼ メインロジック（画像表示対応版） ▼▼▼
async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const userText = inputEl.value.trim();
    if (!userText) return;

    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += `<div class="msg user"><div class="text">${userText}</div></div>`;
    inputEl.value = '';
    
    const directMatches = POKE_DB.filter(p => userText.includes(p.name));
    
    // ⚡ 【AI：OFF】アバターを完全に消して、画像＋表のカードを表示！ ⚡
    if (!isAiMode && directMatches.length > 0) {
        seReceive.play().catch(e => {});
        directMatches.forEach(p => {
            
            // ▼ 画像がある場合だけ、カードの上部に画像表示エリアを作る
            let imageHtml = "";
            if (p.imageUrl) {
                imageHtml = `
                <div style="background: radial-gradient(circle, #fff 0%, #e0e0e0 100%); text-align: center; padding: 15px; border-bottom: 2px solid #222;">
                    <img src="${p.imageUrl}" style="width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(3px 3px 2px rgba(0,0,0,0.3));">
                </div>`;
            }

            // カード全体を出力
            chatBox.innerHTML += `
                <div class="data-card">
                    <div class="data-card-header">
                        <span>📊 ${p.name} のデータ</span>
                        <span style="font-size: 10px; font-weight: normal;">データベース</span>
                    </div>
                    ${imageHtml}
                    ${createDataTable(p.info)}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
    }

    // 💬 【AI：ON】いつものたまちゃん（吹き出し＋アバター） 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = directMatches.length > 0 ? directMatches.map(p => `【${p.name}】\n${p.info}`).join("\n\n") : lastCheatSheet;
    if (cheatSheet) lastCheatSheet = cheatSheet;

    // poke-tamachan-data.js にある SYSTEM_PROMPT を読み込む
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
