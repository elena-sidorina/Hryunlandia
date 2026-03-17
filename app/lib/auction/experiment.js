// Эксперимент K прогонов

import { genValuations } from "./valuations";
import { calcVickrey, calcEnglish, calcFirstPrice, calcDutch, isEfficient } from "./formats";
import { Rng } from "./rng";


// mean-среднее значение массива
function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pct(v, total) {
    if (!total) return "0%";
    return `${Math.round((v / total) * 100)}%`;
}

function formatNum(v) {
    return Math.round(v);
}

const WINNER_LABELS = ["Честная", "Рациональная", "Агрессивная", "Осторожная"];


// runExperiment запускает K прогонов
// K-число прогонов
// x-истинная ценность
// yPct-шум
// agr-коэффициент агрессивной стратегии
// ost-коэффициент осторожной стратегии
// formats-список форматов для расчета
// freeze-фикс оценки или нет
// baseSeed-базовый seed
export function runExperiment({
    K,
    x,
    yPct,
    agr,
    ost,
    formats,
    freeze,
    baseSeed,
}) {
    const store = {};

    // для каджого формата отдельно храним статистику
    formats.forEach((f) => {
        store[f] = {
            wins: {
                "Честная": 0,
                "Рациональная": 0,
                "Агрессивная": 0,
                "Осторожная": 0,
            },
            prices: [],
            subjs: [],
            exPosts: [],
            overpay: 0,
            eff: 0,
        };
    });

    let frozenS = null; // если freeze=true, будем хранить один набор оценок

    for (let k = 0; k < K; k++) {
        let s;

        // если включена фикс, оценки генерятся один раз и потом используем их во всех прогонах
        if (freeze) {
            if (!frozenS) {
                const rng = new Rng(baseSeed);
                frozenS = genValuations({ x, yPct, rng });
            }
            s = frozenS;
        } else {
            const rng = new Rng(baseSeed + k);
            s = genValuations({ x, yPct, rng });
        }

        for (const f of formats) {
            let res;

            if (f === "vickrey") {
                res = calcVickrey({ s, x, baseSeed });
            } else if (f === "english") {
                res = calcEnglish({ s, x, agr, ost, baseSeed });
            } else if (f === "first") {
                res = calcFirstPrice({ s, x, agr, ost, baseSeed });
            } else if (f === "dutch") {
                res = calcDutch({ s, x, agr, ost, baseSeed });
            } else {
                continue;
            }

            const winnerName = WINNER_LABELS[res.winner];
            const subj = typeof res.subj === "number" ? res.subj : 0;

            store[f].wins[winnerName] += 1;
            store[f].prices.push(res.price);
            store[f].subjs.push(subj);
            store[f].exPosts.push(res.exPost);

            if (res.exPost < 0) {
                store[f].overpay += 1;
            }

            if (isEfficient(res.winner, s)) {
                store[f].eff += 1;
            }
        }
    }

    const out = {};

    //собираем итог статистику по каждому формату
    formats.forEach((f) => {
        out[f] = {
            winRates: {
                "Честная": pct(store[f].wins["Честная"], K),
                "Рациональная": pct(store[f].wins["Рациональная"], K),
                "Агрессивная": pct(store[f].wins["Агрессивная"], K),
                "Осторожная": pct(store[f].wins["Осторожная"], K),
            },
            avgPrice: formatNum(mean(store[f].prices)),
            avgSubj: formatNum(mean(store[f].subjs)),
            avgExPost: formatNum(mean(store[f].exPosts)),
            overpayRate: pct(store[f].overpay, K),
            effRate: pct(store[f].eff, K),
        };
    });
    return out;
}