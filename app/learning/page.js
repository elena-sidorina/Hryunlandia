"use client";

import { useMemo, useState, useEffect } from "react";
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
    { title: "Честная", key: "sh", img: "/pigs/honest_pig.png" },
    { title: "Рациональная", key: "sr", img: "/pigs/rational_pig.png" },
    { title: "Агрессивная", key: "sa", img: "/pigs/agressive_pig.png" },
    { title: "Осторожная", key: "so", img: "/pigs/cautious_pig.png" },
];

const PIG_DETAILS = [
    {
        title: "Честная свинка",
        img: "/pigs/honest_pig.png",
        color: "bg-blue-50 border-blue-200",
        text:
            "Не видит смысла специально сберегать хрюбли и готова поставить за лот всю свою субъективную оценку. В нашей модели она ставит по оценке во всех типах аукциона.",
    },
    {
        title: "Рациональная свинка",
        img: "/pigs/rational_pig.png",
        color: "bg-green-50 border-green-200",
        text:
            "Действует осторожно-расчётливо. В английском, голландском и аукционе первой цены она снижает ставку по формуле: при 4 участниках это примерно 75% от субъективной оценки. В Викри не шейдит и ставит по своей оценке.",
    },
    {
        title: "Агрессивная свинка",
        img: "/pigs/agressive_pig.png",
        color: "bg-rose-50 border-rose-200",
        text:
            "Хочет чаще выигрывать, поэтому обычно ставит близко к своей оценке. В английском, голландском и аукционе первой цены её базовый коэффициент — 0.95, но его можно немного изменить вручную. В Викри она не шейдит и ставит по субъективной оценке.",
    },
    {
        title: "Осторожная свинка",
        img: "/pigs/cautious_pig.png",
        color: "bg-yellow-50 border-yellow-200",
        text:
            "Боится переплатить, поэтому сильнее занижает ставку и раньше выходит из открытых торгов. Её коэффициент задаётся вручную на этом экране. В Викри она тоже не шейдит и ставит по своей субъективной оценке.",
    },
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
            "Закрытые ставки: каждый отправляет свою ставку тайно. Побеждает максимальная ставка и она же платится. Часто выгодно шейдить ставку относительно своей оценки, чтобы не переплатить.",
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

    const [pigsInfoOpen, setPigsInfoOpen] = useState(false);

    const [shadeInfoOpen, setShadeInfoOpen] = useState(false);

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
    const [stats, setStats] = useState(null);

    // для восстановления состояния (для справки)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get("restore") !== "1") return;

        const saved = sessionStorage.getItem("learningHelpState");
        if (!saved) return;

        try {
            const data = JSON.parse(saved);

            setMode(data.mode ?? null);
            setX(data.x ?? 120);
            setYPct(data.yPct ?? 10);
            setAgr(data.agr ?? 0.95);
            setOst(data.ost ?? 0.8);
            setFreeze(data.freeze ?? false);
            setSeed(data.seed ?? "");
            setS(data.s ?? null);
            setGenDone(data.genDone ?? false);
            setValuationMode(data.valuationMode ?? "auto");
            setManualDone(data.manualDone ?? false);
            setFormat(data.format ?? "vickrey");

            setRes(null);
            setResults(null);
            setStats(null);
            setCalcError("");

            setStep(4);
        } catch (e) {
            console.log("Не получилось восстановить состояние обучения", e);
        }
    }, []);

    // нижняя и верхняя границы для оценок свинок
    // считаем от ист ценности x и шума yPct
    const minVal = Math.max(0, Math.round(x - (x * yPct) / 100));
    const maxVal = Math.round(x + (x * yPct) / 100);

    // тут просто переводим индекс победителя в нормальное имя свинки
    const winnerPig =
        typeof res?.winner === "number" ? PIGS[res.winner] : null;

    // нормальное имя победтеля для вывода на экран
    const winnerLabel = winnerPig
        ? `${winnerPig.title} свинка`
        : res?.winnerTitle
            ? `${res.winnerTitle} свинка`
            : res?.winner ?? "—";

    // картинка для победителя
    const winnerImg =
        winnerPig?.img ??
        PIGS.find((p) => p.title === res?.winnerTitle)?.img ??
        null;

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

    function getBidFormula(p, value, bid) {
        if (format === "vickrey") {
            return `ставка = субъективная оценка = ${value}`;
        }
        if (p.key === "sh") {
            return `ставка = ${value}`;
        }
        if (p.key === "sr") {
            return `round(0.75 * ${value}) = ${bid}`;
        }
        if (p.key === "sa") {
            return `round(${agr.toFixed(2)} * ${value}) = ${bid}`;
        }
        if (p.key === "so") {
            return `round(${ost.toFixed(2)} * ${value}) = ${bid}`;
        }
        return `ставка = ${bid}`;
    }

    // красивые карточки создаем
    function getPigLabel(p) {
        return `${p.title} свинка`;
    }

    function formatPigLabel(name) {
        if (!name || name === "—") return "—";
        return String(name).includes("свин") ? String(name) : `${name} свинка`;
    }

    function renderPigCard(p, index, value, subText = null, markWinner = true) {
        const isWinner = markWinner && res?.winner === index;

        return (
            <div
                key={p.key}
                className={
                    "relative min-h-[116px] overflow-hidden rounded-xl border p-4 transition " +
                    (isWinner
                        ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                        : "bg-white")
                }
            >
                <div className="min-w-0 pr-20 sm:pr-24">
                    <div className="min-h-[54px] text-xs sm:text-sm text-slate-600 leading-tight break-words">
                        <div>🐽</div>
                        <div>{getPigLabel(p)}</div>
                    </div>

                    <div className="text-xl sm:text-2xl font-extrabold leading-tight break-words">
                        {value ?? "—"} <span className="text-sm sm:text-base font-semibold">хрюблей</span>
                    </div>

                    {subText && (
                        <div className="mt-1 text-xs text-slate-500">
                            {subText}
                        </div>
                    )}
                </div>

                <img
                    src={p.img}
                    alt={getPigLabel(p)}
                    className="absolute right-3 top-1/2 h-16 w-16 sm:h-20 sm:w-20 -translate-y-1/2 rounded-full border bg-white object-cover shadow-sm"
                />
            </div>
        );
    }

    // делаем слово "шейдить" кликабельным
    function renderShadeText(text) {
        return text.split(/(шейдить|шейдит|шейдят)/gi).map((part, i) => {
            const isShade = ["шейдить", "шейдит", "шейдят"].includes(part.toLowerCase());

            if (!isShade) return part;

            return (
                <button
                    key={i}
                    type="button"
                    onClick={() => setShadeInfoOpen(true)}
                    className="font-semibold text-pink-600 underline decoration-dotted underline-offset-4 hover:text-pink-700"
                >
                    {part}
                </button>
            );
        });
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
        if (step === 1) {
            window.location.href = "/home";
            return;
        }

        const flow = getFlow(mode);
        const i = flow.indexOf(step);
        if (i === -1) return;

        setStep(flow[Math.max(i - 1, 0)]);
    }

    // ф-ция для сохранения перед переходом в сравку
    function saveLearningHelpState() {
        sessionStorage.setItem(
            "learningHelpState",
            JSON.stringify({
                step: 4,
                mode,
                x,
                yPct,
                agr,
                ost,
                freeze,
                seed,
                s,
                genDone,
                valuationMode,
                manualDone,
                format,
            })
        );
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

            // в экспер всегда фикс число прогонов
            K: 100,

            // всегда сравниваем все 4 формата
            formats: ["english", "dutch", "first", "vickrey"],

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

        // если вдруг резултата нет (например ещё не нажали сравнить)
        if (!r) return "—";

        // если сервер уже присылает норм имя победителя, тогда просто используем его
        if (r.winnerTitle) return r.winnerTitle;

        // если победитель приходит как индекс, то переводим индекс в название свинки
        if (typeof r.winner === "number") {
            return PIGS[r.winner]?.title ?? "—";
        }

        // на всякий случай, если победитель пришёл строкой
        return r.winner ?? "—";
    }

    function getWinnerPigFromResult(r) {
        if (!r) return null;

        if (typeof r.winner === "number") {
            return PIGS[r.winner] ?? null;
        }

        if (r.winnerTitle) {
            return PIGS.find((p) => p.title === r.winnerTitle) ?? null;
        }

        return null;
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

    // в эксперименте всегда сравниваем 4 формата
    const EXP_K = 100;

    // проверяем, является ли текущий экран последним для выбранного режима
    const currentFlow = getFlow(mode);
    const isLastStep = step === currentFlow[currentFlow.length - 1];

    // норм список карточек  со статистикой
    const expCards = stats
        ? [
            {
                id: "english",
                title: "Английский",
                data: stats.english,
            },
            {
                id: "dutch",
                title: "Голландский",
                data: stats.dutch,
            },
            {
                id: "first",
                title: "Первая цена",
                data: stats.first,
            },
            {
                id: "vickrey",
                title: "Викри",
                data: stats.vickrey,
            },
        ]
        : [];

    // ищем свинку, которая выигрывает чаще всего
    function getTopWinner(winRates) {
        if (!winRates) return null;

        const entries = Object.entries(winRates);
        if (entries.length === 0) return null;

        let best = entries[0];

        for (let i = 1; i < entries.length; i++) {
            if (entries[i][1] > best[1]) {
                best = entries[i];
            }
        }

        return best[0];
    }

    return (

        <main className="min-h-screen bg-rose-100 px-4 py-6 sm:p-8">

            <div className="w-full max-w-3xl mx-auto">

                {/* кнопка назад на главную */}

                <a
                    href="/"
                    className="inline-flex items-center rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/90"
                >
                    ← На главную
                </a>

                <h1 className="text-3xl font-bold mt-4">
                    Режим обучения
                </h1>

                <div className="mt-6 bg-white/65 backdrop-blur-lg border rounded-2xl shadow p-5 sm:p-8">

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

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">

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

                            <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50/70 p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <div className="font-semibold text-slate-800">
                                            Хотите понять, как ведут себя участники?
                                        </div>
                                        <div className="mt-1 text-sm text-slate-600">
                                            Для изучения моделей поведения свинок можно открыть краткую справку по их стратегиям.
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setPigsInfoOpen(true)}
                                        className="shrink-0 rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-600"
                                    >
                                        🐽 Познакомиться со свинками
                                    </button>
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

                                {/* справка (расписали) */}
                                <Link
                                    href="/learning/help"
                                    onClick={saveLearningHelpState}
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
                                                {PIGS.map((p, i) =>
                                                    renderPigCard(p, i, s?.[p.key])
                                                )}
                                            </div>
                                        </div>

                                        {/* Ход торгов / ставки */}
                                        <div className="rounded-2xl border bg-white/70 p-5">
                                            <div className="text-lg font-bold">Как прошли торги</div>

                                            {res?.bids && Array.isArray(res.bids) && (
                                                <div className="mt-4">
                                                    <div className="text-base font-bold">
                                                        Максимальные ставки с учётом стратегии
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {PIGS.map((p, i) =>
                                                            renderPigCard(
                                                                p,
                                                                i,
                                                                res.bids[i],
                                                                getBidFormula(p, s?.[p.key], res.bids[i])
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-5">
                                                <div className="text-base font-bold">Ход торгов</div>

                                                {Array.isArray(res?.log) && res.log.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {res.log
                                                            .map((line) =>
                                                                String(line ?? "")
                                                                    .replace(/[\u200B-\u200D\uFEFF]/g, "")
                                                                    .trim()
                                                            )
                                                            .filter((line) => line.length > 0)
                                                            .map((line, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="rounded-xl border bg-white px-4 py-3 text-sm"
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
                                            </div>
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
                                                    renderShadeText("В аукционе Викри победитель платит вторую по величине ставку, поэтому свинкам невыгодно шейдить: они ставят ровно по своей субъективной оценке.")}
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
                                                            <div className="text-sm text-slate-700">{formatPigLabel(k)}</div>
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
                            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Исходные параметры</div>

                                    <div className="mt-4 space-y-2 text-slate-700">
                                        <div>Истинная ценность лота: <span className="font-semibold">{x}</span></div>
                                        <div>Шум оценки: <span className="font-semibold">{yPct}%</span></div>
                                        <div>Коэффициент агрессивной свинки: <span className="font-semibold">{agr.toFixed(2)}</span></div>
                                        <div>Коэффициент осторожной свинки: <span className="font-semibold">{ost.toFixed(2)}</span></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5 lg:col-span-2">
                                    <div className="text-lg font-bold">Субъективные оценки участников</div>

                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {PIGS.map((p) =>
                                            renderPigCard(p, -1, s?.[p.key], null, false)
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ставки с учетом стратегий */}
                            {s && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-lg font-bold">Ставки с учётом стратегий</div>
                                            <div className="mt-1 text-sm text-slate-600">
                                                Для английского, голландского и аукциона первой цены. В Викри свинки ставят по своей субъективной оценке.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b text-left">
                                                    <th className="py-3 pr-4">Свинка</th>
                                                    <th className="py-3 pr-4">Субъективная оценка</th>
                                                    <th className="py-3 pr-4">Ставка / порог</th>
                                                    <th className="py-3 pr-4">Как считается</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="py-3 pr-4 font-medium">🐽 Честная</td>
                                                    <td className="py-3 pr-4">{s.sh}</td>
                                                    <td className="py-3 pr-4 font-bold">{s.sh}</td>
                                                    <td className="py-3 pr-4 text-slate-600">ставка = оценка</td>
                                                </tr>

                                                <tr className="border-b">
                                                    <td className="py-3 pr-4 font-medium">🐽 Рациональная</td>
                                                    <td className="py-3 pr-4">{s.sr}</td>
                                                    <td className="py-3 pr-4 font-bold">{Math.round(0.75 * s.sr)}</td>
                                                    <td className="py-3 pr-4 text-slate-600">round(0.75 × {s.sr})</td>
                                                </tr>

                                                <tr className="border-b">
                                                    <td className="py-3 pr-4 font-medium">🐽 Агрессивная</td>
                                                    <td className="py-3 pr-4">{s.sa}</td>
                                                    <td className="py-3 pr-4 font-bold">{Math.round(agr * s.sa)}</td>
                                                    <td className="py-3 pr-4 text-slate-600">
                                                        round({agr.toFixed(2)} × {s.sa})
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td className="py-3 pr-4 font-medium">🐽 Осторожная</td>
                                                    <td className="py-3 pr-4">{s.so}</td>
                                                    <td className="py-3 pr-4 font-bold">{Math.round(ost * s.so)}</td>
                                                    <td className="py-3 pr-4 text-slate-600">
                                                        round({ost.toFixed(2)} × {s.so})
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* карточки форматов */}
                            {results && (
                                <>
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {compareCards.map((card) => {
                                            const r = card.data;
                                            const winner = getWinnerName(r);
                                            const winnerPig = getWinnerPigFromResult(r);
                                            const isMaxPrice = r?.price === maxPrice;
                                            const isMaxSubj = r?.subj === maxSubj;
                                            const isOverpay = (r?.exPost ?? 0) < 0;

                                            return (
                                                <div key={card.id} className="rounded-2xl border bg-white/70 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="text-lg font-bold">{card.title}</div>

                                                        <div className="flex flex-wrap gap-1 justify-end">
                                                            {isMaxPrice && (
                                                                <span className="px-2 py-1 rounded-full text-[11px] bg-pink-100 text-pink-700 border border-pink-200">
                                                                    макс. цена
                                                                </span>
                                                            )}
                                                            {isMaxSubj && (
                                                                <span className="px-2 py-1 rounded-full text-[11px] bg-green-100 text-green-700 border border-green-200">
                                                                    макс. выигрыш
                                                                </span>
                                                            )}
                                                            {isOverpay && (
                                                                <span className="px-2 py-1 rounded-full text-[11px] bg-red-100 text-red-700 border border-red-200">
                                                                    переплата
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <div className="col-span-2 rounded-xl border bg-white p-2.5 min-w-0">
                                                            <div className="text-xs text-slate-600">Победитель</div>

                                                            <div className="mt-1.5 flex items-center gap-2">
                                                                {winnerPig && (
                                                                    <img
                                                                        src={winnerPig.img}
                                                                        alt={`${winnerPig.title} свинка`}
                                                                        className="h-9 w-9 shrink-0 rounded-full border bg-white object-cover"
                                                                    />
                                                                )}

                                                                <div className="text-base font-extrabold leading-tight">
                                                                    {formatPigLabel(winner)}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-2.5 min-w-0">
                                                            <div className="text-xs text-slate-600">Цена</div>
                                                            <div className="mt-1 text-lg font-extrabold">
                                                                {r?.price ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-2.5 min-w-0">
                                                            <div className="text-xs text-slate-600">π_subj</div>
                                                            <div className="mt-1 text-lg font-extrabold">
                                                                {r?.subj ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-2.5 min-w-0">
                                                            <div className="text-xs text-slate-600">π_ex</div>
                                                            <div className="mt-1 text-lg font-extrabold">
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
                                                    ? `Во всех форматах победитель совпал: ${getWinnerName(compareCards[0].data)} свинка.`
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
                                    <h2 className="text-2xl font-extrabold">Эксперимент: сравнение аукционов</h2>
                                    <div className="mt-2 text-slate-700">
                                        Здесь мы много раз запускаем все 4 формата аукциона и смотрим,
                                        какие закономерности проявляются
                                    </div>
                                </div>

                                <button
                                    onClick={runExp}
                                    className="px-4 py-2 rounded-xl text-sm font-medium bg-pink-500 text-white hover:bg-pink-600 transition"
                                >
                                    Запустить эксперимент
                                </button>
                            </div>

                            <div className="mt-6 rounded-2xl border bg-pink-50/70 p-5">
                                <div className="text-lg font-bold">Как пользоваться экраном</div>

                                <div className="mt-3 space-y-2 text-slate-700 leading-relaxed">
                                    <div>
                                        Запустите эксперимент несколько раз, а затем вернитесь назад и поменяйте параметры модели, чтобы лучше понять, как работают разные аукционы и как поведение ботов зависит от настроек.
                                    </div>

                                    <div>
                                        Попробуйте менять шум оценки, коэффициенты агрессивной и осторожной
                                        свинок, а потом снова запускать эксперимент и сравнивать результаты.
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                <div className="text-lg font-bold">Условия эксперимента</div>

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                                    <div>Истинная ценность лота: <span className="font-semibold">{x}</span></div>
                                    <div>Шум оценки: <span className="font-semibold">{yPct}%</span></div>
                                    <div>Коэффициент агрессивной свинки: <span className="font-semibold">{agr.toFixed(2)}</span></div>
                                    <div>Коэффициент осторожной свинки: <span className="font-semibold">{ost.toFixed(2)}</span></div>
                                    <div>Количество прогонов: <span className="font-semibold">{EXP_K}</span></div>
                                    <div>Сравниваем форматы: <span className="font-semibold">все 4</span></div>
                                </div>
                            </div>

                            {!stats && (
                                <div className="mt-6 rounded-2xl border bg-white/70 p-5 text-sm text-slate-600">
                                    Пока статистики нет. Нажмите «Запустить эксперимент», чтобы сравнить
                                    все 4 формата аукциона.
                                </div>
                            )}

                            {stats && (
                                <>
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {expCards.map((card) => {
                                            const d = card.data;
                                            const topWinner = getTopWinner(d?.winRates);

                                            return (
                                                <div key={card.id} className="rounded-2xl border bg-white/70 p-5">
                                                    <div className="text-lg font-bold">{card.title}</div>

                                                    <div className="mt-4">
                                                        <div className="text-sm font-semibold text-slate-700 mb-3">
                                                            Кто как часто выигрывает
                                                        </div>

                                                        <div className="space-y-2">
                                                            {d?.winRates && Object.entries(d.winRates).map(([name, value]) => {
                                                                const isTop = name === topWinner;

                                                                return (
                                                                    <div
                                                                        key={name}
                                                                        className={
                                                                            "flex items-center justify-between rounded-xl border px-4 py-3 " +
                                                                            (isTop
                                                                                ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200"
                                                                                : "bg-white border-slate-200")
                                                                        }
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{name}</span>
                                                                            {isTop && <span>👑</span>}
                                                                        </div>

                                                                        <div className="font-bold">
                                                                            {value}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* карточки метрик эксперимента */}
                                                    {/* на телефоне в 1 колонку, на больших экранах в 2 */}
                                                    <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                        <div className="rounded-xl border bg-white p-4 min-w-0">
                                                            <div className="text-sm text-slate-600">Средняя цена сделки</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgPrice ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4 min-w-0">
                                                            <div className="text-sm text-slate-600">Средний субъективный выигрыш</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgSubj ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4 min-w-0">
                                                            <div className="text-sm text-slate-600">Средний ex post выигрыш</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.avgExPost ?? "—"}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-xl border bg-white p-4 min-w-0">
                                                            <div className="text-sm text-slate-600">Доля переплат</div>
                                                            <div className="text-2xl font-extrabold">
                                                                {d?.overpayRate ?? "—"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* блок викри отдельно от сетки, иначе он ломал карточки на телефоне */}
                                                    {card.id === "vickrey" && (
                                                        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 leading-relaxed">
                                                            В аукционе Викри участники не искажают ставки, поэтому распределение побед
                                                            обычно получается более ровным, чем в стратегических форматах.
                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-6 rounded-2xl border bg-white/70 p-5">
                                        <div className="text-lg font-bold">Что можно заметить по результатам</div>

                                        <div className="mt-4 space-y-3 text-slate-700 leading-relaxed">
                                            <div>
                                                Этот экран показывает уже не один случайный пример, а более устойчивые различия
                                                между форматами аукциона на большом числе прогонов.
                                            </div>

                                            <div>
                                                Голландский аукцион и аукцион первой цены дают одинаковую статистику,
                                                потому что в нашей модели у них фактически одна и та же стратегическая логика:
                                                участники ориентируются на свои максимальные ставки с учётом стратегии, и именно
                                                максимальная такая ставка определяет победителя и цену сделки.
                                            </div>

                                            <div>
                                                Английский аукцион отличается: здесь тоже побеждает участник с наибольшей
                                                максимальной ставкой, но цена обычно ниже, потому что победителю достаточно
                                                перебить ближайшего конкурента. Поэтому в стандартной ситуации итоговая цена
                                                равна второй наибольшей максимальной ставке плюс 1 хрюбль.
                                            </div>

                                            <div>
                                                {renderShadeText(
                                                    "В Викри участники не шейдят ставки, а ставят по своей субъективной оценке. Поэтому средняя цена сделки обычно выше, чем в английском аукционе: Викри опирается на вторую полную оценку, а английский — на вторую максимальную ставку с учётом стратегии. С голландским аукционом и первой ценой сравнение не всегда однозначное: иногда Викри выше, иногда ниже, потому что в этих форматах цена определяется максимумом заниженных стратегических ставок."
                                                )}
                                            </div>

                                            <div>
                                                При базовых параметрах в стратегических форматах чаще всего побеждает честная
                                                свинка, заметную долю побед получает агрессивная, а рациональная почти не
                                                выигрывает, потому что сильнее занижает ставку по формуле.
                                            </div>

                                            <div>
                                                Поэтому полезно запускать эксперимент несколько раз и менять параметры модели:
                                                так лучше видно, как правила аукциона и стратегии свинок влияют на цену,
                                                победителя и риск переплаты.
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
                            className="px-4 py-2 rounded-xl border bg-white/70 hover:bg-white"
                        >
                            Назад
                        </button>

                        {!isLastStep && (
                            <button
                                onClick={goNext}
                                disabled={!canNext}
                                className={
                                    "px-4 py-2 rounded-xl transition " +
                                    (canNext
                                        ? "bg-pink-300 hover:bg-pink-400"
                                        : "bg-slate-200 text-slate-500 cursor-not-allowed")
                                }
                            >
                                Дальше
                            </button>
                        )}
                    </div>

                </div>

            </div>

            {/* модалка-пасхалка: затемнение+ окно */}
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
                                    {renderShadeText(FORMAT_DETAILS[infoId]?.about ?? "Пока нет текста.")}
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

            {/* модалка со свинками */}
            {
                pigsInfoOpen && (
                    <div className="fixed inset-0 z-50">
                        <div
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setPigsInfoOpen(false)}
                        />

                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border bg-white p-6 shadow-xl">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-2xl font-extrabold">
                                            🐽 Кто участвует в торгах?
                                        </div>
                                        <div className="mt-2 max-w-3xl text-sm text-slate-600 leading-relaxed">
                                            У каждой свинки есть своя субъективная оценка лота и свой стиль поведения.{" "}
                                            {renderShadeText(
                                                "В стратегических форматах свинки могут шейдить ставку, а в Викри все ставят по своей субъективной оценке."
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setPigsInfoOpen(false)}
                                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        Закрыть
                                    </button>
                                </div>

                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {PIG_DETAILS.map((pig) => (
                                        <div
                                            key={pig.title}
                                            className={`rounded-2xl border p-4 ${pig.color}`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={pig.img}
                                                    alt={pig.title}
                                                    className="h-24 w-24 shrink-0 rounded-full border bg-white object-cover shadow-sm"
                                                />

                                                <div>
                                                    <div className="text-lg font-extrabold">
                                                        {pig.title}
                                                    </div>
                                                    <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                                                        {renderShadeText(pig.text)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 rounded-2xl border bg-white/80 p-4 text-sm text-slate-700 leading-relaxed">
                                    <span className="font-semibold">Важно:</span>{" "}
                                    коэффициенты агрессивной и осторожной свинки можно менять на экране параметров.
                                    Это позволяет посмотреть, как более рискованное или более осторожное поведение влияет
                                    на победителя, цену сделки и выигрыш.
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* модалка про шейдинг */}
            {shadeInfoOpen && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShadeInfoOpen(false)}
                    />

                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-xl">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-2xl font-extrabold">
                                        Что значит шейдить?
                                    </div>

                                    <div className="mt-3 space-y-3 text-sm text-slate-700 leading-relaxed">
                                        <p>
                                            Шейдить - это от английского bid shading, то есть занижать
                                            ставку относительно своей оценки лота.
                                        </p>

                                        <p>
                                            Например, свинка оценивает лот в 100 хрюблей. Если она
                                            является осторожной, то она шейдит и ставит:
                                        </p>

                                        <div className="rounded-2xl border bg-pink-50 p-4 font-semibold text-slate-800">
                                            0.8*100=80 хрюблей
                                        </div>

                                        <p>
                                            Зачем шейдить: чтобы не просто выиграть лот, а ещё и оставить
                                            себе выгоду. Потому что если участник оценивает лот в 100 и
                                            платит 100, его выигрыш примерно 0.
                                        </p>

                                        <p>
                                            А если он оценивает лот в 100, но покупает за 80, то
                                            субъективный выигрыш равен:
                                        </p>

                                        <div className="rounded-2xl border bg-green-50 p-4 font-semibold text-slate-800">
                                            100-80=20 хрюблей
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShadeInfoOpen(false)}
                                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    Закрыть
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </main >
    );
}