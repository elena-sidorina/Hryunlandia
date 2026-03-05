// Расчёт 4 форматов аукциона


// roundInt просто округляет ставки
function roundInt(v) {
    return Math.round(v);
}


// argMaxDet находит индекс максимума
// если ничья, решаем её детерминированно по seed
function argMaxDet(values, baseSeed) {

    const maxVal = Math.max(...values);

    const idx = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i] === maxVal) idx.push(i);
    }

    // если нет ничьи просто возвращаем индекс
    if (idx.length === 1) return idx[0];

    // если ничья, то выбираем победителя стабильно
    const choice = baseSeed % idx.length;
    return idx[choice];
}


// secondMaxDet нужен для викри и английского
// находим победителя и второе место
function secondMaxDet(values, baseSeed) {

    const winner = argMaxDet(values, baseSeed);

    const rest = values.filter((_, i) => i !== winner);
    const second = Math.max(...rest);

    return { winner, second };
}


// ВИКРИ (вторая цена)

export function calcVickrey({ s, x, baseSeed }) {

    // s-объект {sh, sa, sr, so}
    const vals = [s.sh, s.sa, s.sr, s.so];

    const { winner, second } = secondMaxDet(vals, baseSeed);

    const price = second; // цена=вторая оценка

    const subj = vals[winner] - price; // субъективный выигрыш
    const exPost = x - price; // ex post выигрыш

    return { format: "vickrey", winner, price, subj, exPost };
}


// АНГЛИЙСКИЙ

export function calcEnglish({ s, x, baseSeed }) {

    // по нашей модели-эквивалент викри
    const vals = [s.sh, s.sa, s.sr, s.so];

    const { winner, second } = secondMaxDet(vals, baseSeed);

    const price = second;

    const subj = vals[winner] - price;
    const exPost = x - price;

    return { format: "english", winner, price, subj, exPost };
}


// ПЕРВАЯ ЦЕНА

export function calcFirstPrice({ s, x, agr, ost, baseSeed }) {

    const n = 4; // фиксированное число участников

    // рассчитываем ставки
    const bids = [
        s.sh, // честная
        roundInt(agr * s.sa), // агрессивная
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(ost * s.so),  // осторожная
    ];

    const winner = argMaxDet(bids, baseSeed);
    const price = bids[winner];

    const vals = [s.sh, s.sa, s.sr, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    return { format: "first", winner, price, subj, exPost, bids };
}


// ГОЛЛАНДСКИЙ

export function calcDutch({ s, x, agr, ost, baseSeed }) {

    const n = 4;

    const thresholds = [
        s.sh,
        roundInt(agr * s.sa),
        roundInt((1 - 1 / n) * s.sr),
        roundInt(ost * s.so),
    ];

    const winner = argMaxDet(thresholds, baseSeed);
    const price = thresholds[winner];

    const vals = [s.sh, s.sa, s.sr, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    return { format: "dutch", winner, price, subj, exPost, thresholds };
}


// isEfficient проверяет эффективности
// победил ли тот, у кого максимальная оценка
export function isEfficient(winnerIdx, s) {
    const vals = [s.sh, s.sa, s.sr, s.so];
    const maxVal = Math.max(...vals);
    return vals[winnerIdx] === maxVal;
}