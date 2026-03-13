// Эксперимент K прогонов

import { genValuations } from "./valuations";
import { calcVickrey, calcEnglish, calcFirstPrice, calcDutch, isEfficient } from "./formats";
import { Rng } from "./rng";


// mean-среднее значение массива
function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}


// runExperiment запускает K прогонов
// K-число прогонов
// x-истинная ценность
// yPct-шум
// agr-коэффициент агрессивной стратегии
// ost-коэффициент осторожной стратегии
// formats-список форматов для расчета
// freeze-фиксировать оценки или нет
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

    // считаем победы по типам
    const win = { honest: 0, aggressive: 0, rational: 0, cautious: 0 };

    // сюда будем собирать цены
    const prices = {};

    // сюда ex post выигрыши
    const exPosts = {};

    // сколько раз была переплата
    const overpay = {};

    // сколько раз исход был эффективным
    const eff = {};

    // инициализируем объекты для каждого формата
    formats.forEach(f => {
        prices[f] = [];
        exPosts[f] = [];
        overpay[f] = 0;
        eff[f] = 0;
    });

    let frozenS = null; // если freeze=true, будем хранить один набор оценок

    for (let k = 0; k < K; k++) {

        let s;

        if (freeze) {
            // если freeze включен, генерим только один раз
            if (!frozenS) {
                const rng = new Rng(baseSeed);
                frozenS = genValuations({ x, yPct, rng });
            }
            s = frozenS;
        } else {
            // иначе каждый прогон новые оценки
            const rng = new Rng(baseSeed + k);
            s = genValuations({ x, yPct, rng });
        }

        // считаем каждый выбранный формат
        for (const f of formats) {

            let res;

            if (f === "vickrey") res = calcVickrey({ s, x, baseSeed });
            else if (f === "english") res = calcEnglish({ s, x, agr, ost, baseSeed });
            else if (f === "first") res = calcFirstPrice({ s, x, agr, ost, baseSeed });
            else if (f === "dutch") res = calcDutch({ s, x, agr, ost, baseSeed });
            else continue;

            const types = ["honest", "aggressive", "rational", "cautious"];

            // увеличиваем победы
            win[types[res.winner]] += 1;

            prices[f].push(res.price);
            exPosts[f].push(res.exPost);

            if (res.exPost < 0) overpay[f] += 1;
            if (isEfficient(res.winner, s)) eff[f] += 1;
        }
    }

    const out = {};

    // считаем средние показатели
    for (const f of formats) {
        out[f] = {
            avgPrice: mean(prices[f]),
            avgExPost: mean(exPosts[f]),
            overpayShare: overpay[f] / K,
            efficientShare: eff[f] / K,
        };
    }

    return { winRates: win, byFormat: out };
}