// poke-ai.js
const gasUrl = "https://script.google.com/macros/s/AKfycbwBmtIRAwPZMoI2TPNd5si6kJaNltdZNypwlL9YKMmw1KKn4Yn7Loi2pkwfc6PoKjV20A/exec";

let pokeChatHistory = [];
let lastCheatSheet = "";
let recognition;
let isRecording = false;

// 効果音のセットアップ
const seStart = new Audio('start.mp3');
const seReceive = new Audio('receive.mp3');

// ▼▼ 音声（TTS）のON/OFF状態をローカルストレージから取得（デフォルトはON） ▼▼
let isTTSEnabled = localStorage.getItem('tama_tts_enabled') !== 'false';

// 画面読み込み時にボタンの見た目を更新
document.addEventListener('DOMContentLoaded', updateTTSUI);

// トグルボタンの処理
function toggleTTS() {
    isTTSEnabled = !isTTSEnabled;
    localStorage.setItem('tama_tts_enabled', isTTSEnabled); // 設定を保存
    updateTTSUI();
    
    // OFFにした瞬間、喋っていたら強制ストップ
    if (!isTTSEnabled) {
        window.speechSynthesis.cancel();
    }
}

// UIの書き換え
function updateTTSUI() {
    const btn = document.getElementById('tts-toggle-btn');
    if (!btn) return;
    if (isTTSEnabled) {
        btn.innerHTML = "🔊 読上ON";
        btn.classList.remove('off');
    } else {
        btn.innerHTML = "🔇 読上OFF";
        btn.classList.add('off');
    }
}

// 読み上げ機能（ONの時だけ動く）
function speakText(text) {
    if (!isTTSEnabled) return; // OFFならここでストップ
    
    window.speechSynthesis.cancel(); 
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = 'ja-JP';
    uttr.rate = 1.0; 
    uttr.pitch = 0.6; 
    
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => v.lang === 'ja-JP' && (v.name.includes('Otoya') || v.name.includes('Keita') || v.name.includes('Male')));
    if (maleVoice) uttr.voice = maleVoice;

    window.speechSynthesis.speak(uttr);
}

function unlockAudio() {
    seStart.load();
    seReceive.load();
    const dummyUttr = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(dummyUttr);
    document.removeEventListener('click', unlockAudio);
}
document.addEventListener('click', unlockAudio);

function initMic() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("このブラウザは音声入力に対応してないたま… SafariかChromeを使ってたま！");
        return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
        isRecording = true;
        window.speechSynthesis.cancel(); // 新しく聞き取る時は音声を止める
        if (isTTSEnabled) seStart.play().catch(e => console.log("SEエラー:", e)); 
        
        document.getElementById('mic-btn').classList.add('active'); 
        document.getElementById('mic-status').innerText = "聞き取り中... (タップで停止)";
        document.getElementById('mic-status').style.color = "#ff3030";
    };
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('chat-input').value = text;
        askPokemonAI(); 
    };
    recognition.onerror = (event) => {
        console.error("音声認識エラー:", event.error);
        stopMic();
    };
    recognition.onend = () => {
        stopMic();
    };
}

function toggleMic() {
    if (!recognition) initMic();
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function stopMic() {
    isRecording = false;
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('active'); 
    const statusText = document.getElementById('mic-status');
    if (statusText) {
        statusText.innerText = "タップして話す";
        statusText.style.color = "#555";
    }
}

async function askPokemonAI() {
    const inputEl = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-messages');
    const userText = inputEl.value.trim();
    if (!userText) return;

    chatBox.innerHTML += `<div class="msg user"><div class="text">${userText}</div></div>`;
    inputEl.value = '';
    const loadingId = "loading-" + Date.now();
    
    chatBox.innerHTML += `
        <div id="${loadingId}" class="msg bot">
            <img src="tamachan.png" class="avatar" alt="たまちゃん">
            <div class="text">解析中だたま...🔍</div>
        </div>`;
    
    chatBox.scrollTop = chatBox.scrollHeight;

    let cheatSheet = "";
    const statMatch = userText.match(/(?:種族値|合計).*?(\d{3,}).*?以上/);
    const simpleOverMatch = userText.match(/(\d{3,})\s*以上/);
    let threshold = null;
    
    if (statMatch) threshold = parseInt(statMatch[1], 10);
    else if ((userText.includes("種族値") || userText.includes("合計")) && simpleOverMatch) threshold = parseInt(simpleOverMatch[1], 10);
    else if (userText.includes("500以上")) threshold = 500;

    if (threshold !== null) {
        const strongPokemons = POKE_DB.filter(p => {
            const m = p.info.match(/合計\s*\n\s*(\d+)/);
            return m && parseInt(m[1], 10) >= threshold;
        });
        cheatSheet = `【種族値${threshold}以上のFRLGポケモン一覧と詳細データ】\n` + 
                     strongPokemons.map(p => {
                         const m = p.info.match(/合計\s*\n\s*(\d+)/);
                         return `・${p.name} (合計種族値: ${m[1]})`;
                     }).join("\n");
    } else {
        const directMatches = POKE_DB.filter(p => userText.includes(p.name));
        let relatedData = [];
        if (directMatches.length > 0) {
            POKE_DB.forEach(p => {
                directMatches.forEach(target => {
                    if (p.info.includes(target.name) || target.info.includes(p.name)) {
                        relatedData.push(p);
                    }
                });
            });
            const finalMatches = [...new Set([...directMatches, ...relatedData])].slice(0, 5);
            cheatSheet = finalMatches.map(p => `【${p.name}のデータ】\n${p.info}`).join("\n\n");
        } 
        else if (lastCheatSheet !== "") {
            cheatSheet = `【前回のデータ（代名詞の質問用）】\n${lastCheatSheet}`;
        } else {
            cheatSheet = "【現在カンペなし】";
        }
    }

    if (cheatSheet !== "【現在カンペなし】") lastCheatSheet = cheatSheet;

    const historyText = pokeChatHistory.map(h => `${h.role === 'user' ? 'ユーザー' : 'たまちゃん'}: ${h.text}`).join("\n");
    const fullPrompt = `${SYSTEM_PROMPT}\n\n=== 過去会話 ===\n${historyText}\n\n=== カンペ ===\n${cheatSheet}\n\n=== 質問 ===\n${userText}`;

    pokeChatHistory.push({ role: 'user', text: userText });
    if (pokeChatHistory.length > 6) pokeChatHistory.shift();

    try {
        const response = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });
        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        
        pokeChatHistory.push({ role: 'bot', text: botReply });
        if (pokeChatHistory.length > 6) pokeChatHistory.shift();
        
        document.getElementById(loadingId).remove();
        
        chatBox.innerHTML += `
            <div class="msg bot">
                <img src="tamachan.png" class="avatar" alt="たまちゃん">
                <div class="text">${botReply}</div>
            </div>`;
            
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // 読み上げとSE再生
        if (isTTSEnabled) {
            seReceive.play().catch(e => console.log("SEエラー:", e));
            speakText(botReply);
        }
        
    } catch (error) {
        document.getElementById(loadingId).innerText = "通信エラーだたま！";
    }
}