// Эксперимент K прогонов

// берем функции для оценок, расчета аукционов и рандома
import { genValuations } from "./valuations";
import { calcVickrey, calcEnglish, calcFirstPrice, calcDutch, isEfficient } from "./formats";
import { Rng } from "./rng";


// mean-среднее значение массива
function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// переводим число побед/ошибок в проценты для вывода
function pct(v, total) {
    if (!total) return "0%";
    return `${Math.round((v / total) * 100)}%`;
}

// округляем среднее, чтобы на экране не было длинных дробей
function formatNum(v) {
    return Math.round(v);
}

// индекс победителя с сервера переводим в понятное имя
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
    // сюда складываем сырые данные по каждому формату
    const store = {};

    // для каджого формата отдельно храним статистику
    formats.forEach((f) => {
        store[f] = {
            // wins считает, сколько раз выиграла каждая свинка
            wins: {
                "Честная": 0,
                "Рациональная": 0,
                "Агрессивная": 0,
                "Осторожная": 0,
            },
            // массивы нужны, чтобы потом посчитать средние значения
            prices: [],
            subjs: [],
            exPosts: [],

            // сколько раз победитель переплатил по истинной ценности
            overpay: 0,

            // сколько раз лот достался участнику с максимальной оценкой
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

        // один и тот же набор оценок прогоняем через выбранные форматы
        for (const f of formats) {
            let res;

            // выбираем нужную функцию расчета по названию формата
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

            // победитель приходит индексом, поэтому переводим его в название
            const winnerName = WINNER_LABELS[res.winner];

            // если субъективного выигрыша почему-то нет, считаем его нулем
            const subj = typeof res.subj === "number" ? res.subj : 0;

            // сохраняем данные одного прогона в копилку формата
            store[f].wins[winnerName] += 1;
            store[f].prices.push(res.price);
            store[f].subjs.push(subj);
            store[f].exPosts.push(res.exPost);

            // exPost < 0 значит победитель купил дороже истинной ценности
            if (res.exPost < 0) {
                store[f].overpay += 1;
            }

            // эффективность: выиграла ли свинка с самой высокой оценкой
            if (isEfficient(res.winner, s)) {
                store[f].eff += 1;
            }
        }
    }

    // сюда уже кладем готовую статистику для фронта
    const out = {};

    //собираем итог статистику по каждому формату
    formats.forEach((f) => {
        out[f] = {
            // проценты побед по типам свинок
            winRates: {
                "Честная": pct(store[f].wins["Честная"], K),
                "Рациональная": pct(store[f].wins["Рациональная"], K),
                "Агрессивная": pct(store[f].wins["Агрессивная"], K),
                "Осторожная": pct(store[f].wins["Осторожная"], K),
            },

            // средняя цена, выигрыши, переплаты и эффективность
            avgPrice: formatNum(mean(store[f].prices)),
            avgSubj: formatNum(mean(store[f].subjs)),
            avgExPost: formatNum(mean(store[f].exPosts)),
            overpayRate: pct(store[f].overpay, K),
            effRate: pct(store[f].eff, K),
        };
    });

    // возвращаем итоговую таблицу статистики
    return out;
}