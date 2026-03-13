import { NextResponse } from "next/server";

// подтягиваем наш код аукциона из папки lib
// rng-генератор псевдослучайных чисел (с seed)
// valuations-генерация субъективных оценок свинк
//formats-правила аукционов
// experiment-K прогонов для статистики
import { Rng } from "@/app/lib/auction/rng";
import { genValuations } from "@/app/lib/auction/valuations";
import { calcVickrey, calcEnglish, calcFirstPrice, calcDutch, isEfficient } from "@/app/lib/auction/formats";
import { runExperiment } from "@/app/lib/auction/experiment";


// небольшая функция чтобы проверять входые числа
// например если пришло что-то странное из фронта, приводим к целому и зажимаем в диапазон
function clampInt(v, lo, hi, def) {
    const n = Number(v); // пробуем привести к числу
    if (!Number.isFinite(n)) return def; // если не число, то дефолт
    const x = Math.round(n); // округляем
    return Math.max(lo, Math.min(hi, x)); // ограничиваем диапазон
}


// главный обработчик POST запроса
// фронтенд будет сюда отправлять параметры обучения
export async function POST(req) {
    try {

        // читаем JSON который пришел из fetch
        const body = await req.json();

        // режим работы API
        // valuations/calc/compare/experiment
        const mode = body.mode;


        // базовые параметры аукциона

        //истинная ценность лота
        const x = clampInt(body.x, 60, 200, 100);

        // шум оценок в процентах
        const yPct = clampInt(body.yPct, 5, 15, 10);

        // seed для генратора случайных чисел
        // если пользователь ничего не ввелб то null
        const seed = body.seed === "" || body.seed == null
            ? null
            : clampInt(body.seed, 0, 2 ** 31 - 1, 1);

        // флаг freeze (чтобы фиксировать случайности)
        const freeze = !!body.freeze;


        // коэффициенты стратегий

        // коэффициент агрессивной свинки
        const agr = Math.max(0.92, Math.min(0.99, Number(body.agr ?? 0.95)));

        // коэффициент осторожной
        const ost = Math.max(0.60, Math.min(0.90, Number(body.ost ?? 0.80)));



        // если seed не задан, берем текущее время, тогда генерация будет просто случайная
        const baseSeed = seed ?? Date.now();



        // 1) режим генерация субъективных оценок

        if (mode === "valuations") {

            // создаем генератор случайных чисел
            const rng = new Rng(baseSeed);

            // генерим оценки свинок sh sa sr so
            const s = genValuations({ x, yPct, rng });

            // отправляем результат обратно на фронт
            return NextResponse.json({
                ok: true,
                baseSeed,
                x,
                yPct,
                s,
                freeze
            });
        }



        // helper функция
        // считает один аукционый формат

        function calcOne(format, s) {

            let res;

            //в зависимости от формата вызываем нужную фукцию

            if (format === "vickrey")
                res = calcVickrey({ s, x, baseSeed });

            else if (format === "english")
                res = calcEnglish({ s, x, agr, ost, baseSeed });

            else if (format === "first")
                res = calcFirstPrice({ s, x, agr, ost, baseSeed });

            else if (format === "dutch")
                res = calcDutch({ s, x, agr, ost, baseSeed });

            else
                return null;



            // добавляем дополнительные метрики
            return {

                //winner price profit и т.д.
                ...res,

                // проверяем эффективность
                efficient: isEfficient(res.winner, s),

                // проверяем переплату
                overpay: res.exPost < 0
            };
        }



        // функция получения оценок

        function getS() {

            // если оценки пришли из фронта, используем их
            if (body.s && typeof body.s === "object") {

                const sh = clampInt(body.s.sh, 0, 200, 0);
                const sa = clampInt(body.s.sa, 0, 200, 0);
                const sr = clampInt(body.s.sr, 0, 200, 0);
                const so = clampInt(body.s.so, 0, 200, 0);

                return { sh, sa, sr, so };
            }

            // иначе генерим новые
            const rng = new Rng(baseSeed);
            return genValuations({ x, yPct, rng });
        }



        // 2) режим calc
        // считаем один формат

        if (mode === "calc") {

            //какой формат аукциона
            const format = body.format;

            // получаем оценки
            const s = getS();

            // считаем аукцион
            const res = calcOne(format, s);

            return NextResponse.json({
                ok: true,
                baseSeed,
                x,
                yPct,
                agr,
                ost,
                s,
                res
            });
        }



        // 3) режим compare
        // считаем сразу все 4 формата

        if (mode === "compare") {

            const s = getS();

            const formats = ["english", "dutch", "first", "vickrey"];

            const results = {};

            // считаем каджый формат
            for (const f of formats) {
                results[f] = calcOne(f, s);
            }

            return NextResponse.json({
                ok: true,
                baseSeed,
                x,
                yPct,
                agr,
                ost,
                s,
                results
            });
        }



        // 4) режим: experiment
        //K прогонов статистики

        if (mode === "experiment") {

            // число прогонов
            const K = clampInt(body.K, 20, 500, 50);

            // список форматов
            const formats =
                Array.isArray(body.formats) && body.formats.length
                    ? body.formats
                    : ["english", "dutch", "first", "vickrey"];



            // запускаем серию экспериментов
            const stats = runExperiment({
                K,
                x,
                yPct,
                agr,
                ost,
                formats,
                freeze,
                baseSeed
            });

            return NextResponse.json({
                ok: true,
                baseSeed,
                x,
                yPct,
                agr,
                ost,
                K,
                formats,
                stats
            });
        }



        // если режим неизвестный
        return NextResponse.json(
            { ok: false, error: "Unknown mode" },
            { status: 400 }
        );

    } catch (e) {

        //если что то сломалось
        return NextResponse.json(
            { ok: false, error: String(e) },
            { status: 500 }
        );
    }
}