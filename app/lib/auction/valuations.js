// Генерация субъективных оценок sh, sa, sr, so

// clipInt — ограничивает число в пределах [lo; hi]
// нужно чтобы не выйти за 0...200
function clipInt(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// genValuations генерирует оценки 4 свинок
// x — истинная ценность
// yPct — шум (5 / 10 / 15)
// rng — генератор случайных чисел
export function genValuations({ x, yPct, rng }) {

    const y = yPct / 100; // переводим проценты в долю

    // диапазон из условия
    const lo = Math.floor(x - x * y);
    const hi = Math.ceil(x + x * y);

    // генерируем 4 независимые оценки
    // честная
    const sh = clipInt(rng.int(lo, hi), 0, 200);

    // агрессивная
    const sa = clipInt(rng.int(lo, hi), 0, 200);

    // рациональная
    const sr = clipInt(rng.int(lo, hi), 0, 200);

    // осторожная
    const so = clipInt(rng.int(lo, hi), 0, 200);

    return { sh, sa, sr, so, lo, hi };
}