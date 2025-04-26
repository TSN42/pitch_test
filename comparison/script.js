// --- グローバル変数と設定 ---
let audioContext;
let frequency1; // 音1の周波数
let frequency2; // 音2の周波数
let isSecondSoundHigher; // 音2が音1より高いか (true/false)
let isPlaying = false; // 再生中フラグ
let currentCents = 50; // 初期セント差
const minCents = 1;
const maxCents = 200;
const soundDuration = 0.8; // 音の長さ (秒)
const baseFrequencyMin = 261.63; // C4
const baseFrequencyMax = 523.25; // C5
let correctStreak = 0;
const requiredCorrectStreak = 2;
const maxTrials = 20; // テストの最大試行回数
let trialCount = 0;
let testResults = []; // テスト結果を保存する配列
let freq1Played = false; // 音1が再生されたか
let freq2Played = false; // 音2が再生されたか

// --- 追加: 計測用変数 ---
let trialStartTime = null; // 回答時間計測の開始時刻
let playCount1 = 0;     // 音1の再生回数カウンター
let playCount2 = 0;     // 音2の再生回数カウンター

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
    disableAllButtons();

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
    playCount1 = 0; // 再生回数リセット
    playCount2 = 0;
    trialStartTime = null; // 開始時刻リセット
    feedbackDisplay.textContent = '';
    feedbackDisplay.className = '';
    difficultyDisplay.textContent = currentCents.toFixed(1);
    trialInfoDisplay.textContent = `試行 ${trialCount + 1} / ${maxTrials}`;

    // ボタンの状態を初期化
    playFreq1Button.disabled = false;
    playFreq2Button.disabled = true;
    higherButton.disabled = true;
    lowerButton.disabled = true;
    higherButton.classList.remove('feedback-correct', 'feedback-incorrect', 'feedback-show-correct');
    lowerButton.classList.remove('feedback-correct', 'feedback-incorrect', 'feedback-show-correct');

    // 周波数設定
    frequency1 = baseFrequencyMin + Math.random() * (baseFrequencyMax - baseFrequencyMin);
    isSecondSoundHigher = Math.random() < 0.5;
    const centsDifference = isSecondSoundHigher ? currentCents : -currentCents;
    frequency2 = calculateFrequency(frequency1, centsDifference);

    // 開発用ログ
    // console.log(`Trial ${trialCount + 1}: Freq1=${frequency1.toFixed(2)}, Freq2=${frequency2.toFixed(2)}, Cents=${currentCents.toFixed(1)}, Correct=${isSecondSoundHigher ? 'Higher' : 'Lower'}`);
}

// --- 回答ボタン処理 ---
function handleAnswer(userChoseHigher) {
    // 回答可能条件をチェック (trialStartTimeがnullでないことも確認)
    if (!freq1Played || !freq2Played || isPlaying || trialCount >= maxTrials || trialStartTime === null) return;

    const responseTime = performance.now() - trialStartTime; // 回答時間を計算
    const totalPlayCount = playCount1 + playCount2; // 合計再生回数を計算
    const isCorrect = (userChoseHigher === isSecondSoundHigher);

    // デバッグログ
    // console.log(`Answered: ${userChoseHigher ? 'Higher' : 'Lower'}, Correct: ${isCorrect}`);
    // console.log(`Response Time: ${responseTime.toFixed(0)} ms, Play Count: ${totalPlayCount}`);


    // 結果を記録 (responseTime, playCount を追加)
    testResults.push({
        trial: trialCount + 1,
        cents: currentCents,
        correct: isCorrect,
        freq1: frequency1,
        freq2: frequency2,
        actualRelation: isSecondSoundHigher ? 'Higher' : 'Lower',
        userChoice: userChoseHigher ? 'Higher' : 'Lower',
        responseTime: responseTime, // 回答時間
        playCount: totalPlayCount    // 再生回数
    });

    // フィードバック表示
    feedbackDisplay.textContent = isCorrect ? '正解！' : '不正解...';
    feedbackDisplay.className = isCorrect ? 'correct' : 'incorrect';
    const chosenButton = userChoseHigher ? higherButton : lowerButton;
    const correctButton = isSecondSoundHigher ? higherButton : lowerButton;
    chosenButton.classList.add(isCorrect ? 'feedback-correct' : 'feedback-incorrect');
    if (!isCorrect) {
        correctButton.classList.add('feedback-show-correct');
    }

    // 難易度調整 (回答時間と再生回数を渡す)
    updateDifficulty(isCorrect, responseTime, totalPlayCount);

    // 試行回数をインクリメント
    trialCount++;

    // ボタンを一時的に無効化 & 少し待ってから次の試行へ
    disableAllButtons();
    setTimeout(() => {
        setupNextTrial();
    }, 1500);
}

// --- 難易度調整ロジック (応答時間・再生回数を考慮) ---
function updateDifficulty(isCorrect, responseTime, totalPlayCount) {
    // 閾値の設定 (これらの値は調整可能)
    const fastResponseThreshold = 1500; // 1.5秒以内なら速い
    const slowResponseThreshold = 4000; // 4秒以上なら遅い
    const fewPlaysThreshold = 2;       // 合計再生回数2回 (各1回) なら少ない
    const manyPlaysThreshold = 4;      // 合計再生回数5回以上なら多い

    let difficultyMultiplier = 1.0; // 難易度調整の基本係数（セント差に乗算）

    if (isCorrect) {
        correctStreak++;
        // 連続正解条件を満たした場合のみ難易度を上げる
        if (correctStreak >= requiredCorrectStreak) {
            difficultyMultiplier = 0.85; // 基本の難易度上昇率 (セント差を減らす)

            // 回答時間と再生回数で微調整
            if (responseTime < fastResponseThreshold && totalPlayCount <= fewPlaysThreshold) {
                difficultyMultiplier = 0.60; // 速く少ない再生回数で正解 -> もっと難しく
                console.log("Difficulty up significantly (fast/few plays)");
            } else if (responseTime > slowResponseThreshold || totalPlayCount > manyPlaysThreshold) {
                difficultyMultiplier = 0.90; // 遅いか多い再生回数で正解 -> 上昇幅を抑える
                console.log("Difficulty up slightly (slow/many plays)");
            } else {
                console.log("Difficulty up normally");
            }
            correctStreak = 0; // 難易度変更したので連続カウントリセット
        } else {
            // 連続正解条件を満たしていない場合は難易度変更なし
            difficultyMultiplier = 0.95;
            console.log(`Correct, but streak (${correctStreak}/${requiredCorrectStreak}) not met. No difficulty change.`);
        }
    } else { // 不正解の場合
        correctStreak = 0; // 連続正解リセット
        difficultyMultiplier = 1.20; // 基本の難易度下降率 (セント差を増やす)

        // 回答時間と再生回数で微調整
        if (responseTime > slowResponseThreshold || totalPlayCount > manyPlaysThreshold) {
            difficultyMultiplier = 1.30; // 遅いか多い再生回数で不正解 -> もっと簡単に
            console.log("Difficulty down significantly (slow/many plays)");
        } else if (responseTime < fastResponseThreshold && totalPlayCount <= fewPlaysThreshold) {
            difficultyMultiplier = 1.15; // 速く少ない再生回数で不正解 -> 下降幅を抑える（偶然ミスの可能性）
            console.log("Difficulty down slightly (fast/few plays)");
        } else {
             console.log("Difficulty down normally");
        }
    }

    // 新しいセント差を計算し、範囲内に収める
    currentCents *= difficultyMultiplier;
    currentCents = Math.max(minCents, Math.min(maxCents, currentCents));

    console.log(`New cents: ${currentCents.toFixed(1)} (Multiplier: ${difficultyMultiplier.toFixed(2)})`);
}


// --- ボタン無効化/有効化ヘルパー ---
function disableAllButtons() {
    playFreq1Button.disabled = true;
    playFreq2Button.disabled = true;
    higherButton.disabled = true;
    lowerButton.disabled = true;
}

function enableButtonsAfterPlayback() {
    if (trialCount < maxTrials && !isPlaying) {
        playFreq1Button.disabled = false;
        playFreq2Button.disabled = !freq1Played; // 音1再生済みの場合のみ音2有効

        // 音2再生済みの場合のみ回答ボタンを有効化
        const canAnswer = freq1Played && freq2Played;
        higherButton.disabled = !canAnswer;
        lowerButton.disabled = !canAnswer;

        // 回答ボタンが有効になった瞬間を開始時刻とする (まだ記録されていなければ)
        if (canAnswer && trialStartTime === null) {
            trialStartTime = performance.now();
            // console.log("Trial timer started at:", trialStartTime);
        }
    } else if (trialCount >= maxTrials) {
        disableAllButtons(); // テスト終了
    }
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
                setupNextTrial();
                document.body.removeEventListener('click', initAudioHandler, true);
            } else {
                 feedbackDisplay.textContent = "オーディオ機能の初期化に失敗しました。";
                 feedbackDisplay.className = "incorrect";
                 disableAllButtons();
                 return;
            }
        }
    };

    document.body.addEventListener('click', initAudioHandler, { capture: true, once: true });

    // イベントリスナー設定
    playFreq1Button.addEventListener('click', async () => {
        if (audioContext && !isPlaying && trialCount < maxTrials) {
            playCount1++; // 再生回数カウント
            await playSound(frequency1, soundDuration);
            freq1Played = true;
            enableButtonsAfterPlayback(); // 再生後にボタン状態更新
        }
    });

    playFreq2Button.addEventListener('click', async () => {
        if (audioContext && !isPlaying && freq1Played && trialCount < maxTrials) {
            playCount2++; // 再生回数カウント
            await playSound(frequency2, soundDuration);
            freq2Played = true;
            enableButtonsAfterPlayback(); // 再生後にボタン状態更新 & タイマー開始
        }
    });

    higherButton.addEventListener('click', () => handleAnswer(true));
    lowerButton.addEventListener('click', () => handleAnswer(false));

    // 初期状態
    difficultyDisplay.textContent = currentCents.toFixed(1);
    trialInfoDisplay.textContent = `試行 0 / ${maxTrials}`;
    disableAllButtons();
});