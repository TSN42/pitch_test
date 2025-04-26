document.addEventListener('DOMContentLoaded', () => {
    const resultsDataString = localStorage.getItem('pitchTestResults');
    const summaryElement = document.getElementById('summary');
    const finalThresholdElement = document.getElementById('finalThreshold');
    const totalTrialsElement = document.getElementById('totalTrials');
    const correctCountElement = document.getElementById('correctCount');
    const correctRateElement = document.getElementById('correctRate');
    const canvas = document.getElementById('thresholdChart');
    const ctx = canvas?.getContext('2d');

    if (!resultsDataString) {
        summaryElement.innerHTML = '<p>テスト結果が見つかりませんでした。もう一度テストを実行してください。</p>';
        if (canvas) canvas.style.display = 'none';
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

        // サマリー情報
        const totalTrials = results.length;
        const correctCount = results.filter(r => r.correct).length;
        const correctRate = totalTrials > 0 ? ((correctCount / totalTrials) * 100).toFixed(1) : "0.0";
        totalTrialsElement.textContent = totalTrials;
        correctCountElement.textContent = correctCount;
        correctRateElement.textContent = correctRate;

        // 最後の5試行の平均セント差
        const lastTrials = results.slice(-5);
        if (lastTrials.length > 0) {
            const sumCents = lastTrials.reduce((sum, r) => sum + r.cents, 0);
            const avgCents = (sumCents / lastTrials.length).toFixed(1);
            finalThresholdElement.textContent = avgCents;
        } else {
            finalThresholdElement.textContent = "N/A";
        }

        // Chart.js グラフ描画
        const trials = results.map(r => r.trial);
        const centsData = results.map(r => r.cents);
        const pointBackgroundColors = results.map(r => r.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');
        const pointBorderColors = pointBackgroundColors;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trials,
                datasets: [{
                    label: '試行ごとのセント差',
                    data: centsData,
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
                    x: { title: { display: true, text: '試行回数' } },
                    y: { title: { display: true, text: 'セント差 (小さいほど難しい)' }, beginAtZero: true }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            // ツールチップに詳細情報を追加 (回答時間と再生回数)
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                const result = results[index];
                                const outcome = result.correct ? '正解' : '不正解';
                                // responseTime と playCount が存在するかチェック
                                const timeInfo = result.responseTime !== undefined ? `時間: ${(result.responseTime / 1000).toFixed(1)}秒` : '';
                                const playInfo = result.playCount !== undefined ? `再生: ${result.playCount}回` : '';
                                const freqInfo = `音1: ${result.freq1.toFixed(1)}Hz, 音2: ${result.freq2.toFixed(1)}Hz`;
                                const relation = `(実際: ${result.actualRelation}, 回答: ${result.userChoice})`;

                                // 表示する情報を配列に格納し、空でないものだけ結合
                                const lines = [
                                    `結果: ${outcome}`,
                                    freqInfo,
                                    relation,
                                    timeInfo,
                                    playInfo
                                ].filter(line => line); // 空の文字列を除去
                                return lines.join('\n'); // 改行で結合
                            }
                        }
                    },
                    legend: { display: true }
                }
            }
        });

        // localStorage.removeItem('pitchTestResults'); // デバッグ中はコメントアウト

    } catch (e) {
        console.error("結果データの解析または描画に失敗しました:", e);
        summaryElement.innerHTML = '<p>結果データの表示中にエラーが発生しました。</p>';
         if (canvas) canvas.style.display = 'none';
    }
});