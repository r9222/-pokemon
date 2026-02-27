// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// ローカルストレージから設定を復元 (デフォルトは AI会話(false) / 音声ON(true) )
let isSpeedMode = localStorage.getItem('tama_speed_mode') === 'true'; 
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';
let currentAudio = null;

const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

// 画面読み込み時にトグルスイッチのON/OFFを合わせる
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mode-checkbox').checked = isSpeedMode;
    document.getElementById('tts-checkbox').checked = isTTSEnabled;
});

// ▼▼▼ トグルスイッチの動作 ▼▼▼
function toggleMode() {
    isSpeedMode = document.getElementById('mode-checkbox').checked;
    localStorage.setItem('tama_speed_mode', isSpeedMode);
}

function toggleTTS() {
    isTTSEnabled = document.getElementById('tts-checkbox').checked;
    localStorage.setItem('tama_tts_enabled', isTTSEnabled);
    if (!isTTSEnabled && currentAudio) currentAudio.pause();
}

// ▼▼▼ 表ジェネレーター（アバターなし・全画面カード用） ▼▼▼
function createDataTable(infoText) {
    const lines = infoText.split('\n').map(l => l.trim()).filter(l => l !== "");
    let html = '<table class="poke-table"><tbody>';
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(':') || lines[i].includes('：')) {
            let parts = lines[i].split(/[:：]/);
            html += `<tr><th>${parts[0].trim()}</th><td>${parts.slice(1).join(':').trim()}</td></tr>`;
        } else if (i + 1 < lines.length && !lines[i+1].includes(':') && !lines[i+1].includes('：')) {
            html += `<tr><th>${lines[i]}</th><td>${lines[i+1]}</td></tr>`;
            i++; 
        } else {
            html += `<tr><td colspan="2" style="background:#e0e0e0; font-weight:bold; text-align:center;">${lines[i]}</td></tr>`;
        }
    }
    html += '</tbody></table>';
    return html;
}

// URL自動リンク化
function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<br><a href="$1" target="_blank" class="search-link">🔗 詳しく見る（外部サイト）</a>');
}

// 読み上げ
async function speakText(text) {
    if (!isTTSEnabled) return;
    if (currentAudio) currentAudio.pause();
    
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, "。参考サイトを確認してたま！");
    cleanText = cleanText.replace(/[*#_`]/g, ""); 

    const apiUrl = `https://api.tts.quest/v3/voicevox/synthesis?speaker=13&text=${encodeURIComponent(cleanText)}`;
    try {
        currentAudio = new Audio(apiUrl);
        currentAudio.play();
    } catch (e) { console.error("TTSエラー:", e); }
}

// マイク制御
function initMic() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("音声入力非対応だたま！"); return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.onstart = () => {
        isRecording = true;
        if (currentAudio) currentAudio.pause();
        seStart.play().catch(e => {});
        document.getElementById('mic-btn').classList.add('active');
        document.getElementById('mic-status').innerText = "聞き取り中...";
        document.getElementById('mic-status').style.color = "#ff3030";
    };
    recognition.onresult = (e) => {
        document.getElementById('chat-input').value = e.results[0][0].transcript;
        askPokemonAI();
    };
    recognition.onend = () => stopMic();
    recognition.start();
}

function toggleMic() { if (isRecording) recognition.stop(); else initMic(); }
function stopMic() { 
    isRecording = false; 
    document.getElementById('mic-btn').classList.remove('active'); 
    const status = document.getElementById('mic-status');
    status.innerText = "タップして話す";
    status.style.color = "#555";
}

// ▼▼▼ メインロジック ▼▼▼
async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const userText = inputEl.value.trim();
    if (!userText) return;

    const chatBox = document.getElementById('chat-messages');
    
    // ユーザーの吹き出し
    chatBox.innerHTML += `<div class="msg user"><div class="text">${userText}</div></div>`;
    inputEl.value = '';
    
    const directMatches = POKE_DB.filter(p => userText.includes(p.name));
    
    // ⚡ 【爆速モード (DB)】アバターを消して、画面幅いっぱいのカードをドン！ ⚡
    if (isSpeedMode && directMatches.length > 0) {
        seReceive.play().catch(e => {});
        directMatches.forEach(p => {
            chatBox.innerHTML += `
                <div class="data-card">
                    <div class="data-card-header">
                        <span>📊 ${p.name} のデータ</span>
                        <span style="font-size: 11px; color:#aaa;">DB直接抽出</span>
                    </div>
                    ${createDataTable(p.info)}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
    }

    // 💬 【会話モード (AI)】いつものたまちゃん 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = directMatches.length > 0 ? directMatches.map(p => `【${p.name}】\n${p.info}`).join("\n\n") : lastCheatSheet;
    if (cheatSheet) lastCheatSheet = cheatSheet;

    const fullPrompt = `${SYSTEM_PROMPT}\n\n=== カンペ ===\n${cheatSheet || "なし"}\n\n=== 質問 ===\n${userText}`;

    try {
        const res = await fetch(gasUrl, {
            method: "POST",
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });
        const data = await res.json();
        let reply = data.candidates[0].content.parts[0].text;
        
        document.getElementById(loadingId).remove();
        
        const linkedReply = linkify(reply);
        
        chatBox.innerHTML += `
            <div class="msg bot">
                <img src="tamachan.png" class="avatar">
                <div class="text">${linkedReply}</div>
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
