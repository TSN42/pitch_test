// --- グローバル変数と設定 ---
let audioContext;
let frequency1; // 音1の周波数
let frequency2; // 音2の周波数
let isSecondSoundHigher; // 音2が音1より高いか (true/false)
let isPlaying = false; // 再生中フラグ
let currentCents = 100; // 初期セント差
const minCents = 1;
const maxCents = 200;
const soundDuration = 0.8; // 音の長さ (秒)
const baseFrequencyMin = 261.63; // C4
const baseFrequencyMax = 523.25; // C5
let correctStreak = 0;
const requiredCorrectStreak = 2;
const maxTrials = 15; // テストの最大試行回数
let trialCount = 0;
let testResults = []; // テスト結果を保存する配列
let freq1Played = false; // 音1が再生されたか
let freq2Played = false; // 音2が再生されたか

// --- DOM要素の取得 ---
const playFreq1Button = document.getElementById('playFreq1');
const playFreq2Button = document.getElementById('playFreq2');
const higherButton = document.getElementById('answerHigher');
const lowerButton = document.getElementById('answerLower');
const feedbackDisplay = document.getElementById('feedback');
const difficultyDisplay = document.getElementById('difficultyDisplay');
const trialInfoDisplay = document.getElementById('trialInfo');

// --- Web Audio API 初期化 ---
function initAudio() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) {
        alert('Web Audio APIはこのブラウザではサポートされていません。');
        console.error(e);
    }
}

// --- 音再生関数 ---
async function playSound(frequency, duration) {
    if (!audioContext || isPlaying) return;

    isPlaying = true;
    disableAllButtons(); // 再生中は全ての操作を一旦無効化

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration - 0.05);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);

    return new Promise(resolve => {
        setTimeout(() => {
            isPlaying = false;
            enableButtonsAfterPlayback(); // 再生後にボタンの状態を再設定
            resolve();
        }, duration * 1000);
    });
}

// --- 周波数計算関数 ---
function calculateFrequency(baseFrequency, cents) {
    return baseFrequency * Math.pow(2, cents / 1200);
}

// --- 次の試行の準備 ---
function setupNextTrial() {
    if (trialCount >= maxTrials) {
        finishTest();
        return;
    }

    // 状態リセット
    freq1Played = false;
    freq2Played = false;
    feedbackDisplay.textContent = '';
    feedbackDisplay.className = '';
    difficultyDisplay.textContent = currentCents.toFixed(1);
    trialInfoDisplay.textContent = `試行 ${trialCount + 1} / ${maxTrials}`;

    // ボタンの状態を初期化
    playFreq1Button.disabled = false;
    playFreq2Button.disabled = true; // 音1を再生するまで無効
    higherButton.disabled = true;   // 音2を再生するまで無効
    lowerButton.disabled = true;    // 音2を再生するまで無効
    // 前回のフィードバック用クラスを削除
    higherButton.classList.remove('feedback-correct', 'feedback-incorrect', 'feedback-show-correct');
    lowerButton.classList.remove('feedback-correct', 'feedback-incorrect', 'feedback-show-correct');


    // 1. 音1の周波数を決定
    frequency1 = baseFrequencyMin + Math.random() * (baseFrequencyMax - baseFrequencyMin);

    // 2. 音2が高いか低いかをランダムに決定
    isSecondSoundHigher = Math.random() < 0.5;

    // 3. 音2の周波数を計算
    const centsDifference = isSecondSoundHigher ? currentCents : -currentCents;
    frequency2 = calculateFrequency(frequency1, centsDifference);

    // 開発用ログ
    // console.log(`Trial ${trialCount + 1}: Freq1=${frequency1.toFixed(2)}, Freq2=${frequency2.toFixed(2)}, Cents=${currentCents.toFixed(1)}, Correct=${isSecondSoundHigher ? 'Higher' : 'Lower'}`);
}

// --- 回答ボタン処理 ---
function handleAnswer(userChoseHigher) {
    if (!freq1Played || !freq2Played || isPlaying || trialCount >= maxTrials) return;

    const isCorrect = (userChoseHigher === isSecondSoundHigher);

    // 結果を記録
    testResults.push({
        trial: trialCount + 1,
        cents: currentCents,
        correct: isCorrect,
        freq1: frequency1,
        freq2: frequency2,
        actualRelation: isSecondSoundHigher ? 'Higher' : 'Lower',
        userChoice: userChoseHigher ? 'Higher' : 'Lower'
    });

    // フィードバック表示
    feedbackDisplay.textContent = isCorrect ? '正解！' : '不正解...';
    feedbackDisplay.className = isCorrect ? 'correct' : 'incorrect';

    // 回答ボタンに一時的な色付け
    const chosenButton = userChoseHigher ? higherButton : lowerButton;
    const correctButton = isSecondSoundHigher ? higherButton : lowerButton;

    chosenButton.classList.add(isCorrect ? 'feedback-correct' : 'feedback-incorrect');
    if (!isCorrect) {
        // 不正解の場合、正解だった方のボタンも示す（オプション）
        correctButton.classList.add('feedback-show-correct');
    }

    // 難易度調整
    updateDifficulty(isCorrect);

    // 試行回数をインクリメント
    trialCount++;

    // ボタンを一時的に無効化
    disableAllButtons();

    // 少し待ってから次の試行へ
    setTimeout(() => {
        setupNextTrial();
    }, 1500); // 1.5秒待つ
}

// --- 難易度調整ロジック ---
function updateDifficulty(isCorrect) {
    if (isCorrect) {
        correctStreak++;
        if (correctStreak >= requiredCorrectStreak) {
            currentCents = Math.max(minCents, currentCents * 0.85); // 難易度アップ
            correctStreak = 0;
        }
    } else {
        correctStreak = 0;
        currentCents = Math.min(maxCents, currentCents * 1.2); // 難易度ダウン
    }
    currentCents = Math.max(minCents, Math.min(maxCents, currentCents));
}

// --- ボタン無効化/有効化ヘルパー ---
function disableAllButtons() {
    playFreq1Button.disabled = true;
    playFreq2Button.disabled = true;
    higherButton.disabled = true;
    lowerButton.disabled = true;
}

function enableButtonsAfterPlayback() {
    // テストが終了していない場合のみボタンを適切に有効化
    if (trialCount < maxTrials && !isPlaying) { // isPlaying チェックを追加
        playFreq1Button.disabled = false; // 音1は常に再生可能（試行中）
        playFreq2Button.disabled = !freq1Played; // 音1再生済みなら音2を有効化
        higherButton.disabled = !freq2Played; // 音2再生済みなら回答を有効化
        lowerButton.disabled = !freq2Played;
    } else if (trialCount >= maxTrials) {
        disableAllButtons(); // テスト終了後は全て無効
    }
    // 注意: 再生中に disableAllButtons が呼ばれるため、
    // この関数は再生 *終了後* の状態を設定する
}

// --- テスト終了処理 ---
function finishTest() {
    disableAllButtons();
    feedbackDisplay.textContent = `テスト終了！ ${maxTrials}回の試行が完了しました。結果ページに移動します...`;
    feedbackDisplay.className = '';

    try {
        localStorage.setItem('pitchTestResults', JSON.stringify(testResults));
        console.log("テスト結果をlocalStorageに保存しました:", testResults);
        setTimeout(() => {
            window.location.href = 'results.html';
        }, 1500);
    } catch (e) {
        console.error("結果の保存に失敗しました:", e);
        alert("テスト結果の保存に失敗しました。");
        feedbackDisplay.textContent = "テスト終了 (結果表示エラー)";
    }
}

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    const initAudioHandler = () => {
        if (!audioContext) {
            initAudio();
            if (audioContext) {
                console.log("AudioContext initialized.");
                setupNextTrial(); // 最初の試行をセットアップ
                // リスナーを削除
                document.body.removeEventListener('click', initAudioHandler, true);
            } else {
                 feedbackDisplay.textContent = "オーディオ機能の初期化に失敗しました。";
                 feedbackDisplay.className = "incorrect";
                 disableAllButtons();
                 return;
            }
        }
    };

    // 最初のユーザーインタラクションでAudioContextを初期化
    // body全体に対するクリックで初期化を試みる
    document.body.addEventListener('click', initAudioHandler, { capture: true, once: true });

    // イベントリスナー設定
    playFreq1Button.addEventListener('click', async () => {
        if (audioContext && !isPlaying && trialCount < maxTrials) {
            await playSound(frequency1, soundDuration);
            freq1Played = true; // 音1再生済みフラグ
            enableButtonsAfterPlayback(); // 再生後にボタン状態更新
        }
    });

    playFreq2Button.addEventListener('click', async () => {
        if (audioContext && !isPlaying && freq1Played && trialCount < maxTrials) {
            await playSound(frequency2, soundDuration);
            freq2Played = true; // 音2再生済みフラグ
            enableButtonsAfterPlayback(); // 再生後にボタン状態更新
        }
    });

    higherButton.addEventListener('click', () => handleAnswer(true));
    lowerButton.addEventListener('click', () => handleAnswer(false));

    // 初期状態
    difficultyDisplay.textContent = currentCents.toFixed(1);
    trialInfoDisplay.textContent = `試行 0 / ${maxTrials}`; // 初期表示
    disableAllButtons(); // AudioContext初期化までは全て無効
    // setupNextTrialはinitAudio成功後に呼ばれる
});