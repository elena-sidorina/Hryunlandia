// Расчет 4 форматов аукциона

// порядок участников везде один и тот же:
// 0 - честная
// 1 - рациональная
// 2 - агрессивная
// 3 - осторожная

// названия свинок в том же порядке, что и индексы 0-3
const PIG_NAMES = ["Честная", "Рациональная", "Агрессивная", "Осторожная"];

// roundInt просто округляет ставки
function roundInt(v) {
    return Math.round(v);
}

// argMaxDet находит индекс максимума
// если ничья, решаем ее детерминированно по seed
function argMaxDet(values, baseSeed) {
    // сначала ищем само максимальное значение
    const maxVal = Math.max(...values);

    // сюда складываем всех, кто набрал максимум
    const idx = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i] === maxVal) idx.push(i);
    }

    if (idx.length === 1) return idx[0];

    // если максимум у нескольких, seed выбирает одного победителя
    const choice = baseSeed % idx.length;
    return idx[choice];
}

// secondMaxDet нужен для Викри
function secondMaxDet(values, baseSeed) {
    // сначала находим победителя по максимальной ставке
    const winner = argMaxDet(values, baseSeed);

    // потом убираем победителя и ищем вторую цену
    const rest = values.filter((_, i) => i !== winner);
    const second = Math.max(...rest);

    return { winner, second };
}

// buildMaxTieLog нужен для ничьей
function buildMaxTieLog(values, winner, word = "ставку") {
    // проверяем, была ли ничья за первое место
    const maxVal = Math.max(...values);
    const tied = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i] === maxVal) {
            tied.push(PIG_NAMES[i]);
        }
    }

    if (tied.length <= 1) {
        return `${PIG_NAMES[winner]} свинка показала наибольшую ${word}.`;
    }

    return `Свинки ${tied.join(", ")} показали одинаковую наибольшую ${word}. В режиме обучения победитель среди них выбран случайно по seed: ${PIG_NAMES[winner]} свинка забирает лот.`;
}

// utilities: полезности участников
// победитель получает свою субъективную оценку минус цену
// остальные получают 0
function buildUtilities(vals, winner, price) {
    // у непобедителей полезность 0, потому что они ничего не купили
    return {
        Честная: winner === 0 ? vals[0] - price : 0,
        Рациональная: winner === 1 ? vals[1] - price : 0,
        Агрессивная: winner === 2 ? vals[2] - price : 0,
        Осторожная: winner === 3 ? vals[3] - price : 0,
    };
}

// ВИКРИ

export function calcVickrey({ s, x, baseSeed }) {
    // в викри все ставят ровно свою субъективную оценку
    const vals = [s.sh, s.sr, s.sa, s.so];

    // winner — максимальная ставка, second — вторая цена
    const { winner, second } = secondMaxDet(vals, baseSeed);

    // победитель платит не свою ставку, а вторую по величине
    const price = second;

    // subj — выигрыш по личной оценке, exPost — по истинной ценности
    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Все участники сделали закрытые ставки.",
        buildMaxTieLog(vals, winner, "ставку"), ,
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
    // в обучении всегда 4 участника, поэтому n фиксирован
    const n = 4;

    // максимальные ставки участников с учётом стратегии
    const bids = [
        s.sh, // честная
        // рациональная шейдит по формуле 1 - 1/n
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    // субъективные оценки в том же порядке
    const vals = [s.sh, s.sr, s.sa, s.so];

    // побеждает тот, у кого максимальная готовность платить
    const winner = argMaxDet(bids, baseSeed);

    // ближайший конкурент задает почти всю итоговую цену
    const otherBids = bids.filter((_, i) => i !== winner);
    const secondBid = Math.max(...otherBids);

    // в английском аукционе победителю достаточно перебить второго
    // если ничья по максимуму, цена не должна становиться выше максимума победителя
    const price = Math.min(bids[winner], secondBid + 1);

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Цена росла, пока в торгах не остался один участник.",
        `${PIG_NAMES[winner]} свинка смогла дольше всех оставаться в торгах.`,
        `Ближайший конкурент был готов держаться до ${secondBid} хрюблей, поэтому победитель забирает лот за ${price} хрюблей.`,
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
    // снова 4 участника, как в режиме обучения
    const n = 4;

    // закрытые ставки с учетом стратегии каждой свинки
    const bids = [
        s.sh, // честная
        // рациональная шейдит по формуле 1 - 1/n
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    // максимальная ставка выигрывает
    const winner = argMaxDet(bids, baseSeed);

    // в первой цене победитель платит именно свою ставку
    const price = bids[winner];

    const vals = [s.sh, s.sr, s.sa, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Все участники сделали закрытые ставки.",
        buildMaxTieLog(bids, winner, "ставку"),
        `В аукционе первой цены победитель платит свою собственную ставку: ${price} хрюблей.`,
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
    // в голландском участник заранее имеет порог, по которому готов купить
    const n = 4;

    // thresholds — максимальные цены, на которых свинки согласны остановить падение цены
    const thresholds = [
        s.sh, // честная
        // рациональная шейдит по формуле 1 - 1/n
        roundInt((1 - 1 / n) * s.sr), // рациональная
        roundInt(agr * s.sa), // агрессивная
        roundInt(ost * s.so), // осторожная
    ];

    // у кого самый высокий порог, тот первым забирает лот
    const winner = argMaxDet(thresholds, baseSeed);

    // цена равна порогу победителя
    const price = thresholds[winner];

    const vals = [s.sh, s.sr, s.sa, s.so];

    const subj = vals[winner] - price;
    const exPost = x - price;

    const utilities = buildUtilities(vals, winner, price);

    const log = [
        "Цена постепенно снижалась, пока один из участников не согласился купить.",
        buildMaxTieLog(thresholds, winner, "пороговую ставку"),
        `Победитель соглашается купить лот по цене ${price} хрюблей.`,
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
    // эффективность значит, что выиграл участник с самой высокой субъективной оценкой
    const vals = [s.sh, s.sr, s.sa, s.so];
    const maxVal = Math.max(...vals);
    return vals[winnerIdx] === maxVal;
}