document.addEventListener('DOMContentLoaded', () => {
    const resultsDataString = localStorage.getItem('pitchTestResults');
    const summaryElement = document.getElementById('summary');
    const finalThresholdElement = document.getElementById('finalThreshold');
    const totalTrialsElement = document.getElementById('totalTrials');
    const correctCountElement = document.getElementById('correctCount');
    const correctRateElement = document.getElementById('correctRate');
    const canvas = document.getElementById('thresholdChart'); // canvas要素を取得
    const ctx = canvas?.getContext('2d'); // contextを取得

    if (!resultsDataString) {
        summaryElement.innerHTML = '<p>テスト結果が見つかりませんでした。もう一度テストを実行してください。</p>';
        if (canvas) canvas.style.display = 'none'; // グラフエリアを非表示
        return;
    }
    if (!ctx) {
         summaryElement.innerHTML = '<p>グラフ描画エリアの初期化に失敗しました。</p>';
        console.error("Canvas context is null");
        return;
    }


    try {
        const results = JSON.parse(resultsDataString);

        if (!Array.isArray(results) || results.length === 0) {
             summaryElement.innerHTML = '<p>テスト結果データが空です。</p>';
             if (canvas) canvas.style.display = 'none';
            return;
        }

        // --- サマリー情報の計算と表示 ---
        const totalTrials = results.length;
        const correctCount = results.filter(r => r.correct).length;
        const correctRate = totalTrials > 0 ? ((correctCount / totalTrials) * 100).toFixed(1) : "0.0"; // 0除算回避

        totalTrialsElement.textContent = totalTrials;
        correctCountElement.textContent = correctCount;
        correctRateElement.textContent = correctRate;

        // 最後の5試行の平均セント差を計算
        const lastTrials = results.slice(-5);
        if (lastTrials.length > 0) {
            const sumCents = lastTrials.reduce((sum, r) => sum + r.cents, 0);
            const avgCents = (sumCents / lastTrials.length).toFixed(1);
            finalThresholdElement.textContent = avgCents;
        } else {
            finalThresholdElement.textContent = "N/A";
        }


        // --- Chart.js を使った閾値追跡プロット ---
        const trials = results.map(r => r.trial);
        const centsData = results.map(r => r.cents);
        // 正解/不正解でポイントの色を変える
        const pointBackgroundColors = results.map(r => r.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');
        const pointBorderColors = results.map(r => r.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');


        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trials, // X軸: 試行番号
                datasets: [{
                    label: '試行ごとのセント差',
                    data: centsData, // Y軸: セント差
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointBorderColor: pointBorderColors,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '試行回数'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'セント差 (小さいほど難しい)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            // ツールチップに詳細情報を追加
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                const result = results[index];
                                const outcome = result.correct ? '正解' : '不正解';
                                const details = `音1: ${result.freq1.toFixed(1)}Hz, 音2: ${result.freq2.toFixed(1)}Hz`;
                                const relation = `(実際: ${result.actualRelation}, 回答: ${result.userChoice})`;
                                return `結果: ${outcome}\n${details}\n${relation}`;
                            }
                        }
                    },
                    legend: {
                        display: true
                    }
                }
            }
        });

        // オプション: テストが終わったらlocalStorageのデータを削除する
        // localStorage.removeItem('pitchTestResults');

    } catch (e) {
        console.error("結果データの解析または描画に失敗しました:", e);
        summaryElement.innerHTML = '<p>結果データの表示中にエラーが発生しました。</p>';
         if (canvas) canvas.style.display = 'none';
    }
});