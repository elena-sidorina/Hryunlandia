// Расчёт 4 форматов аукциона

// порядок участников везде один и тот же:
// 0 - честная
// 1 - рациональная
// 2 - агрессивная
// 3 - осторожная

const PIG_NAMES = ["Честная", "Рациональная", "Агрессивная", "Осторожная"];

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

    if (idx.length === 1) return idx[0];

    const choice = baseSeed % idx.length;
    return idx[choice];
}

// secondMaxDet нужен для Викри
function secondMaxDet(values, baseSeed) {
    const winner = argMaxDet(values, baseSeed);
    const rest = values.filter((_, i) => i !== winner);
    const second = Math.max(...rest);

    return { winner, second };
}

// utilities: полезности участников
// победитель получает свою субъективную оценку минус цену
// остальные получают 0
function buildUtilities(vals, winner, price) {
    return {
        Честная: winner === 0 ? vals[0] - price : 0,
        Рациональная: winner === 1 ? vals[1] - price : 0,
        Агрессивная: winner === 2 ? vals[2] - price : 0,
        Осторожная: winner === 3 ? vals[3] - price : 0,
    };
}

// ВИКРИ

export function calcVickrey({ s, x, baseSeed }) {
    const vals = [s.sh, s.sr, s.sa, s.so];

    const { winner, second } = secondMaxDet(vals, baseSeed);

    const price = second;
    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Все участники сделали закрытые ставки.",
        `${PIG_NAMES[winner]} свинка показала наибольшую ставку.`,
        `По правилу Викри победитель платит вторую по величине цену: ${price} хрюблей.`,
    ];

    return {
        format: "vickrey",
        winner,
        winnerTitle: PIG_NAMES[winner],
        price,
        subj,
        exPost,
        winnerProfit: subj,
        bids: vals,
        utilities,
        log,
    };
}

// АНГЛИЙСКИЙ

export function calcEnglish({ s, x, agr, ost, baseSeed }) {
    const n = 4;

    // максимальные ставки участников с учётом стратегии
    const bids = [
        s.sh, // честная
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    // субъективные оценки в том же порядке
    const vals = [s.sh, s.sr, s.sa, s.so];

    const winner = argMaxDet(bids, baseSeed);
    const price = bids[winner];

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Цена росла, пока в торгах не остался один участник.",
        `${PIG_NAMES[winner]} свинка смогла дольше всех оставаться в торгах.`,
        `Итоговая цена в нашей модели равна её максимальной ставке: ${price} хрюблей.`,
    ];

    return {
        format: "english",
        winner,
        winnerTitle: PIG_NAMES[winner],
        price,
        subj,
        exPost,
        winnerProfit: subj,
        bids,
        utilities,
        log,
    };
}

// ПЕРВАЯ ЦЕНА

export function calcFirstPrice({ s, x, agr, ost, baseSeed }) {
    const n = 4;

    const bids = [
        s.sh, // честная
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    const winner = argMaxDet(bids, baseSeed);
    const price = bids[winner];

    const vals = [s.sh, s.sr, s.sa, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Все участники сделали закрытые ставки.",
        `${PIG_NAMES[winner]} свинка показала наибольшую ставку.`, `В аукционе первой цены победитель платит свою собственную ставку: ${price} хрюблей.`,
    ];

    return {
        format: "first",
        winner,
        winnerTitle: PIG_NAMES[winner],
        price,
        subj,
        exPost,
        winnerProfit: subj,
        bids,
        utilities,
        log,
    };
}

// ГОЛЛАНДСКИЙ

export function calcDutch({ s, x, agr, ost, baseSeed }) {
    const n = 4;

    const thresholds = [
        s.sh, // честная
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    const winner = argMaxDet(thresholds, baseSeed);
    const price = thresholds[winner];

    const vals = [s.sh, s.sr, s.sa, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Цена постепенно снижалась, пока один из участников не согласился купить.",
        `${PIG_NAMES[winner]} свинка первой согласилась на цену ${price} хрюблей.`,
        "По стратегическому смыслу это близко к аукциону первой цены.",
    ];

    return {
        format: "dutch",
        winner,
        winnerTitle: PIG_NAMES[winner],
        price,
        subj,
        exPost,
        winnerProfit: subj,
        bids: thresholds,
        thresholds,
        utilities,
        log,
    };
}

// ЭФФЕКТИВНОСТЬ

export function isEfficient(winnerIdx, s) {
    const vals = [s.sh, s.sr, s.sa, s.so];
    const maxVal = Math.max(...vals);
    return vals[winnerIdx] === maxVal;
}