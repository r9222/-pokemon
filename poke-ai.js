// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// 設定の復元
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';
let isSpeedMode = localStorage.getItem('tama_speed_mode') === 'true'; 
let currentAudio = null;

const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

document.addEventListener('DOMContentLoaded', () => {
    updateTTSButton();
    updateModeButton();
});

// ▼▼▼ モード切替（AI会話 ⇔ 爆速DB） ▼▼▼
function toggleMode() {
    isSpeedMode = !isSpeedMode;
    localStorage.setItem('tama_speed_mode', isSpeedMode);
    updateModeButton();
}

function updateModeButton() {
    const btn = document.getElementById('mode-toggle');
    const lbl = document.getElementById('mode-label');
    if (isSpeedMode) {
        btn.innerText = "⚡";
        btn.classList.add('speed-on'); 
        lbl.innerText = "爆速モード";
    } else {
        btn.innerText = "💬";
        btn.classList.remove('speed-on');
        lbl.innerText = "会話モード";
    }
}

// ▼▼▼ 賢いステータス表ジェネレーター（Pro版） ▼▼▼
function createDataTable(infoText) {
    // 空白行を除去して配列化
    const lines = infoText.split('\n').map(l => l.trim()).filter(l => l !== "");
    let html = '<table class="poke-table"><tbody>';
    
    for (let i = 0; i < lines.length; i++) {
        // コロンや「：」が含まれている場合は、そこで分割して左右のセルにする
        if (lines[i].includes(':') || lines[i].includes('：')) {
            let parts = lines[i].split(/[:：]/);
            html += `<tr><th>${parts[0].trim()}</th><td>${parts.slice(1).join(':').trim()}</td></tr>`;
        } 
        // 次の行が存在し、かつ次の行にコロンが含まれていない場合は「見出し」と「値」のペアと判定
        else if (i + 1 < lines.length && !lines[i+1].includes(':') && !lines[i+1].includes('：')) {
            html += `<tr><th>${lines[i]}</th><td>${lines[i+1]}</td></tr>`;
            i++; // 次の行は消費したのでスキップ
        } 
        // どちらにも当てはまらない場合は、1行ぶち抜きで表示
        else {
            html += `<tr><td colspan="2" style="background:#eee; text-align:center; font-weight:bold;">${lines[i]}</td></tr>`;
        }
    }
    html += '</tbody></table>';
    return html;
}

// ▼▼▼ URL自動リンク化 ▼▼▼
function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<br><a href="$1" target="_blank" class="search-link">🔗 詳しく見る（外部サイト）</a>');
}

// ▼▼▼ 読み上げ機能 ▼▼▼
async function speakText(text) {
    if (!isTTSEnabled) return;
    if (currentAudio) currentAudio.pause();
    
    // URLやMarkdown記号は読まないように掃除
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, "。参考サイトを確認してたま！");
    cleanText = cleanText.replace(/[*#_`]/g, ""); 

    // VOICEVOX 青山龍星 (speaker=13)
    const apiUrl = `https://api.tts.quest/v3/voicevox/synthesis?speaker=13&text=${encodeURIComponent(cleanText)}`;
    try {
        currentAudio = new Audio(apiUrl);
        currentAudio.play();
    } catch (e) { console.error("TTSエラー:", e); }
}

function toggleTTS() {
    isTTSEnabled = !isTTSEnabled;
    localStorage.setItem('tama_tts_enabled', isTTSEnabled);
    if (!isTTSEnabled && currentAudio) currentAudio.pause();
    updateTTSButton();
}

function updateTTSButton() {
    const btn = document.getElementById('tts-toggle');
    if (isTTSEnabled) {
        btn.innerText = "🔊";
        btn.classList.remove('tts-off');
    } else {
        btn.innerText = "🔇";
        btn.classList.add('tts-off');
    }
}

// ▼▼▼ 音声入力制御 ▼▼▼
function initMic() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("音声入力非対応のブラウザだたま！"); return;
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

// ▼▼▼ メインAI通信・データ処理ロジック ▼▼▼
async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const userText = inputEl.value.trim();
    if (!userText) return;

    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += `<div class="msg user"><div class="text">${userText}</div></div>`;
    inputEl.value = '';
    
    // DBから直接一致するポケモンを探す
    const directMatches = POKE_DB.filter(p => userText.includes(p.name));
    
    // ⚡ 【爆速モード】の処理 ⚡
    // DBにデータがあれば、AIを通さず0秒で表（テーブル）を出力する！
    if (isSpeedMode && directMatches.length > 0) {
        seReceive.play().catch(e => {});
        directMatches.forEach(p => {
            chatBox.innerHTML += `
                <div class="msg bot">
                    <img src="tamachan.png" class="avatar">
                    <div class="text" style="width: 100%; max-width: 100%;">
                        <b>${p.name}のデータだたま！</b>
                        ${createDataTable(p.info)}
                    </div>
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return; // ここで処理を終了（AIには通信しない）
    }

    // 💬 【会話モード】 または DBに一致しない場合の処理 💬
    const loadingId = "L-" + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg bot"><img src="tamachan.png" class="avatar"><div class="text">解析中だたま...🔍</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    // カンペの準備
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
        
        // テキスト内にURLがあれば、きれいなリンクボタンに変換
        const linkedReply = linkify(reply);
        
        chatBox.innerHTML += `
            <div class="msg bot">
                <img src="tamachan.png" class="avatar">
                <div class="text">${linkedReply}</div>
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // 会話モードの時だけ読み上げを実行
        if (isTTSEnabled) {
            seReceive.play().catch(e => {});
            speakText(reply);
        }
    } catch (e) {
        document.getElementById(loadingId).innerText = "通信エラーだたま！";
    }
}
