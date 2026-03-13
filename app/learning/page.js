"use client";

import { useMemo, useState } from "react";
import Link from "next/link"; // чтобы делать переходы между страницами внутри нашего сайтика в Next.js

//тут просто список режимов обуения, я их потом вывожу кнопками на экране 1
const MODES = [
    { id: "demo", title: "Демонстрация", desc: "Один прогон: оценки → формат → результат" },
    { id: "compare", title: "Сравнение форматов", desc: "Один набор оценок → считаем все 4 формата" },
    { id: "experiment", title: "Эксперимент (K прогонов)", desc: "Много прогонов → статистика" },
];

// здесь список аукционов, используется на экране выбора формата
const FORMATS = [
    { id: "vickrey", title: "Викри (2-я цена)" },
    { id: "english", title: "Английский" },
    { id: "first", title: "Первая цена" },
    { id: "dutch", title: "Голландский" },
];

const PIGS = [
    { title: "Честная", key: "sh" },
    { title: "Рациональная", key: "sr" },
    { title: "Агрессивная", key: "sa" },
    { title: "Осторожная", key: "so" },
];

// подробные тексты для пасхалки
// можно потом перкписать красивее и длиннее (чисто  учебная часть)
const FORMAT_DETAILS = {
    english: {
        title: "Английский аукцион (открытый)",
        about:
            "Открытый аукцион с повышением цены. Участники видят ставки друг друга и поднимают цену, пока не останется один. Итоговая цена обычно близка ко второй по величине оценке (по смыслу похоже на Викри при честной игре). Исторически — классический формат публичных торгов.",
    },
    dutch: {
        title: "Голландский аукцион (открытый)",
        about:
            "Открытый аукцион с понижением цены. Цена стартует высоко и постепенно падает, пока кто-то не согласится купить. Эквивалентен аукциону первой цены по стратегическому смыслу (участники выбирают порог: когда остановить цену).",
    },
    first: {
        title: "Аукцион первой цены (закрытый)",
        about:
            "Закрытые ставки: каждый отправляет свою ставку тайно. Побеждает максимальная ставка и она же платится. Часто выгодно “шэйдить” (занижать) ставку относительно своей оценки, чтобы не переплатить.",
    },
    vickrey: {
        title: "Аукцион Викри (закрытый, 2-я цена)",
        about:
            "Закрытые ставки. Побеждает максимальная ставка, но победитель платит вторую по величине ставку. Классический результат: честная ставка (равная своей оценке) становится доминирующей стратегией при стандартных предпосылках.",
    },
};

export default function LearningPage() {

    //step-какой экран сейчас показываем
    // у нас всего 7 экранов в обучении
    const [step, setStep] = useState(1);

    // mode-какой режим обучения выбран demo/compare/experiment
    const [mode, setMode] = useState(null);

    //параметры модели (экран 2)

    // истинная ценность лота
    const [x, setX] = useState(120);

    // шум оценки
    const [yPct, setYPct] = useState(10);

    //коэффициенты стратегий
    const [agr, setAgr] = useState(0.95); // агрессивная
    const [ost, setOst] = useState(0.8);  // осторожная

    // фиксировать случайность или нет
    const [freeze, setFreeze] = useState(false);

    // seed для генератора слчайных чисел
    const [seed, setSeed] = useState("");

    // s-cубъективные оценки свинок, генерятся на экране 3
    const [s, setS] = useState(null);
    const [genDone, setGenDone] = useState(false);
    // какой режим на экране 3 сейчас активен auto или manual
    const [valuationMode, setValuationMode] = useState("auto");

    // флаг, что пользователь уже руками задал оценки
    const [manualDone, setManualDone] = useState(false);

    // состояние для всплывающего окна с объяснением аукциона ( наша пасхалка)
    // infoOpen хранит открыто ли окно с подробным описанием аукциона
    const [infoOpen, setInfoOpen] = useState(false);
    // infoId хранит какрй именно аукцион сейчас показываем в этом окне
    const [infoId, setInfoId] = useState(null);

    // выбранный формат аукциона 
    // экран 4
    const [format, setFormat] = useState("vickrey");

    //res-результат одного аукциона
    // экран 5
    const [res, setRes] = useState(null);
    // для кноопки "посчитать"
    const [calcLoading, setCalcLoading] = useState(false);
    const [calcError, setCalcError] = useState("");

    // results-результаты всех форматов
    // экран 6
    const [results, setResults] = useState(null);

    // эксперимент
    //экран 7
    const [K, setK] = useState(50);
    const [expFormats, setExpFormats] = useState(["english", "dutch", "first", "vickrey"]);
    const [stats, setStats] = useState(null);

    // нижняя и верхняя границы для оценок свинок
    // считаем от ист ценности x и шума yPct
    const minVal = Math.max(0, Math.round(x - (x * yPct) / 100));
    const maxVal = Math.min(200, Math.round(x + (x * yPct) / 100));

    // тут просто переводим индекс победителя в нормальное имя свинки
    const winnerPig =
        typeof res?.winner === "number" ? PIGS[res.winner] : null;

    // нормальное имя победтеля для вывода на экран
    const winnerLabel =
        winnerPig?.title ?? res?.winnerTitle ?? res?.winner ?? "—";

    // оценка победителя (нужна, чтобы посчитать выигрыш)
    const winnerValue =
        winnerPig && s ? s[winnerPig.key] : null;

    //если сервер не прислал winnerProfit считаем сами как оценка-цена
    const winnerProfit =
        res?.winnerProfit ??
        (winnerValue != null && res?.price != null
            ? Number(winnerValue) - Number(res.price)
            : null);

    // временный текст по ходу торгов
    const fallbackLog =
        format === "english"
            ? "Цена росла, пока в торгах не остался один участник."
            : format === "dutch"
                ? "Цена падала, пока один из участников не согласился купить."
                : format === "first"
                    ? "Все участники сделали закрытые ставки, победила максимальная ставка."
                    : format === "vickrey"
                        ? "Все участники сделали закрытые ставки, победитель платит вторую цену."
                        : "Ход торгов пока не описан.";

    // просто проверяет можно ли нажать кнопку "дальше
    const canNext = useMemo(() => {

        if (step === 1) return mode != null;
        if (step === 3) return s != null;
        if (step === 5) return res != null;
        if (step === 6) return results != null;
        if (step === 7) return stats != null;
        return true;

    }, [step, mode, s, res, results, stats]);

    function getFlow(m) {
        if (m === "demo") return [1, 2, 3, 4, 5];
        if (m === "compare") return [1, 2, 3, 6];
        if (m === "experiment") return [1, 2, 7];
        return [1, 2, 3, 4, 5, 6, 7];
    }

    //перейти на следующий экран
    function goNext() {
        if (!canNext) return;

        const flow = getFlow(mode);
        const i = flow.indexOf(step);
        if (i === -1) return;

        setStep(flow[Math.min(i + 1, flow.length - 1)]);
    }

    // вернуться назад
    function goBack() {
        const flow = getFlow(mode);
        const i = flow.indexOf(step);
        if (i === -1) return;

        setStep(flow[Math.max(i - 1, 0)]);
    }

    //полный сброс обучения
    function resetAll() {

        setStep(1);
        setMode(null);
        setS(null);
        setRes(null);
        setResults(null);
        setStats(null);
    }

    //маленькая функция (через нее общаемся с API)

    // фронт отправляет данные, сервер считвет аукцион, сервер возвращает ответ
    async function apiPost(payload) {

        const r = await fetch("/api/learning", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload),
        });

        const data = await r.json();

        if (!data.ok) throw new Error(data.error || "API error");

        return data;
    }

    //экран 3
    // генерим оценки свинок
    async function generateValuations() {

        const data = await apiPost({

            mode: "valuations",

            x,
            yPct,
            agr,
            ost,
            freeze,
            seed
        });

        setS(data.s);
        setRes(null);
        setCalcError("");
        setResults(null);
        setStats(null);
        setGenDone(true);
        setValuationMode("auto");
        setManualDone(false);
    };

    // если пользователь хочет сам задать оценки
    function startManualValuations() {
        setValuationMode("manual");

        // если оценок ещё нет, ставим всем середину диапазона
        if (!s) {
            const mid = Math.round((minVal + maxVal) / 2);

            setS({
                sh: mid,
                sr: mid,
                sa: mid,
                so: mid,
            });
        }

        setRes(null);
        setCalcError("");
        setResults(null);
        setStats(null);
        setManualDone(true);
    }

    // меняем одну оценку в ручном режиме
    function changeManualValuation(key, value) {
        setS((prev) => ({
            ...(prev ?? {}),
            [key]: Number(value),
        }));

        setRes(null);
        setCalcError("");
        setResults(null);
        setStats(null);
        setManualDone(true);
    }


    // экран 5
    // считаем один формат
    async function calcOne() {

        const data = await apiPost({

            mode: "calc",

            format,

            x,
            yPct,
            agr,
            ost,
            freeze,
            seed,

            // передаем текущие оценки, чтобы они не пересчитывались
            s,
        });

        setRes(data.res);
    }
    // функция "посчитать" для нашего перехода мутного на страницу 6
    async function calcOneUi() {
        try {
            setCalcError("");
            setCalcLoading(true);
            setRes(null); // чтобы старый результат не висел

            const data = await apiPost({
                mode: "calc",
                format,
                x,
                yPct,
                agr,
                ost,
                freeze,
                seed,
                s,
            });

            setRes(data.res);
        } catch (e) {
            setCalcError(String(e?.message || e));
        } finally {
            setCalcLoading(false);
        }
    }

    // экран 6
    // считаем сразу все форматы
    async function calcCompare() {

        const data = await apiPost({

            mode: "compare",

            x,
            yPct,
            agr,
            ost,
            freeze,
            seed,
            s,
        });

        setResults(data.results);
    }

    // экран 7
    // запускаем эксперимент
    async function runExp() {

        const data = await apiPost({

            mode: "experiment",

            K,

            formats: expFormats,

            x,
            yPct,
            agr,
            ost,
            freeze,
            seed
        });

        setStats(data.stats);
    }

    // функция, которая достает имя победителя
    //r-это результат одного аукциона (english, dutch, first или vickrey)
    function getWinnerName(r) {

        // если вдруг результата нет (например ещё не нажали сравнить)
        if (!r) return "—";

        // если сервер уже присылает норм имя победителя, тогда просто используем его
        if (r.winnerTitle) return r.winnerTitle;

        // если победитель приходит как индекс, то переводим индекс в название свинки
        if (typeof r.winner === "number") {
            return PIGS[r.winner]?.title ?? "—";
        }

        // на всякий случай — если победитель пришёл строкой
        return r.winner ?? "—";
    }


    //создаем удобый список карточек для сравнения форматов
    // results приходит с сервера и содержит результаты всех аукционов
    const compareCards = results
        ? [
            {
                // id формата
                id: "english",

                // красивое название формата
                title: "Английский",

                // сами данные резултата аукциона
                data: results.english,
            },
            {
                id: "dutch",
                title: "Голландский",
                data: results.dutch,
            },
            {
                id: "first",
                title: "Первая цена",
                data: results.first,
            },
            {
                id: "vickrey",
                title: "Викри",
                data: results.vickrey,
            },
        ]
        // если результатов пока нет просто пустой массив
        : [];


    // ищем максимальную цену сделки среди всех форматов (чтобы отметить самую высокую цену)
    const maxPrice =
        compareCards.length > 0
            ? Math.max(
                // берём цену из каждого формата
                ...compareCards.map((c) => c.data?.price ?? -Infinity)
            )
            //  если карточек нет ничего не считаем
            : null;


    // ищем максимальный субъективный выигрыш победителя
    // поможет показать, где победитель самый довольный
    const maxSubj =
        compareCards.length > 0
            ? Math.max(
                ...compareCards.map((c) => c.data?.subj ?? -Infinity)
            )
            : null;


    // ищем форматы, где произошла переплата (это когда ex post выигрыш отриц)
    const overpayFormats = compareCards

        // оставляем только те форматы, где exPost < 0
        .filter((c) => (c.data?.exPost ?? 0) < 0)

        // берем только названия форматов
        .map((c) => c.title);


    // проверяем совпал ли победитель во всех форматах
    const sameWinner =
        compareCards.length > 0
            ? compareCards.every(
                (c) =>
                    // сравниваем победителя текущего формата
                    getWinnerName(c.data)
                    //с победителем перввго формата
                    === getWinnerName(compareCards[0].data)
            )
            // если карточек нет считаем false
            : false;

    // удобный список форматов для чекбоксов на экране 7
    const EXP_FORMAT_OPTIONS = [
        { id: "english", title: "Английский" },
        { id: "dutch", title: "Голландский" },
        { id: "first", title: "Первая цена" },
        { id: "vickrey", title: "Викри" },
    ];

    // маленькая функция: переключаем формат в списке эксперимента
    function toggleExpFormat(id) {
        setExpFormats((prev) => {
            // если формат уже есть — убираем его
            if (prev.includes(id)) {
                return prev.filter((x) => x !== id);
            }

            // если формата ещё нет — добавляем
            return [...prev, id];
        });

        // если пользователь меняет набор форматов,
        // старую статистику лучше сбросить
        setStats(null);
    }

    // берём карточки статистики из ответа сервера
    // если stats ещё нет — просто пустой массив
    const statCards = stats
        ? Object.entries(stats).map(([id, data]) => ({
            id,
            title: FORMATS.find((f) => f.id === id)?.title ?? id,
            data,
        }))
        : [];

    // ищем формат с самой высокой средней ценой
    const maxAvgPrice =
        statCards.length > 0
            ? Math.max(...statCards.map((c) => c.data?.avgPrice ?? -Infinity))
            : null;

    // ищем формат с самым большим средним субъективным выигрышем
    const maxAvgSubj =
        statCards.length > 0
            ? Math.max(...statCards.map((c) => c.data?.avgSubj ?? -Infinity))
            : null;

    // ищем формат с самой большой долей переплат
    const maxOverpayRate =
        statCards.length > 0
            ? Math.max(...statCards.map((c) => c.data?.overpayRate ?? -Infinity))
            : null;

    return (

        <main className="min-h-screen bg-pink-100 p-8">

            <div className="max-w-5xl mx-auto">

                {/* кнопка назад на главную */}

                <a href="/" className="text-green-600">

                    ← На главную

                </a>

                <h1 className="text-3xl font-bold mt-4">

                    Режим обучения

                </h1>

                {/* основная белая карточка */}

                <div className="mt-6 bg-white/65 backdrop-blur-lg border rounded-2xl shadow p-6">

                    {/* просто показываем номер экрана */}

                    <div className="text-sm text-slate-600">

                        Экран {step} из 7

                    </div>

                    {/* экран 1 выбор режима */}

                    {step === 1 && (

                        <div className="mt-5">

                            <h2 className="text-xl font-semibold">

                                Выберите режим обучения

                            </h2>

                            <div className="mt-4 grid grid-cols-3 gap-4">

                                {MODES.map((m) => (

                                    <button

                                        key={m.id}

                                        onClick={() => {
                                            setMode(m.id);
                                            setS(null);
                                            setRes(null);
                                            setResults(null);
                                            setStats(null);
                                        }}

                                        className={
                                            "border rounded-xl p-4 bg-white/70 hover:bg-white " +
                                            (mode === m.id ? "ring-2 ring-pink-400" : "")
                                        }

                                    >

                                        <div className="font-semibold">

                                            {m.title}

                                        </div>

                                        <div className="text-sm text-slate-600">

                                            {m.desc}

                                        </div>

                                    </button>

                                ))}

                            </div>

                        </div>

                    )}

                    {/* экран 2 выбор параметров модели */}

                    {step === 2 && (
                        <div className="mt-5">
                            <h2 className="text-xl font-semibold">Параметры модели</h2>

                            {/* 1) x: ползунок */}
                            <div className="mt-5">
                                <div className="font-medium">Выберем истинную ценность нашего лота:</div>

                                <div className="mt-3 flex items-center gap-4">
                                    <input
                                        type="range"
                                        min={60}
                                        max={200}
                                        step={10}
                                        value={x}
                                        onChange={(e) => {
                                            setX(Number(e.target.value));
                                            setRes(null);
                                            setCalcError("");
                                        }}
                                        className="w-full"
                                    />
                                    <div className="min-w-[70px] text-right font-semibold">{x}</div>
                                </div>

                                <div className="mt-1 text-xs text-slate-500">Диапазон: 60…200, шаг 10</div>
                            </div>

                            {/* 2) yPct: три кнопки */}
                            <div className="mt-8">
                                <div className="font-medium">Определим шум оценки:</div>

                                <div className="mt-4 flex justify-center gap-3">
                                    {[5, 10, 15].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => {
                                                setYPct(p);
                                                setRes(null);
                                                setCalcError("");
                                            }}
                                            className={
                                                "px-5 py-2 rounded-full border transition " +
                                                (yPct === p ? "bg-pink-300 border-pink-300 text-white" : "bg-white/70 hover:bg-white")
                                            }
                                        >
                                            {p}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3) agr/ost: select */}
                            <div className="mt-8">
                                <div className="font-medium">
                                    Теперь зададим коэффициенты для наших свинок
                                    <span className="text-slate-500">
                                        {" "}
                                        (у честной = 1, рациональная = 1 − 1/n, n=4)
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm mb-2">Коэффициент агрессивной свинки</div>
                                        <select
                                            value={agr.toFixed(2)}
                                            onChange={(e) => {
                                                setAgr(Number(e.target.value));
                                                setRes(null);
                                                setCalcError("");
                                            }}
                                            className="border rounded-lg p-2 w-full bg-white/70"
                                        >
                                            {Array.from({ length: 8 }, (_, i) => (0.92 + i * 0.01).toFixed(2)).map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="text-sm mb-2">Коэффициент осторожной свинки</div>
                                        <select
                                            value={ost.toFixed(2)}
                                            onChange={(e) => {
                                                setOst(Number(e.target.value));
                                                setRes(null);
                                                setCalcError("");
                                            }}
                                            className="border rounded-lg p-2 w-full bg-white/70"
                                        >
                                            {Array.from({ length: 31 }, (_, i) => (0.60 + i * 0.01).toFixed(2)).map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* экран 3 генерация субъективных оценок */}

                    {step === 3 && (
                        <div className="mt-5">
                            <h2 className="text-xl font-semibold">Генерация оценок</h2>

                            <div className="mt-3 text-slate-700">
                                Теперь сгенерируем субъективные оценки для наших свинок-участников при заданном шуме{" "}
                                <span className="font-semibold">{yPct}%</span>
                            </div>

                            <div className="mt-2 text-sm text-slate-500">
                                Допустимый диапазон для каждой оценки: от <span className="font-semibold">{minVal}</span> до{" "}
                                <span className="font-semibold">{maxVal}</span> хрюблей
                            </div>

                            {/* две кнопки выбора режима */}
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    onClick={async () => {
                                        await generateValuations();
                                    }}
                                    className={
                                        "px-5 py-3 rounded-xl font-semibold transition " +
                                        (valuationMode === "auto"
                                            ? (genDone ? "bg-green-500 text-white" : "bg-pink-400 text-white hover:bg-pink-500")
                                            : "bg-white/70 border hover:bg-white")
                                    }
                                >
                                    {valuationMode === "auto" && genDone ? "Сгенерировано" : "Сгенерировать"}
                                </button>

                                <button
                                    onClick={startManualValuations}
                                    className={
                                        "px-5 py-3 rounded-xl font-semibold transition " +
                                        (valuationMode === "manual"
                                            ? (manualDone ? "bg-green-500 text-white" : "bg-pink-400 text-white hover:bg-pink-500")
                                            : "bg-white/70 border hover:bg-white")
                                    }
                                >
                                    {valuationMode === "manual" ? "Ручной выбор" : "Задать вручную"}
                                </button>
                            </div>

                            {/* если выбрали ручной режим */}
                            {valuationMode === "manual" && s && (
                                <div className="mt-6 space-y-5">
                                    <div className="rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Задайте оценки вручную</div>

                                        <div className="mt-5 space-y-5">
                                            <div>
                                                <div className="font-medium">🐽 Честная свинка: {s.sh}</div>
                                                <input
                                                    type="range"
                                                    min={minVal}
                                                    max={maxVal}
                                                    step={1}
                                                    value={s.sh}
                                                    onChange={(e) => changeManualValuation("sh", e.target.value)}
                                                    className="w-full mt-2"
                                                />
                                            </div>

                                            <div>
                                                <div className="font-medium">🐽 Рациональная свинка: {s.sr}</div>
                                                <input
                                                    type="range"
                                                    min={minVal}
                                                    max={maxVal}
                                                    step={1}
                                                    value={s.sr}
                                                    onChange={(e) => changeManualValuation("sr", e.target.value)}
                                                    className="w-full mt-2"
                                                />
                                            </div>

                                            <div>
                                                <div className="font-medium">🐽 Агрессивная свинка: {s.sa}</div>
                                                <input
                                                    type="range"
                                                    min={minVal}
                                                    max={maxVal}
                                                    step={1}
                                                    value={s.sa}
                                                    onChange={(e) => changeManualValuation("sa", e.target.value)}
                                                    className="w-full mt-2"
                                                />
                                            </div>

                                            <div>
                                                <div className="font-medium">🐽 Осторожная свинка: {s.so}</div>
                                                <input
                                                    type="range"
                                                    min={minVal}
                                                    max={maxVal}
                                                    step={1}
                                                    value={s.so}
                                                    onChange={(e) => changeManualValuation("so", e.target.value)}
                                                    className="w-full mt-2"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-lg">
                                        <div>🐽 Честная свинка оценивает лот на <span className="font-semibold">{s.sh}</span> хрюблей</div>
                                        <div>🐽 Рациональная свинка оценивает лот на <span className="font-semibold">{s.sr}</span> хрюблей</div>
                                        <div>🐽 Агрессивная свинка оценивает лот на <span className="font-semibold">{s.sa}</span> хрюблей</div>
                                        <div>🐽 Осторожная свинка оценивает лот на <span className="font-semibold">{s.so}</span> хрюблей</div>
                                    </div>
                                </div>
                            )}

                            {/* если выбрали автогенерацию */}
                            {valuationMode === "auto" && s && (
                                <div className="mt-6 space-y-2 text-lg">
                                    <div>🐽 Честная свинка оценивает лот на <span className="font-semibold">{s.sh}</span> хрюблей</div>
                                    <div>🐽 Рациональная свинка оценивает лот на <span className="font-semibold">{s.sr}</span> хрюблей</div>
                                    <div>🐽 Агрессивная свинка оценивает лот на <span className="font-semibold">{s.sa}</span> хрюблей</div>
                                    <div>🐽 Осторожная свинка оценивает лот на <span className="font-semibold">{s.so}</span> хрюблей</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* экран 4 — выбор формата аукциона */}
                    {step === 4 && (
                        <div className="mt-5">
                            {/* верхняя строка: заголовок + кнопка справка */}
                            <div className="flex items-start justify-between gap-4">
                                <h2 className="text-xl font-semibold">Теперь выберем формат аукциона</h2>

                                {/* справка — отдельная страница (пока пустая, потом распишем) */}
                                <Link
                                    href="/learning/help"
                                    className="px-3 py-2 rounded-xl border bg-white/70 hover:bg-white text-sm"
                                >
                                    Справка
                                </Link>
                            </div>

                            <p className="mt-3 text-slate-700 leading-relaxed">
                                Существует 2 типа аукционов: открытые — к ним относят Английский и Голландский аукционы, и
                                закрытые — среди них аукцион первой цены и Викри. В открытых аукционах все участники знают
                                ставки друг друга, в закрытых же круг ставок проходит тайно. Подробно о правилах аукционов,
                                их проведении вы можете узнать из справки.
                            </p>

                            <p className="mt-3 text-slate-700">
                                Каждый формат аукциона приводит к разным стратегиям ставок. Выберите формат, чтобы посмотреть
                                результат торгов.
                            </p>

                            {/* ГРУППА 1: ОТКРЫТЫЕ */}
                            <div className="mt-6">
                                <div className="text-sm font-semibold text-slate-600 mb-3">Открытые аукционы</div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: "english", title: "Английский", rules: "Открытые торги, цена растёт. Побеждает тот, кто выдержал до конца." },
                                        { id: "dutch", title: "Голландский", rules: "Открытые торги, цена падает. Первый, кто согласится — покупает." },
                                    ].map((c) => {
                                        const selected = format === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setFormat(c.id);
                                                    setRes(null);
                                                    setCalcError("");
                                                }}
                                                className={
                                                    "relative cursor-pointer rounded-2xl border shadow-sm p-4 transition " +
                                                    (selected
                                                        ? "bg-pink-300 border-pink-400"
                                                        : "bg-amber-200/90 border-amber-300 hover:bg-amber-200")
                                                }
                                            >
                                                {/* пасхалка-кнопка (не выбирает карточку, а открывает попап) */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInfoId(c.id);
                                                        setInfoOpen(true);
                                                    }}
                                                    className="absolute right-3 top-3 w-9 h-9 rounded-full border bg-white/70 hover:bg-white flex items-center justify-center"
                                                    title="Пояснение"
                                                >
                                                    ?
                                                </button>

                                                <div className="text-lg font-bold">{c.title}</div>
                                                <div className="mt-2 h-px bg-black/20" />
                                                <div className="mt-2 text-slate-800">{c.rules}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ГРУППА 2: ЗАКРЫТЫЕ */}
                            <div className="mt-8">
                                <div className="text-sm font-semibold text-slate-600 mb-3">Закрытые аукционы</div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: "first", title: "Первая цена", rules: "Закрытые ставки. Победитель платит свою ставку." },
                                        { id: "vickrey", title: "Викри", rules: "Закрытые ставки. Победитель платит вторую по величине ставку." },
                                    ].map((c) => {
                                        const selected = format === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setFormat(c.id);
                                                    setRes(null);
                                                    setCalcError("");
                                                }}
                                                className={
                                                    "relative cursor-pointer rounded-2xl border shadow-sm p-4 transition " +
                                                    (selected
                                                        ? "bg-pink-300 border-pink-400"
                                                        : "bg-amber-200/90 border-amber-300 hover:bg-amber-200")
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInfoId(c.id);
                                                        setInfoOpen(true);
                                                    }}
                                                    className="absolute right-3 top-3 w-9 h-9 rounded-full border bg-white/70 hover:bg-white flex items-center justify-center"
                                                    title="Пояснение"
                                                >
                                                    ?
                                                </button>

                                                <div className="text-lg font-bold">{c.title}</div>
                                                <div className="mt-2 h-px bg-black/20" />
                                                <div className="mt-2 text-slate-800">{c.rules}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* экран 5 результат */}
                    {step === 5 && (
                        <div className="mt-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-extrabold">Результат торгов</h2>
                                    <div className="mt-1 text-sm text-slate-600">
                                        Формат: <span className="font-semibold">{FORMATS.find(f => f.id === format)?.title || format}</span>
                                        <span className="mx-2">•</span>
                                        x = <span className="font-semibold">{x}</span>
                                        <span className="mx-2">•</span>
                                        шум = <span className="font-semibold">{yPct}%</span>
                                    </div>
                                </div>

                                {/* тут теперь кнопка посчитать, а не автопересчёт */}
                                <button
                                    onClick={calcOneUi}
                                    disabled={!s || calcLoading}
                                    className={
                                        "px-4 py-2 rounded-xl text-sm font-medium transition " +
                                        (!s || calcLoading
                                            ? "bg-slate-300 text-slate-600"
                                            : "bg-pink-500 text-white hover:bg-pink-600")
                                    }
                                >
                                    {calcLoading ? "Считаю..." : "Посчитать"}
                                </button>
                            </div>

                            {/* если оценок ещё нет */}
                            {!s && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5 text-sm text-slate-600">
                                    Сначала сгенерируйте оценки на экране 3.
                                </div>
                            )}

                            {/* если ошибка */}
                            {!!calcError && (
                                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                                    <div className="font-semibold text-red-700">Ошибка расчёта</div>
                                    <div className="text-sm text-red-700 mt-1">{calcError}</div>
                                </div>
                            )}

                            {/* пока считаем */}
                            {calcLoading && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                    <div className="font-semibold">Считаю результат…</div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        Сейчас сервер считает исход торгов для выбранного формата.
                                    </div>
                                </div>
                            )}

                            {/* Основа: слева детали, справа итог */}
                            {res && (
                                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
                                    {/* ЛЕВАЯ КОЛОНКА */}
                                    <div className="lg:col-span-2 space-y-5">
                                        {/* Оценки */}
                                        <div className="rounded-2xl border bg-white/70 p-5">
                                            <div className="text-lg font-bold">Субъективные оценки участников</div>

                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div
                                                    className={
                                                        "rounded-xl border p-4 transition " +
                                                        (res?.winner === 0
                                                            ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                            : "bg-white")
                                                    }
                                                >
                                                    <div className="text-sm text-slate-600">🐽 Честная</div>
                                                    <div className="text-2xl font-extrabold">
                                                        {s?.sh ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                    </div>
                                                </div>

                                                <div
                                                    className={
                                                        "rounded-xl border p-4 transition " +
                                                        (res?.winner === 1
                                                            ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                            : "bg-white")
                                                    }
                                                >
                                                    <div className="text-sm text-slate-600">🐽 Рациональная</div>
                                                    <div className="text-2xl font-extrabold">
                                                        {s?.sr ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                    </div>
                                                </div>

                                                <div
                                                    className={
                                                        "rounded-xl border p-4 transition " +
                                                        (res?.winner === 2
                                                            ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                            : "bg-white")
                                                    }
                                                >
                                                    <div className="text-sm text-slate-600">🐽 Агрессивная</div>
                                                    <div className="text-2xl font-extrabold">
                                                        {s?.sa ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                    </div>
                                                </div>

                                                <div
                                                    className={
                                                        "rounded-xl border p-4 transition " +
                                                        (res?.winner === 3
                                                            ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                            : "bg-white")
                                                    }
                                                >
                                                    <div className="text-sm text-slate-600">🐽 Осторожная</div>
                                                    <div className="text-2xl font-extrabold">
                                                        {s?.so ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ход торгов / ставки */}
                                        <div className="rounded-2xl border bg-white/70 p-5">
                                            <div className="text-lg font-bold">Как прошли торги</div>

                                            {Array.isArray(res?.log) && res.log.length > 0 ? (
                                                <div className="mt-3 space-y-2">
                                                    {res.log.map((line, i) => (
                                                        <div
                                                            key={i}
                                                            className="text-sm text-slate-700 bg-white border rounded-xl px-3 py-2"
                                                        >
                                                            {line}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-sm text-slate-600">
                                                    {fallbackLog}
                                                </div>
                                            )}

                                            {res?.bids && Array.isArray(res.bids) && (
                                                <div className="mt-4">
                                                    <div className="text-lg font-bold">Максимальные ставки с учётом стратегии</div>

                                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div
                                                            className={
                                                                "rounded-xl border p-4 " +
                                                                (res?.winner === 0
                                                                    ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                                    : "bg-white")
                                                            }
                                                        >
                                                            <div className="text-sm text-slate-600">🐽 Честная</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {res.bids[0]} <span className="text-base font-semibold">хрюблей</span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                ставка = {s?.sh}
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={
                                                                "rounded-xl border p-4 " +
                                                                (res?.winner === 1
                                                                    ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                                    : "bg-white")
                                                            }
                                                        >
                                                            <div className="text-sm text-slate-600">🐽 Рациональная</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {res.bids[1]} <span className="text-base font-semibold">хрюблей</span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                round(0.75 × {s?.sr}) = {res.bids[1]}
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={
                                                                "rounded-xl border p-4 " +
                                                                (res?.winner === 2
                                                                    ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                                    : "bg-white")
                                                            }
                                                        >
                                                            <div className="text-sm text-slate-600">🐽 Агрессивная</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {res.bids[2]} <span className="text-base font-semibold">хрюблей</span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                round({agr} × {s?.sa}) = {res.bids[2]}
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={
                                                                "rounded-xl border p-4 " +
                                                                (res?.winner === 3
                                                                    ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                                    : "bg-white")
                                                            }
                                                        >
                                                            <div className="text-sm text-slate-600">🐽 Осторожная</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {res.bids[3]} <span className="text-base font-semibold">хрюблей</span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                round({ost} × {s?.so}) = {res.bids[3]}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ПРАВАЯ КОЛОНКА */}
                                    <div className="space-y-5">
                                        {/* Главный итог */}
                                        <div className="rounded-2xl border bg-white p-5 shadow-sm">
                                            <div className="text-lg font-bold">Итог</div>

                                            <div className="mt-4 rounded-xl bg-pink-50 border border-pink-200 p-4">
                                                <div className="text-sm text-slate-600">🏆 Победитель</div>
                                                <div className="text-2xl font-extrabold">
                                                    {winnerLabel}
                                                </div>

                                                <div className="mt-3 text-sm text-slate-600">💰 Цена сделки</div>
                                                <div className="text-2xl font-extrabold">
                                                    {res?.price ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                </div>

                                                <div className="mt-3 text-sm text-slate-600">📌 Субъективный выигрыш</div>
                                                <div className="text-2xl font-extrabold">
                                                    {res?.subj ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                </div>

                                                <div className="mt-3 text-sm text-slate-600">📌 Ex post выигрыш</div>
                                                <div className="text-2xl font-extrabold">
                                                    {res?.exPost ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                                </div>
                                            </div>

                                            {/* Мини-вывод */}
                                            <div className="mt-4 text-sm text-slate-700 leading-relaxed">
                                                {format === "vickrey" &&
                                                    "В аукционе Викри победитель платит вторую цену, поэтому честная ставка часто безопасна."}
                                                {format === "first" &&
                                                    "В аукционе первой цены победитель платит свою ставку, поэтому участники обычно занижают ставки."}
                                                {format === "english" &&
                                                    "В английском аукционе цена растёт, и побеждает тот, кто дольше всех остаётся в торгах."}
                                                {format === "dutch" &&
                                                    "В голландском аукционе цена падает, и побеждает тот, кто первым согласился купить."}
                                            </div>
                                        </div>

                                        {/* Кто насколько доволен */}
                                        <div className="rounded-2xl border bg-white/70 p-5">
                                            <div className="text-lg font-bold">Кто насколько доволен</div>

                                            {res?.utilities && typeof res.utilities === "object" ? (
                                                <div className="mt-4 space-y-2">
                                                    {Object.entries(res.utilities).map(([k, v]) => (
                                                        <div
                                                            key={k}
                                                            className={
                                                                "flex items-center justify-between rounded-xl border bg-white px-4 py-3 " +
                                                                (Number(v) > 0
                                                                    ? "border-green-200"
                                                                    : Number(v) < 0
                                                                        ? "border-red-200"
                                                                        : "border-slate-200")
                                                            }
                                                        >
                                                            <div className="text-sm text-slate-700">{k}</div>
                                                            <div
                                                                className={
                                                                    "font-bold " +
                                                                    (Number(v) > 0
                                                                        ? "text-green-700"
                                                                        : Number(v) < 0
                                                                            ? "text-red-700"
                                                                            : "text-slate-700")
                                                                }
                                                            >
                                                                {v}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-sm text-slate-600">
                                                    Пока нет таблицы полезностей от сервера (можно добавить позже).
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* экран 6 сравнение форматов */}
                    {step === 6 && (
                        <div className="mt-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-extrabold">Сравнение форматов аукциона</h2>
                                    <div className="mt-2 text-slate-700">
                                        На одном и том же наборе субъективных оценок посмотрим, как разные правила
                                        аукциона влияют на победителя, цену и выигрыши.
                                    </div>
                                </div>

                                <button
                                    onClick={calcCompare}
                                    disabled={!s}
                                    className={
                                        "px-4 py-2 rounded-xl text-sm font-medium transition " +
                                        (!s
                                            ? "bg-slate-300 text-slate-600"
                                            : "bg-pink-500 text-white hover:bg-pink-600")
                                    }
                                >
                                    Сравнить форматы
                                </button>
                            </div>

                            {!s && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5 text-sm text-slate-600">
                                    Сначала сгенерируйте субъективные оценки на экране 3.
                                </div>
                            )}

                            {/* исходные данные */}
                            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Исходные параметры</div>

                                    <div className="mt-4 space-y-2 text-slate-700">
                                        <div>Истинная ценность лота: <span className="font-semibold">{x}</span></div>
                                        <div>Шум оценки: <span className="font-semibold">{yPct}%</span></div>
                                        <div>Коэффициент агрессивной свинки: <span className="font-semibold">{agr.toFixed(2)}</span></div>
                                        <div>Коэффициент осторожной свинки: <span className="font-semibold">{ost.toFixed(2)}</span></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Субъективные оценки участников</div>

                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">🐽 Честная</div>
                                            <div className="text-2xl font-extrabold">
                                                {s?.sh ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">🐽 Рациональная</div>
                                            <div className="text-2xl font-extrabold">
                                                {s?.sr ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">🐽 Агрессивная</div>
                                            <div className="text-2xl font-extrabold">
                                                {s?.sa ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">🐽 Осторожная</div>
                                            <div className="text-2xl font-extrabold">
                                                {s?.so ?? "—"} <span className="text-base font-semibold">хрюблей</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* карточки форматов */}
                            {results && (
                                <>
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {compareCards.map((card) => {
                                            const r = card.data;
                                            const winner = getWinnerName(r);
                                            const isMaxPrice = r?.price === maxPrice;
                                            const isMaxSubj = r?.subj === maxSubj;
                                            const isOverpay = (r?.exPost ?? 0) < 0;

                                            return (
                                                <div key={card.id} className="rounded-2xl border bg-white/70 p-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="text-lg font-bold">{card.title}</div>

                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            {isMaxPrice && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-pink-100 text-pink-700 border border-pink-200">
                                                                    самая высокая цена
                                                                </span>
                                                            )}
                                                            {isMaxSubj && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-200">
                                                                    макс. выигрыш
                                                                </span>
                                                            )}
                                                            {isOverpay && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 border border-red-200">
                                                                    переплата
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 space-y-3">
                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">🏆 Победитель</div>
                                                            <div className="text-2xl font-extrabold">{winner}</div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="rounded-xl border bg-white p-4">
                                                                <div className="text-sm text-slate-600">💰 Цена сделки</div>
                                                                <div className="text-2xl font-extrabold">
                                                                    {r?.price ?? "—"}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border bg-white p-4">
                                                                <div className="text-sm text-slate-600">📌 Субъективный выигрыш</div>
                                                                <div className="text-2xl font-extrabold">
                                                                    {r?.subj ?? "—"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">📌 Ex post выигрыш</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {r?.exPost ?? "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* таблица сравнения */}
                                    <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Сводная таблица сравнения</div>

                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead><tr className="text-left border-b">
                                                    <th className="py-3 pr-4">Формат</th>
                                                    <th className="py-3 pr-4">Победитель</th>
                                                    <th className="py-3 pr-4">Цена</th>
                                                    <th className="py-3 pr-4">Субъективный выигрыш</th>
                                                    <th className="py-3 pr-4">Ex post выигрыш</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                    {compareCards.map((card) => {
                                                        const r = card.data;
                                                        return (
                                                            <tr key={card.id} className="border-b last:border-b-0">
                                                                <td className="py-3 pr-4 font-medium">{card.title}</td>
                                                                <td className="py-3 pr-4">{getWinnerName(r)}</td>
                                                                <td className="py-3 pr-4">{r?.price ?? "—"}</td>
                                                                <td className="py-3 pr-4">{r?.subj ?? "—"}</td>
                                                                <td className="py-3 pr-4">{r?.exPost ?? "—"}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* вывод */}
                                    <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Вывод</div>

                                        <div className="mt-4 space-y-2 text-slate-700 leading-relaxed">
                                            <div>
                                                {sameWinner
                                                    ? `Во всех форматах победитель совпал: ${getWinnerName(compareCards[0].data)}.`
                                                    : "В разных форматах победители могут отличаться, потому что правила аукциона по-разному влияют на стратегии ставок."}
                                            </div>

                                            <div>
                                                Наибольшая цена сделки получилась в формате{" "}
                                                <span className="font-semibold">
                                                    {compareCards.find((c) => c.data?.price === maxPrice)?.title ?? "—"}
                                                </span>.
                                            </div>

                                            <div>
                                                Наибольший субъективный выигрыш победителя получился в формате{" "}
                                                <span className="font-semibold">
                                                    {compareCards.find((c) => c.data?.subj === maxSubj)?.title ?? "—"}
                                                </span>.
                                            </div>

                                            <div>
                                                {overpayFormats.length > 0
                                                    ? `Риск переплаты возник в форматах: ${overpayFormats.join(", ")}.`
                                                    : "В этом примере переплаты не возникло ни в одном формате."}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* экран 7 эксперимент */}
                    {step === 7 && (
                        <div className="mt-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-extrabold">Эксперимент (K прогонов)</h2>
                                    <div className="mt-2 text-slate-700">
                                        Здесь мы много раз запускаем аукционы и смотрим уже не на один пример,
                                        а на общую статистику по форматам.
                                    </div>
                                </div>

                                <button
                                    onClick={runExp}
                                    disabled={expFormats.length === 0 || K < 1}
                                    className={
                                        "px-4 py-2 rounded-xl text-sm font-medium transition " +
                                        (expFormats.length === 0 || K < 1
                                            ? "bg-slate-300 text-slate-600"
                                            : "bg-pink-500 text-white hover:bg-pink-600")
                                    }
                                >
                                    Запустить эксперимент
                                </button>
                            </div>

                            {/* параметры эксперимента */}
                            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Параметры эксперимента</div>

                                    <div className="mt-4 space-y-4">
                                        <div>
                                            <div className="text-sm text-slate-600 mb-2">Количество прогонов K</div>
                                            <input
                                                type="number"
                                                min={1}
                                                max={500}
                                                value={K}
                                                onChange={(e) => {
                                                    setK(Number(e.target.value));
                                                    setStats(null);
                                                }}
                                                className="border rounded-lg p-2 w-full bg-white"
                                            />
                                        </div>

                                        <div>
                                            <div className="text-sm text-slate-600 mb-2">Какие форматы включить</div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {EXP_FORMAT_OPTIONS.map((f) => (
                                                    <label
                                                        key={f.id}
                                                        className="flex items-center gap-3 rounded-xl border bg-white p-3 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={expFormats.includes(f.id)}
                                                            onChange={() => toggleExpFormat(f.id)}
                                                        />
                                                        <span>{f.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Текущие условия модели</div>

                                    <div className="mt-4 space-y-2 text-slate-700">
                                        <div>Истинная ценность лота: <span className="font-semibold">{x}</span></div>
                                        <div>Шум оценки: <span className="font-semibold">{yPct}%</span></div>
                                        <div>Коэффициент агрессивной свинки: <span className="font-semibold">{agr.toFixed(2)}</span></div>
                                        <div>Коэффициент осторожной свинки: <span className="font-semibold">{ost.toFixed(2)}</span></div>
                                    </div>

                                    <div className="mt-4 text-sm text-slate-600">
                                        В эксперименте эти параметры используются много раз, чтобы посмотреть
                                        общую закономерность, а не только один конкретный прогон.
                                    </div>
                                </div>
                            </div>

                            {/* если эксперимент ещё не запущен */}
                            {!stats && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5 text-sm text-slate-600">Пока статистики нет. Выберите количество прогонов и форматы,
                                    затем нажмите «Запустить эксперимент».
                                </div>
                            )}

                            {/* карточки статистики */}
                            {stats && (
                                <>
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {statCards.map((card) => {
                                            const d = card.data;
                                            const isMaxPrice = d?.avgPrice === maxAvgPrice;
                                            const isMaxSubj = d?.avgSubj === maxAvgSubj;
                                            const isMaxOverpay = d?.overpayRate === maxOverpayRate;

                                            return (
                                                <div key={card.id} className="rounded-2xl border bg-white/70 p-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="text-lg font-bold">{card.title}</div>

                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            {isMaxPrice && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-pink-100 text-pink-700 border border-pink-200">
                                                                    макс. средняя цена
                                                                </span>
                                                            )}
                                                            {isMaxSubj && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-200">
                                                                    макс. ср. выигрыш
                                                                </span>
                                                            )}
                                                            {isMaxOverpay && (
                                                                <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 border border-red-200">
                                                                    макс. переплата
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">Средняя цена</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgPrice ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">Средний субъективный выигрыш</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgSubj ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">Средний ex post выигрыш</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgExPost ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4">
                                                            <div className="text-sm text-slate-600">Доля переплат</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.overpayRate ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4"><div className="text-sm text-slate-600">Доля эффективных исходов</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.effRate ?? "—"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* если сервер присылает winRates по типам свинок */}
                                                    {d?.winRates && typeof d.winRates === "object" && (
                                                        <div className="mt-4 rounded-xl border bg-white p-4">
                                                            <div className="text-sm font-semibold text-slate-700 mb-3">
                                                                Win-rate по типам свинок
                                                            </div>

                                                            <div className="space-y-2 text-sm text-slate-700">
                                                                {Object.entries(d.winRates).map(([name, value]) => (
                                                                    <div key={name} className="flex items-center justify-between">
                                                                        <span>{name}</span>
                                                                        <span className="font-semibold">{value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* таблица */}
                                    <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Сводная таблица эксперимента</div>

                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="text-left border-b">
                                                        <th className="py-3 pr-4">Формат</th>
                                                        <th className="py-3 pr-4">Средняя цена</th>
                                                        <th className="py-3 pr-4">Средний субъективный выигрыш</th>
                                                        <th className="py-3 pr-4">Средний ex post выигрыш</th>
                                                        <th className="py-3 pr-4">Доля переплат</th>
                                                        <th className="py-3 pr-4">Доля эффективных исходов</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statCards.map((card) => {
                                                        const d = card.data;
                                                        return (
                                                            <tr key={card.id} className="border-b last:border-b-0">
                                                                <td className="py-3 pr-4 font-medium">{card.title}</td>
                                                                <td className="py-3 pr-4">{d?.avgPrice ?? "—"}</td>
                                                                <td className="py-3 pr-4">{d?.avgSubj ?? "—"}</td>
                                                                <td className="py-3 pr-4">{d?.avgExPost ?? "—"}</td>
                                                                <td className="py-3 pr-4">{d?.overpayRate ?? "—"}</td>
                                                                <td className="py-3 pr-4">{d?.effRate ?? "—"}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* вывод */}
                                    <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Вывод по эксперименту</div>

                                        <div className="mt-4 space-y-2 text-slate-700 leading-relaxed"><div>
                                            Самая высокая средняя цена получилась в формате{" "}
                                            <span className="font-semibold">
                                                {statCards.find((c) => c.data?.avgPrice === maxAvgPrice)?.title ?? "—"}
                                            </span>.
                                        </div>

                                            <div>
                                                Наибольший средний субъективный выигрыш победителя получился в формате{" "}
                                                <span className="font-semibold">
                                                    {statCards.find((c) => c.data?.avgSubj === maxAvgSubj)?.title ?? "—"}
                                                </span>.
                                            </div>

                                            <div>
                                                Самая высокая доля переплат наблюдалась в формате{" "}
                                                <span className="font-semibold">
                                                    {statCards.find((c) => c.data?.overpayRate === maxOverpayRate)?.title ?? "—"}
                                                </span>.
                                            </div>

                                            <div>
                                                Эксперимент помогает увидеть уже не один частный пример,
                                                а устойчивые различия между форматами аукционов.
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* кнопки навигации */}

                    <div className="mt-6 flex gap-3">

                        <button

                            onClick={goBack}

                            className="px-4 py-2 border rounded-xl"

                        >

                            Назад</button>

                        <button

                            onClick={goNext}

                            className="px-4 py-2 bg-pink-300 rounded-xl"

                        >

                            Дальше

                        </button>

                    </div>

                </div>

            </div>

            {/* модалка-пасхалка: затемнение + окно */}
            {
                infoOpen && (
                    <div className="fixed inset-0 z-50">
                        {/* затемнение */}
                        <div
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setInfoOpen(false)}
                        />

                        {/* окно */}
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border p-6 relative">
                                <div className="text-xl font-bold">
                                    {FORMAT_DETAILS[infoId]?.title ?? "Пояснение"}
                                </div>

                                <div className="mt-3 text-slate-700 leading-relaxed">
                                    {FORMAT_DETAILS[infoId]?.about ?? "Пока нет текста."}
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setInfoOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        Свернуть
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

        </main >
    );
}