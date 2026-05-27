"use client";

import { useEffect, useMemo, useState, useRef } from "react";

const FORMATS = [
    {
        id: "english",
        title: "Английский",
        desc: "Цена растёт, участники повышают, выигрывает последний активный.",
    },
    {
        id: "dutch",
        title: "Голландский",
        desc: "Цена падает, кто первым согласится — забирает лот.",
    },
    {
        id: "first",
        title: "Первая цена",
        desc: "Все тайно подают ставку, победитель платит свою.",
    },
    {
        id: "vickrey",
        title: "Викри",
        desc: "Все тайно подают ставку, победитель платит вторую цену.",
    },
];

const BOT_TITLES = {
    honest: "Честная",
    aggressive: "Агрессивная",
    rational: "Рациональная",
    cautious: "Осторожная",
};

const BOT_OPTIONS = [
    { id: "honest", title: "Честная" },
    { id: "aggressive", title: "Агрессивная" },
    { id: "rational", title: "Рациональная" },
    { id: "cautious", title: "Осторожная" },
];

const BOT_IMAGES = {
    honest: "/pigs/honest_pig.png",
    aggressive: "/pigs/agressive_pig.png",
    rational: "/pigs/rational_pig.png",
    cautious: "/pigs/cautious_pig.png",
};

const GAME_PIG_DETAILS = [
    {
        title: "Честная свинка",
        img: "/pigs/honest_pig.png",
        color: "bg-blue-50 border-blue-200",
        text:
            "Ставит прямо по своей субъективной оценке. Она не видит смысла специально сберегать хрюбли и готова поставить за лот всю сумму, которую сама считает справедливой.",
    },
    {
        title: "Рациональная свинка",
        img: "/pigs/rational_pig.png",
        color: "bg-green-50 border-green-200",
        text:
            "Аккуратно снижает ставку по формуле. В первой цене, голландском и английском аукционе она обычно ставит примерно 1 − 1/n от своей оценки, где n — число участников. В Викри не шейдит и ставит по оценке.",
    },
    {
        title: "Агрессивная свинка",
        img: "/pigs/agressive_pig.png",
        color: "bg-rose-50 border-rose-200",
        text:
            "Старается чаще выигрывать и ставит близко к своей оценке. В первой цене, голландском и английском аукционе обычно ориентируется примерно на 95% своей оценки. В английском аукционе иногда делает резкий прыжок ставки на +2 или +3 хрюбля. В Викри не шейдит и ставит по оценке.",
    },
    {
        title: "Осторожная свинка",
        img: "/pigs/cautious_pig.png",
        color: "bg-yellow-50 border-yellow-200",
        text:
            "Боится переплатить, поэтому сильнее занижает ставку и раньше выходит из открытых торгов. Её цель — сохранить банк и не купить лот слишком дорого. В Викри тоже ставит по своей субъективной оценке.",
    },
];

async function apiPost(payload) {
    const r = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!data.ok) {
        throw new Error(data.error || "API error");
    }

    return data;
}

export default function GamePage() {
    // экраны игры
    const [screen, setScreen] = useState("intro");

    // настройки серии
    const [format, setFormat] = useState("english");
    const [lots, setLots] = useState(5);
    const [botCount, setBotCount] = useState(3);
    const [yPct, setYPct] = useState(10);
    const [tokensEnabled, setTokensEnabled] = useState(true);
    const [seed, setSeed] = useState("");

    // данные серии
    const [game, setGame] = useState(null);
    const [lot, setLot] = useState(null);
    const [summary, setSummary] = useState(null);
    const [guessMode, setGuessMode] = useState("closed");
    const [botGuesses, setBotGuesses] = useState({});
    const [guessesChecked, setGuessesChecked] = useState(false);
    const [metricInfo, setMetricInfo] = useState(null);

    // локальные штучки
    const [userBid, setUserBid] = useState(0);
    const [busy, setBusy] = useState(false);
    const [dutchPaused, setDutchPaused] = useState(false);
    const [pigsInfoOpen, setPigsInfoOpen] = useState(false);
    const actionLockRef = useRef(false);
    const [quickTipOpen, setQuickTipOpen] = useState(false);

    const isOpen = format === "english" || format === "dutch";
    const seedReady = seed.trim().length > 0;

    // если меняем формат, то варианты лотов тоже подстраиваем
    useEffect(() => {
        if (isOpen && ![3, 5, 7].includes(lots)) {
            setLots(5);
        }

        if (!isOpen && ![5, 7, 9].includes(lots)) {
            setLots(5);
        }
    }, [format]);

    // старт серии
    async function startSeries() {
        if (!seedReady) return;

        const data = await apiPost({
            mode: "start",
            format,
            lots,
            botCount,
            yPct,
            tokensEnabled,
            seed: seed.trim(),
        });

        setGame(data.game);
        setLot(null);
        setSummary(null);
        setUserBid(0);
        setGuessMode("closed");
        setBotGuesses({});
        setGuessesChecked(false);
        setScreen("lot_start");
    }

    // старт лота
    async function beginLot(useToken) {
        const data = await apiPost({
            mode: "new_lot",
            game,
            useToken,
        });

        let nextGame = game;

        if (game.tokensEnabled && game.tokensLeft > 0 && useToken) {
            nextGame = {
                ...game,
                tokensLeft: game.tokensLeft - 1,
            };
            setGame(nextGame);
        }

        let nextLot = data.lot;

        if (game.format === "dutch") {
            const prep = await apiPost({
                mode: "dutch_prepare",
                game: nextGame,
                lot: nextLot,
            });

            nextLot = prep.lot;
        }

        setLot(nextLot);
        setDutchPaused(false);
        setUserBid(0);
        setScreen("auction");
    }

    // один ход свинки в английском (!)
    async function englishBotStep() {
        if (!game || !lot || busy || actionLockRef.current) return;

        actionLockRef.current = true;
        setBusy(true);

        try {
            const data = await apiPost({
                mode: "english_bot_step",
                game,
                lot,
            });

            setLot(data.lot);

            if (data.lot.isFinished) {
                setScreen("lot_result");
            }
        } finally {
            setBusy(false);
            actionLockRef.current = false;
        }
    }

    // действие игрока в английском
    async function englishUserAction(action) {
        if (!game || !lot || busy || actionLockRef.current) return;

        actionLockRef.current = true;
        setBusy(true);

        try {
            const data = await apiPost({
                mode: "english_user_action",
                game,
                lot,
                action,
            });

            const nextLot = data.lot;

            setLot(nextLot);

            if (nextLot.isFinished) {
                setScreen("lot_result");
            }
        } finally {
            setBusy(false);
            actionLockRef.current = false;
        }
    }

    // ставка в закрытом аукционе
    async function submitClosedBid(kind) {
        const mode = kind === "first" ? "first_price" : "vickrey";

        const data = await apiPost({
            mode,
            game,
            lot,
            userBid,
        });

        setLot(data.lot);
        setScreen("lot_result");
    }

    // применяем результат лота
    async function settleAndNext() {
        const data = await apiPost({
            mode: "settle",
            game,
            lot,
        });

        const nextGame = data.game;

        setGame(nextGame);
        setLot(null);

        if (nextGame.currentLot > nextGame.lots) {
            const s = await apiPost({
                mode: "finish",
                game: nextGame,
            });

            setSummary(s.summary);
            setScreen("summary");
        } else {
            setScreen("lot_start");
        }
    }

    // автоходы свинок в английском
    useEffect(() => {
        if (screen !== "auction") return;
        if (!game || !lot) return;
        if (game.format !== "english") return;
        if (lot.isFinished) return;

        // свинки ходят сами только в режиме ожидания
        if (lot.phase !== "waiting") return;

        const t = setTimeout(() => {
            englishBotStep();
        }, 3000);

        return () => clearTimeout(t);
    }, [screen, game, lot]);

    // ответ свинки в дуэли тоже через 3 секунды
    useEffect(() => {
        if (screen !== "auction") return;
        if (!game || !lot) return;
        if (game.format !== "english") return;
        if (lot.isFinished) return;
        if (busy || actionLockRef.current) return;

        // в дуэли свинка отвечает только если сейчас лидирует игрок
        if (lot.phase !== "duel") return;
        if (lot.leader !== "user") return;

        const t = setTimeout(async () => {
            if (actionLockRef.current) return;

            actionLockRef.current = true;
            setBusy(true);

            try {
                const data = await apiPost({
                    mode: "english_duel_bot_step",
                    game,
                    lot,
                });

                setLot(data.lot);

                if (data.lot.isFinished) {
                    setScreen("lot_result");
                }
            } finally {
                setBusy(false);
                actionLockRef.current = false;
            }
        }, 3000);

        return () => clearTimeout(t);
    }, [screen, game, lot, busy]);

    // падение цены в голландском
    useEffect(() => {
        if (screen !== "auction") return;
        if (!game || !lot) return;
        if (game.format !== "dutch") return;
        if (lot.isFinished) return;
        if (dutchPaused) return;

        const t = setTimeout(() => {
            setLot((prev) => {
                if (!prev) return prev;

                const nextPrice = Math.max(0, prev.price - 1);
                const nextLogs = [...prev.logs, `Цена упала до ${nextPrice}`];

                // смотрим, готова ли какая-то свинка забрать лот
                const botWinner = Object.entries(prev.botThresholds || {})
                    .filter(([id, thr]) => game.botBanks[id] >= nextPrice && nextPrice <= thr)
                    .map(([id]) => id)[0];

                if (botWinner) {
                    return {
                        ...prev,
                        price: nextPrice,
                        logs: [...nextLogs, `Свин ${botWinner} купил лот за ${nextPrice}`],
                        isFinished: true,
                        winner: botWinner,
                        paid: nextPrice,
                    };
                }

                if (nextPrice === 0) {
                    return {
                        ...prev,
                        price: 0,
                        logs: [...nextLogs, "Лот остался непроданным"],
                        isFinished: true,
                        winner: null,
                        paid: 0,
                    };
                }

                return {
                    ...prev,
                    price: nextPrice,
                    logs: nextLogs,
                };
            });
        }, 2000);

        return () => clearTimeout(t);
    }, [screen, game, lot, dutchPaused]);

    // если в голландском лот закончился, открываем результат
    useEffect(() => {
        if (screen === "auction" && game?.format === "dutch" && lot?.isFinished) {
            setScreen("lot_result");
        }
    }, [screen, game, lot]);

    const playerRows = useMemo(() => {
        if (!game) return [];

        return [
            { id: "user", title: "🐱 Вы" },
            ...Array.from({ length: game.botCount }, (_, i) => ({
                id: String(i + 1),
                title: `🐷 Свин ${i + 1}`,
            })),
        ];
    }, [game]);

    // что показывать на экране результата лота
    const lotResultUserWon = lot?.winner === "user";

    const lotResultBank = game && lot
        ? game.userBank - (lotResultUserWon ? lot.paid : 0)
        : 0;

    const lotResultWins = game && lot
        ? game.userWins + (lotResultUserWon ? 1 : 0)
        : 0;

    const lotResultPiSubj = lot
        ? lot.userValue - lot.paid
        : 0;

    const lotResultPiEx = lot
        ? lot.x - lot.paid
        : 0;

    const lotResultUserBid =
        lot?.userBid ??
        lot?.lastUserBid ??
        null;

    // путь к картинке текущ лота
    // если lotImageId=7, то покажется public/lots/lot7.jpg
    // в Next путь начинается сразу с /lots
    const lotImageSrc = lot?.lotImageId
        ? `/lots/lot${lot.lotImageId}.jpg`
        : null;

    const lotResultAvatar =
        lot?.winner === "user"
            ? "/pigs/user_kitty.png"
            : lot?.winner
                ? "/pigs/mischievous_pig.png"
                : null;

    const lotResultWinnerText =
        lot?.winner === "user"
            ? "Вы"
            : lot?.winner
                ? `Свин ${lot.winner}`
                : "Никто";

    const lotResultMood =
        lot?.winner === "user"
            ? (lotResultPiEx < 0
                ? "Лот оказался убыточным по истинной ценности"
                : "Лот оказался выгодным по истинной ценности")
            : lot?.winner
                ? "Лот забрала скрытая свинка-соперник"
                : "Лот остался непроданным";

    const metricTexts = {
        finalValue: {
            title: "Итоговое состояние по истинной ценности",
            text: "Это стартовый банк плюс суммарный ex post выигрыш минус штраф. Так мы учитываем не только оставшиеся деньги, но и реальную ценность купленных лотов.",
        },
        subj: {
            title: "Суммарный субъективный выигрыш",
            text: "Показывает, насколько купленные лоты были выгодны по вашим субъективным оценкам. Считается как сумма: ваша оценка лота минус цена покупки.",
        },
        ex: {
            title: "Суммарный ex post выигрыш",
            text: "Показывает реальный результат покупок по истинной ценности лотов. Считается как сумма: истинная ценность лота минус цена покупки.",
        },
        roi: {
            title: "ROI по истинной ценности",
            text: "Показывает доходность покупок относительно потраченной суммы. Если ROI отрицательный, значит по истинной ценности покупки в среднем были невыгодны.",
        },
        penalty: {
            title: "Штраф за пассивность",
            text: "Если за серию куплено меньше минимального числа лотов, из итогового банка вычитается штраф 100 хрюблей.",
        },
    };

    return (
        <main className="min-h-screen bg-rose-100 px-4 py-6 sm:p-8">
            <div className="w-full max-w-3xl mx-auto py-6 sm:py-10">
                <a
                    href="/"
                    className="inline-flex items-center rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/90"
                >
                    ← На главную
                </a>

                <h1 className="text-3xl font-bold mt-4">Режим игры</h1>

                <div className="mt-6 bg-white/80 border rounded-2xl shadow p-5 sm:p-8">

                    {/* вводный экран */}
                    {screen === "intro" && (
                        <div className="w-full">
                            <h2 className="text-2xl font-extrabold">✨ Поздравляем!</h2>

                            <div className="mt-5 max-w-5xl space-y-5 text-lg text-slate-700 leading-relaxed">
                                <div>
                                    Свин-аукционер лично пригласил Вас на ежегодный аукцион.
                                </div>

                                <div>
                                    Каждый год свинки собираются здесь, чтобы профинансировать
                                    экспедиции в неизведанные леса в поисках легендарных трюфелей.
                                </div>

                                <div>
                                    В торгах участвуют лучшие из лучших: рациональный, агрессивный,
                                    честный и осторожный свин — у каждого своя стратегия и свой подход к ставкам.
                                </div>

                                <div>
                                    Если Вы ещё не знакомы с их поведением, настоятельно рекомендуем
                                    пройти режим «Обучение» — иначе выработать эффективную стратегию будет непросто.
                                </div>

                                <div>
                                    Ой, чуть не забыли…
                                    Свин-аукционер настоятельно просит Вас не разочаровать его.
                                    Если к концу аукциона Вы не приобретёте хотя бы четверть лотов,
                                    Вас ждёт штраф — 100 хрюблей. Хихик 🐽
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setScreen("format")}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Конечно
                                </button>

                                <a
                                    href="/learning"
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Вернуться к режиму «Обучение»
                                </a>
                            </div>
                        </div>
                    )}

                    {/* выбор формата */}
                    {screen === "format" && (
                        <div>
                            <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.35fr] gap-5 items-start">
                                {/* левая колонка */}
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <h2 className="text-2xl font-semibold">Выберите тип аукциона</h2>

                                            <div className="relative shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickTipOpen((v) => !v)}
                                                    className="px-3 py-2 rounded-xl border bg-white/70 hover:bg-white text-sm"
                                                >
                                                    Быстрая подсказка
                                                </button>

                                                {quickTipOpen && (
                                                    <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-white shadow-lg p-4 z-20">
                                                        <div className="text-sm text-slate-700 leading-relaxed">
                                                            В английском не спешите переплачивать, в голландском заранее
                                                            определите порог, в первой цене шейдите ставку, а в Викри выгодно ставить по своей оценке.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-2 text-base text-slate-700 leading-relaxed">
                                            В Хрюнляндии используют 4 формата торгов: два открытых и два закрытых.
                                            У каждого формата свои правила, темп и оптимальная стратегия. Вы не будете знать к какому архетипу
                                            относятся ваши соперники-свинки, не дайте им себя обмануть.
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-pink-200 bg-pink-50 p-4">
                                        <div className="text-lg font-semibold text-pink-800">Перед стартом серии</div>
                                        <div className="mt-1.5 text-base text-slate-700 leading-relaxed">
                                            Если Вы хотите лучше понимать поведение свинок и механику торгов,
                                            сначала загляните в режим «Обучение». Там можно посмотреть, как
                                            работают 4 аукциона, и сравнить результаты на одинаковых данных.
                                        </div>
                                    </div>
                                </div>

                                {/* правая колонка */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {FORMATS.map((f) => {
                                        const isSelected = format === f.id;

                                        return (
                                            <div
                                                key={f.id}
                                                onClick={() => setFormat(f.id)}
                                                className={
                                                    "relative cursor-pointer rounded-2xl border shadow-sm p-4 transition " +
                                                    (isSelected
                                                        ? "bg-pink-300 border-pink-400"
                                                        : "bg-amber-200/90 border-amber-300 hover:bg-amber-200")
                                                }
                                            >

                                                <div>
                                                    <div className="text-lg font-bold">{f.title}</div>
                                                    <div className="mt-2 h-px bg-black/20" />

                                                    <div className="mt-2 text-slate-800">
                                                        {f.desc}
                                                    </div>

                                                    <div className="mt-3 space-y-1 text-sm text-slate-800">
                                                        {f.id === "english" && (
                                                            <>
                                                                <div>• Свинки перебивают ставки друг друга</div>
                                                                <div>• Самый динамичный формат</div>
                                                                <div>• Реалистично передает динамику торгов, как в фильмах</div>
                                                            </>
                                                        )}

                                                        {f.id === "dutch" && (
                                                            <>
                                                                <div>• Цена падает на 1 хрюбль раз в 3 секунды</div>
                                                                <div>• Важно вовремя нажать «Беру!»</div>
                                                                <div>• Подходит, если хотите напряженно выжидать нужный момент</div>
                                                            </>
                                                        )}

                                                        {f.id === "first" && (
                                                            <>
                                                                <div>• Все подают ставки втайне друг от друга</div>
                                                                <div>• Побеждает максимальная ставка, и платится именно она</div>
                                                                <div>• Здесь особенно важно не переплатить</div>
                                                            </>
                                                        )}

                                                        {f.id === "vickrey" && (
                                                            <>
                                                                <div>• Все делают ставки скрытно</div>
                                                                <div>• Победитель платит не свою, а вторую по величине ставку</div>
                                                                <div>• Самый «теоретически честный» формат</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setScreen("intro")}
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Назад
                                </button>

                                <button
                                    onClick={() => setScreen("settings")}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Дальше
                                </button>
                            </div>
                        </div>
                    )}

                    {/* настройки серии */}
                    {screen === "settings" && (
                        <div>
                            <h2 className="text-2xl font-bold">Настройка серии</h2>

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="font-semibold">Количество лотов</div>

                                    <div className="mt-3 flex gap-3">
                                        {(isOpen ? [3, 5, 7] : [5, 7, 9]).map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setLots(v)}
                                                className={
                                                    "px-4 py-2 rounded-full border " +
                                                    (lots === v ? "bg-pink-400 text-white border-pink-400" : "bg-white")
                                                }
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-6 font-semibold">Количество соперников</div>

                                    <div className="mt-3 flex gap-3">
                                        {[2, 3, 4].map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setBotCount(v)}
                                                className={
                                                    "px-4 py-2 rounded-full border " +
                                                    (botCount === v ? "bg-pink-400 text-white border-pink-400" : "bg-white")
                                                }
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-6 font-semibold">Шум оценки</div>

                                    <div className="mt-3 flex gap-3">
                                        {[5, 10, 15].map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setYPct(v)}
                                                className={
                                                    "px-4 py-2 rounded-full border " +
                                                    (yPct === v ? "bg-pink-400 text-white border-pink-400" : "bg-white")
                                                }
                                            >
                                                {v}%
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-6 font-semibold">Жетоны</div>

                                    <div className="mt-3 flex gap-3">
                                        <button
                                            onClick={() => setTokensEnabled(true)}
                                            className={
                                                "px-4 py-2 rounded-full border " +
                                                (tokensEnabled ? "bg-pink-400 text-white border-pink-400" : "bg-white")
                                            }
                                        >
                                            Включить
                                        </button>

                                        <button
                                            onClick={() => setTokensEnabled(false)}
                                            className={
                                                "px-4 py-2 rounded-full border " +
                                                (!tokensEnabled ? "bg-pink-400 text-white border-pink-400" : "bg-white")
                                            }
                                        >
                                            Выключить
                                        </button>
                                    </div>

                                    <div className="mt-6">
                                        <div className="font-semibold">Seed <span className="text-pink-600">*</span></div>

                                        <input
                                            value={seed}
                                            onChange={(e) => setSeed(e.target.value)}
                                            className={
                                                "mt-2 w-full border rounded-xl px-4 py-2 bg-white " +
                                                (!seedReady ? "border-pink-300" : "border-slate-300")
                                            }
                                            placeholder="Например, 123"
                                        />

                                        <div className="mt-2 text-xs text-slate-600">
                                            Seed нужен, чтобы серия была воспроизводимой: при одном и том же seed можно повторить те же случайные условия.
                                        </div>

                                        {!seedReady && (
                                            <div className="mt-1 text-xs text-pink-700">
                                                Введите seed, чтобы начать серию.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Сводка серии</div>

                                    <div className="mt-4 space-y-3 text-slate-700">
                                        <div>
                                            Формат:{" "}
                                            <span className="font-semibold">
                                                {FORMATS.find((f) => f.id === format)?.title}
                                            </span>
                                        </div>

                                        <div>
                                            Лотов: <span className="font-semibold">{lots}</span>
                                        </div>

                                        <div>
                                            Соперников: <span className="font-semibold">{botCount}</span>
                                        </div>

                                        <div>
                                            Стартовый банк: <span className="font-semibold">{lots * 100}</span>
                                        </div>

                                        <div>
                                            Шум: <span className="font-semibold">{yPct}%</span>
                                        </div>

                                        <div>
                                            Жетоны:{" "}
                                            <span className="font-semibold">
                                                {tokensEnabled
                                                    ? ((isOpen && lots === 3) ? 1 : (isOpen ? 2 : (lots === 9 ? 3 : 2)))
                                                    : 0}
                                            </span>
                                        </div>

                                        <div>
                                            Минимум лотов без штрафа:{" "}
                                            <span className="font-semibold">{Math.ceil(lots / 4)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50/70 p-4">
                                        <div className="font-semibold text-slate-800">
                                            🕵️ Соперники скрыты до конца игры
                                        </div>

                                        <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                                            В серии Вы заранее не знаете, с какими типами свинок играете.
                                            Типы могут повторяться: например, против Вас могут оказаться две
                                            агрессивные свинки или две осторожные. Попробуйте по ставкам и поведению
                                            догадаться, кто есть кто: в конце серии будет возможность проверить свою догадку.
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setPigsInfoOpen(true)}
                                            className="mt-4 rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-600"
                                        >
                                            🐽 Шпаргалка по свинкам
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setScreen("format")}
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Назад
                                </button>

                                <button
                                    onClick={startSeries}
                                    disabled={!seedReady}
                                    className={
                                        "px-5 py-3 rounded-xl font-medium transition " +
                                        (seedReady
                                            ? "bg-pink-500 text-white hover:bg-pink-600"
                                            : "bg-slate-200 text-slate-500 cursor-not-allowed")
                                    }
                                >
                                    Начать серию
                                </button>
                            </div>
                        </div>
                    )}

                    {/* начало лота */}
                    {screen === "lot_start" && game && (
                        <div>
                            <h2 className="text-2xl font-bold">Лот {game.currentLot} из {game.lots}</h2>

                            <div className="mt-5 rounded-2xl border bg-white/70 p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
                                    <div>
                                        Ваш банк: <span className="font-semibold">{game.userBank}</span>
                                    </div>

                                    <div>
                                        Жетоны: <span className="font-semibold">{game.tokensLeft} / {game.tokensTotal}</span>
                                    </div>

                                    <div>
                                        Выиграно лотов: <span className="font-semibold">{game.userWins} / {game.lots}</span>
                                    </div>

                                    <div>
                                        Формат:{" "}
                                        <span className="font-semibold">
                                            {FORMATS.find((f) => f.id === game.format)?.title}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {game.tokensEnabled && game.tokensLeft > 0 ? (
                                <div className="mt-6 rounded-2xl border bg-pink-50/70 p-5">
                                    <div className="text-lg font-bold">Использовать жетон сейчас?</div>

                                    <div className="mt-2 text-slate-700">
                                        Жетон уменьшит шум вашей оценки в этом лоте вдвое.
                                    </div>

                                    <div className="mt-5 flex gap-3">
                                        <button
                                            onClick={() => beginLot(true)}
                                            className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                        >
                                            Да
                                        </button>

                                        <button
                                            onClick={() => beginLot(false)}
                                            className="px-5 py-3 rounded-xl border bg-white hover:bg-white/90"
                                        >
                                            Нет
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6">
                                    <button
                                        onClick={() => beginLot(false)}
                                        className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                    >
                                        Начать торги
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* сам аукцион */}
                    {screen === "auction" && game && lot && (
                        <div>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                                <div className="rounded-full border px-4 py-2 bg-white/70">
                                    Лот {game.currentLot} / {game.lots}
                                </div>

                                <div className="rounded-full border px-4 py-2 bg-white/70">
                                    Банк: {game.userBank}
                                </div>

                                <div className="rounded-full border px-4 py-2 bg-white/70">
                                    Жетоны: {game.tokensLeft} / {game.tokensTotal}
                                </div>

                                <div className="rounded-full border px-4 py-2 bg-white/70">
                                    Выиграно: {game.userWins} / {game.lots}
                                </div>

                                {(game.format === "english") && (
                                    <>
                                        <div className="rounded-full border px-4 py-2 bg-white/70">
                                            Активных участников: {(lot.userActive ? 1 : 0) + lot.activeBots.length}
                                        </div>

                                        <div className="rounded-full border px-4 py-2 bg-white/70">
                                            Спасовали: {(game.botCount + 1) - ((lot.userActive ? 1 : 0) + lot.activeBots.length)}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
                                <div className="lg:col-span-2 rounded-2xl border bg-white/70 p-5">
                                    <div className="text-xl font-bold">
                                        {FORMATS.find((f) => f.id === game.format)?.title}
                                    </div>

                                    {/* 
                                        Верхний блок аукциона:
                                        слева показываем картинку предмета, справа показываем данные игрока
                                        В открытых аукционах справа две карточки оценка и текущая цена
                                        В закрытых аукционах только оценка
                                    */}
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-stretch">
                                        {/* картинка лота */}
                                        {lotImageSrc && (
                                            <div className="rounded-2xl border bg-white p-2 shadow-sm">
                                                <img
                                                    src={lotImageSrc}
                                                    alt={`Лот ${game.currentLot}`}
                                                    className="h-full min-h-[190px] w-full rounded-xl object-cover"
                                                />
                                            </div>
                                        )}

                                        {/* правая колонка с инфой по лоту */}
                                        <div className="grid grid-cols-1 gap-4 content-start">
                                            {/* субъективная оценка игрока */}
                                            <div className="rounded-xl border bg-white p-4">
                                                <div className="text-sm text-slate-600">Ваша оценка</div>
                                                <div className="text-3xl font-extrabold">{lot.userValue}</div>

                                                {/* если жетон активен, показываем бейдж */}
                                                {lot.useToken && (
                                                    <div className="mt-2 inline-block rounded-full bg-pink-100 text-pink-700 px-3 py-1 text-xs font-medium">
                                                        Жетон активен
                                                    </div>
                                                )}
                                            </div>

                                            {/* текущая цена нужна только в открытых аукционах */}
                                            {(game.format === "english" || game.format === "dutch") && (
                                                <div className="rounded-xl border bg-white p-4">
                                                    <div className="text-sm text-slate-600">Текущая цена</div>
                                                    <div className="text-3xl font-extrabold">{lot.price}</div>

                                                    {/* в английском аукционе иногда остается дуэль игрока и одной свинки */}
                                                    {lot.phase === "duel" && (
                                                        <div className="mt-2 text-sm text-violet-700 font-medium">
                                                            🔥 Финальная дуэль
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-3">
                                        {playerRows.map((p) => {
                                            const active = p.id === "user"
                                                ? lot.userActive
                                                : lot.activeBots.includes(p.id);

                                            const isLeader = lot.leader === p.id;

                                            return (
                                                <div
                                                    key={p.id}
                                                    className={
                                                        "rounded-xl border px-4 py-3 flex items-center justify-between " +
                                                        (isLeader ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200" : "bg-white") +
                                                        (!active ? " opacity-50" : "")
                                                    }
                                                >
                                                    <div>{p.title}</div>

                                                    <div className="text-sm text-slate-600">
                                                        {isLeader ? "Лидер" : active ? "В торгах" : "Пас"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* английский */}
                                    {game.format === "english" && (
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            {lot.phase === "waiting" && (
                                                <button
                                                    onClick={() => englishUserAction("enter")}
                                                    disabled={!lot.userActive || busy}
                                                    className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    Включиться в аукцион
                                                </button>
                                            )}

                                            {lot.phase === "user_turn" && (
                                                <>
                                                    <button
                                                        onClick={() => englishUserAction("raise1")}
                                                        disabled={lot.price + 1 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +1
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("raise2")}
                                                        disabled={lot.price + 2 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +2
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("raise3")}
                                                        disabled={lot.price + 3 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +3
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("pass")}
                                                        disabled={!lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 disabled:opacity-50"
                                                    >
                                                        Пас
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("wait")}
                                                        disabled={busy}
                                                        className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50"
                                                    >
                                                        Вернуться к выжиданию
                                                    </button>
                                                </>
                                            )}

                                            {lot.phase === "duel" && (
                                                <>
                                                    <button
                                                        onClick={() => englishUserAction("raise1")}
                                                        disabled={lot.price + 1 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +1
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("raise2")}
                                                        disabled={lot.price + 2 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +2
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("raise3")}
                                                        disabled={lot.price + 3 > game.userBank || !lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                                    >
                                                        +3
                                                    </button>

                                                    <button
                                                        onClick={() => englishUserAction("pass")}
                                                        disabled={!lot.userActive || busy || lot.leader === "user"}
                                                        className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 disabled:opacity-50"
                                                    >
                                                        Пас
                                                    </button>
                                                </>
                                            )}

                                            {lot.leader === "user" && (
                                                <div className="mt-3 text-sm text-pink-700">
                                                    Вы лидер торгов
                                                </div>
                                            )}

                                        </div>
                                    )}

                                    {/* голландский */}
                                    {game.format === "dutch" && (
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            <button
                                                onClick={() => {
                                                    const winnerLot = {
                                                        ...lot,
                                                        isFinished: true,
                                                        winner: "user",
                                                        paid: lot.price,
                                                        lastUserBid: lot.price,
                                                        logs: [...lot.logs, `Вы купили лот за ${lot.price}`],
                                                    };

                                                    setLot(winnerLot);
                                                    setScreen("lot_result");
                                                }}
                                                disabled={lot.price > game.userBank}
                                                className="px-4 py-2 rounded-xl bg-pink-500 text-white disabled:opacity-50"
                                            >
                                                Беру!
                                            </button>

                                            <button
                                                onClick={() => setDutchPaused((prev) => !prev)}
                                                className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50"
                                            >
                                                {dutchPaused ? "Продолжить" : "Пауза"}
                                            </button>
                                        </div>
                                    )}

                                    {/* закрытые */}
                                    {(game.format === "first" || game.format === "vickrey") && (
                                        <div className="mt-5 rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Ваша последняя ставка</div>

                                            <input
                                                type="number"
                                                min={0}
                                                max={game.userBank}
                                                value={userBid}
                                                onChange={(e) => setUserBid(Number(e.target.value))}
                                                className="mt-2 w-full border rounded-xl px-4 py-2"
                                            />

                                            <button
                                                onClick={() => submitClosedBid(game.format)}
                                                className="mt-4 px-4 py-2 rounded-xl bg-pink-500 text-white"
                                            >
                                                Подать ставку
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Журнал торгов</div>

                                    <div className="mt-4 h-[420px] overflow-y-auto space-y-2">
                                        {lot.logs.length === 0 ? (
                                            <div className="text-sm text-slate-500">Пока действий нет</div>
                                        ) : (
                                            [...lot.logs].reverse().map((line, i) => (
                                                <div
                                                    key={i}
                                                    className="rounded-xl border bg-white px-4 py-3 text-sm"
                                                >
                                                    {line}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* результат лота */}
                    {screen === "lot_result" && game && lot && (
                        <div>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold">Результат лота</h2>
                                    <div className="mt-1 text-sm text-slate-600">
                                        Лот {game.currentLot} из {game.lots}
                                    </div>
                                </div>

                                <div
                                    className={
                                        "rounded-full px-4 py-2 text-sm font-semibold border " +
                                        (lot.winner === "user"
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : lot.winner
                                                ? "bg-pink-50 text-pink-700 border-pink-200"
                                                : "bg-slate-50 text-slate-600 border-slate-200")
                                    }
                                >
                                    {lot.winner === "user"
                                        ? (lotResultPiEx < 0
                                            ? "Лот оказался убыточным"
                                            : "Лот оказался выгодным")
                                        : lot.winner
                                            ? "Лот забрала свинка"
                                            : "Лот остался непроданным"}
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
                                <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
                                    <div className="flex items-center gap-5">
                                        {(lot.winner === "user" || lot.winner) && (
                                            <img
                                                src={lot.winner === "user" ? "/pigs/user_kitty.png" : "/pigs/mischievous_pig.png"}
                                                alt={lot.winner === "user" ? "Вы" : `Свин ${lot.winner}`}
                                                className="w-28 h-28 rounded-full object-cover border bg-white shadow-sm"
                                            />
                                        )}

                                        <div>
                                            <div className="text-sm text-slate-600">Победитель</div>

                                            <div className="mt-1 text-4xl font-extrabold leading-tight">
                                                {lot.winner === "user"
                                                    ? "Вы"
                                                    : lot.winner
                                                        ? `Свин ${lot.winner}`
                                                        : "Никто"}
                                            </div>

                                            <div className="mt-3 inline-flex items-center rounded-full bg-pink-50 border border-pink-200 px-3 py-1 text-sm text-pink-700 font-medium">
                                                Цена лота: {lot.paid} хрюблей
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Истинная ценность лота</div>
                                            <div className="mt-1 text-3xl font-extrabold">{lot.x}</div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Ваша субъективная оценка</div>
                                            <div className="mt-1 text-3xl font-extrabold">{lot.userValue}</div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Ваша ставка</div>
                                            <div className="mt-1 text-3xl font-extrabold">
                                                {lotResultUserBid == null ? "—" : lotResultUserBid}
                                            </div>
                                        </div>

                                        <div
                                            className={
                                                "rounded-xl border p-4 " +
                                                (lot.winner === "user"
                                                    ? lotResultPiEx < 0
                                                        ? "bg-red-50 border-red-200"
                                                        : "bg-green-50 border-green-200"
                                                    : "bg-white")
                                            }
                                        >
                                            <div className="text-sm text-slate-600">Итог по лоту</div>

                                            <div
                                                className={
                                                    "mt-1 text-lg font-bold " +
                                                    (lot.winner === "user"
                                                        ? lotResultPiEx < 0
                                                            ? "text-red-700"
                                                            : "text-green-700"
                                                        : "text-slate-700")
                                                }
                                            >
                                                {lot.winner === "user"
                                                    ? lotResultPiEx < 0
                                                        ? "Переплата"
                                                        : "Выгодная покупка"
                                                    : "Вы не купили лот"}
                                            </div>
                                        </div>
                                    </div>

                                    {lot.winner === "user" && (
                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div
                                                className={
                                                    "rounded-xl border p-4 " +
                                                    (lotResultPiSubj < 0
                                                        ? "bg-red-50 border-red-200"
                                                        : "bg-green-50 border-green-200")
                                                }
                                            >
                                                <div className="text-sm text-slate-600">Ваш субъективный выигрыш</div>
                                                <div className="mt-1 text-3xl font-extrabold">
                                                    {lotResultPiSubj}
                                                </div>
                                            </div>

                                            <div
                                                className={
                                                    "rounded-xl border p-4 " +
                                                    (lotResultPiEx < 0
                                                        ? "bg-red-50 border-red-200"
                                                        : "bg-green-50 border-green-200")
                                                }
                                            >
                                                <div className="text-sm text-slate-600">Ваш ex post выигрыш</div>
                                                <div className="mt-1 text-3xl font-extrabold">
                                                    {lotResultPiEx}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
                                    <div className="text-lg font-bold">Состояние серии</div>

                                    <div className="mt-5 grid grid-cols-1 gap-3">
                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Ваш банк сейчас</div>
                                            <div className="mt-1 text-4xl font-extrabold">
                                                {lotResultBank}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Выиграно лотов</div>
                                            <div className="mt-1 text-3xl font-extrabold">
                                                {lotResultWins} / {game.lots}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-pink-50 border-pink-200 p-4">
                                            <div className="text-sm font-semibold text-pink-800">
                                                Минимум без штрафа
                                            </div>

                                            <div className="mt-1 text-2xl font-extrabold text-pink-900">
                                                {game.minWins} лота
                                            </div>

                                            <div className="mt-2 text-sm text-slate-700">
                                                Если к концу серии побед будет меньше, появится штраф 100 хрюблей.
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-sm text-slate-700 leading-relaxed">
                                            {lot.winner === "user"
                                                ? "Вы забрали этот лот, поэтому цена уже учитывается в банке и итогах серии."
                                                : lot.winner
                                                    ? "Этот лот забрала свинка. Ваш банк не изменился."
                                                    : "Лот никто не купил, поэтому банки участников не изменились."}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={settleAndNext}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Дальше
                                </button>
                            </div>
                        </div>
                    )}

                    {/* итоги серии */}
                    {screen === "summary" && game && summary && (
                        <div>
                            <h2 className="text-2xl font-bold">Итоги серии</h2>

                            <div className="mt-6 overflow-x-auto rounded-2xl border bg-white/70 p-5">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="py-3 pr-4">Лот</th>
                                            <th className="py-3 pr-4">Победитель</th>
                                            <th className="py-3 pr-4">Цена</th>
                                            <th className="py-3 pr-4">Истин. ценность</th>
                                            <th className="py-3 pr-4">Оценка победителя</th>
                                            <th className="py-3 pr-4">Субъект. выигрыш</th>
                                            <th className="py-3 pr-4">Ex post выигрыш</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {game.history.map((h) => (
                                            <tr key={h.lotNo} className="border-b last:border-b-0">
                                                <td className="py-3 pr-4">{h.lotNo}</td>
                                                <td className="py-3 pr-4">
                                                    {h.winner === "user"
                                                        ? "🐱 Вы"
                                                        : h.winner
                                                            ? `🐷 Свин ${h.winner}`
                                                            : "Никто"}
                                                </td>
                                                <td className="py-3 pr-4">{h.price}</td>
                                                <td className="py-3 pr-4">{h.x}</td>
                                                <td className="py-3 pr-4">{h.winnerValue}</td>
                                                <td className="py-3 pr-4">{h.piSubj}</td>
                                                <td className="py-3 pr-4">{h.piEx}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Сводка игрока</div>

                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <div className="text-sm text-slate-600">Побед в серии</div>
                                            <div className="text-2xl font-extrabold text-center w-full">
                                                {game.userWins} / {game.lots}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <div className="text-sm text-slate-600">Потрачено на лоты</div>
                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{summary.spent}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <div className="text-sm text-slate-600">Стартовый банк</div>
                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{game.startBank}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <div className="text-sm text-slate-600">Остаток банка</div>
                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{summary.finalBank}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-pink-50 border-pink-200 p-4 sm:col-span-2 text-center flex flex-col items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setMetricInfo(metricTexts.finalValue)}
                                                className="text-sm text-slate-600 underline decoration-dotted underline-offset-4 text-center"
                                            >
                                                Итоговое состояние по истинной ценности
                                            </button>

                                            <div className="mt-1 w-full text-center">
                                                <div className="text-3xl font-extrabold">
                                                    {game.startBank + summary.ex - summary.penalty}
                                                </div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setMetricInfo(metricTexts.subj)}
                                                className="text-sm text-slate-600 underline decoration-dotted underline-offset-4 text-center"
                                            >
                                                Суммарный субъективный выигрыш
                                            </button>

                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{summary.subj}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setMetricInfo(metricTexts.ex)}
                                                className="text-sm text-slate-600 underline decoration-dotted underline-offset-4 text-center"
                                            >
                                                Суммарный ex post выигрыш
                                            </button>

                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{summary.ex}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setMetricInfo(metricTexts.roi)}
                                                className="text-sm text-slate-600 underline decoration-dotted underline-offset-4 text-center"
                                            >
                                                ROI по истинной ценности
                                            </button>

                                            <div className="text-2xl font-extrabold mt-1 text-center w-full">
                                                {summary.roi}%
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-white p-4 text-center flex flex-col items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setMetricInfo(metricTexts.penalty)}
                                                className="text-sm text-slate-600 underline decoration-dotted underline-offset-4 text-center"
                                            >
                                                Штраф за пассивность
                                            </button>

                                            <div className="mt-1 w-full text-center">
                                                <div className="text-2xl font-extrabold">{summary.penalty}</div>
                                                <div className="text-base font-semibold">хрюблей</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-lg font-bold">Кто кем оказался</div>
                                            <div className="mt-1 text-sm text-slate-600 leading-relaxed">
                                                Типы свинок были скрыты всю серию. Можно попробовать угадать их по поведению
                                                или сразу раскрыть ответы.
                                            </div>
                                        </div>
                                    </div>

                                    {guessMode === "closed" && (
                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGuessMode("guess");
                                                    setGuessesChecked(false);
                                                    setBotGuesses({});
                                                }}
                                                className="rounded-xl bg-pink-500 px-4 py-3 text-white font-semibold hover:bg-pink-600 transition"
                                            >
                                                🕵️ Попытаться угадать
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGuessMode("reveal");
                                                    setGuessesChecked(true);
                                                }}
                                                className="rounded-xl border bg-white px-4 py-3 font-semibold hover:bg-slate-50 transition"
                                            >
                                                👀 Раскрыть свинок
                                            </button>
                                        </div>
                                    )}

                                    {guessMode === "guess" && (
                                        <div className="mt-5 space-y-3">
                                            {Object.entries(game.botTypes).map(([id, type]) => {
                                                const guess = botGuesses[id] ?? "";
                                                const checked = guessesChecked;
                                                const isCorrect = checked && guess === type;
                                                const isWrong = checked && guess !== type;

                                                return (
                                                    <div
                                                        key={id}
                                                        className={
                                                            "rounded-xl border px-4 py-3 transition " +
                                                            (isCorrect
                                                                ? "bg-green-50 border-green-300"
                                                                : isWrong
                                                                    ? "bg-red-50 border-red-300"
                                                                    : "bg-white")
                                                        }
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div className="flex items-center gap-3 font-semibold">
                                                                {guessesChecked && (
                                                                    <img
                                                                        src={BOT_IMAGES[type]}
                                                                        alt={`${BOT_TITLES[type]} свинка`}
                                                                        className="h-12 w-12 rounded-full border bg-white object-cover shadow-sm"
                                                                    />
                                                                )}

                                                                <div>
                                                                    Свин {id}
                                                                </div>
                                                            </div>

                                                            <select
                                                                value={guess}
                                                                disabled={checked}
                                                                onChange={(e) =>
                                                                    setBotGuesses((prev) => ({
                                                                        ...prev,
                                                                        [id]: e.target.value,
                                                                    }))
                                                                }
                                                                className="rounded-xl border bg-white px-3 py-2 text-sm"
                                                            >
                                                                <option value="">Выберите тип</option>
                                                                {BOT_OPTIONS.map((option) => (
                                                                    <option key={option.id} value={option.id}>
                                                                        {option.title}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {checked && (
                                                            <div className="mt-3 text-sm">
                                                                {isCorrect ? (
                                                                    <span className="font-semibold text-green-700">
                                                                        Верно! Это {BOT_TITLES[type]} свинка.
                                                                    </span>
                                                                ) : (
                                                                    <span className="font-semibold text-red-700">
                                                                        Неверно. На самом деле это {BOT_TITLES[type]} свинка.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {!guessesChecked && (
                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setGuessesChecked(true)}
                                                        disabled={
                                                            Object.keys(game.botTypes).some((id) => !botGuesses[id])
                                                        }
                                                        className={
                                                            "rounded-xl px-4 py-3 font-semibold transition " +
                                                            (Object.keys(game.botTypes).some((id) => !botGuesses[id])
                                                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                                : "bg-pink-500 text-white hover:bg-pink-600")
                                                        }
                                                    >
                                                        Проверить
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setGuessMode("reveal");
                                                            setGuessesChecked(true);
                                                        }}
                                                        className="rounded-xl border bg-white px-4 py-3 font-semibold hover:bg-slate-50 transition"
                                                    >
                                                        Сдаться и раскрыть
                                                    </button>
                                                </div>
                                            )}

                                            {guessesChecked && (
                                                <div className="mt-4 rounded-xl border bg-white p-4">
                                                    <div className="font-semibold text-slate-900">
                                                        Правильные ответы
                                                    </div>

                                                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                                                        {Object.entries(game.botTypes).map(([id, type]) => (
                                                            <div
                                                                key={id}
                                                                className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                                            >
                                                                <img
                                                                    src={BOT_IMAGES[type]}
                                                                    alt={`${BOT_TITLES[type]} свинка`}
                                                                    className="h-12 w-12 rounded-full border bg-white object-cover shadow-sm"
                                                                />

                                                                <div>
                                                                    Свин {id} —{" "}
                                                                    <span className="font-semibold">
                                                                        {BOT_TITLES[type]} свинка
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {guessMode === "reveal" && (
                                        <div className="mt-5 space-y-3">
                                            {Object.entries(game.botTypes).map(([id, type]) => (
                                                <div
                                                    key={id}
                                                    className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3"
                                                >
                                                    <img
                                                        src={BOT_IMAGES[type]}
                                                        alt={`${BOT_TITLES[type]} свинка`}
                                                        className="h-12 w-12 rounded-full border bg-white object-cover shadow-sm"
                                                    />

                                                    <div>
                                                        Свин {id} —{" "}
                                                        <span className="font-semibold">
                                                            {BOT_TITLES[type]} свинка
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}

                                            <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-700 leading-relaxed">
                                                Теперь можно сравнить это с поведением свинок в серии: кто рано пасовал,
                                                кто ставил близко к оценке, а кто чаще занижал ставку.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setGame(null);
                                        setLot(null);
                                        setSummary(null);
                                        setGuessMode("closed");
                                        setBotGuesses({});
                                        setGuessesChecked(false);
                                        setScreen("format");
                                    }}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Сыграть ещё
                                </button>

                                <button
                                    onClick={() => setScreen("settings")}
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Сменить настройки
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {metricInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setMetricInfo(null)}
                    />

                    <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
                        <div className="text-lg font-bold">
                            {metricInfo.title}
                        </div>

                        <div className="mt-3 text-sm text-slate-700 leading-relaxed">
                            {metricInfo.text}
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setMetricInfo(null)}
                                className="px-4 py-2 rounded-xl bg-pink-500 text-white hover:bg-pink-600"
                            >
                                Понятно
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* модалка со свинками */}
            {pigsInfoOpen && (
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
                                        🐽 Как распознать свинок?
                                    </div>

                                    <div className="mt-2 max-w-3xl text-sm text-slate-600 leading-relaxed">
                                        В игре типы соперников скрыты до конца серии. Наблюдайте за тем,
                                        как они входят в торги, насколько быстро пасуют и насколько близко
                                        подходят к своей оценке. Типы могут повторяться, поэтому не факт,
                                        что против Вас ровно по одной свинке каждого вида.
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
                                {GAME_PIG_DETAILS.map((pig) => (
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
                                                    {pig.text}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-5 rounded-2xl border bg-white/80 p-4 text-sm text-slate-700 leading-relaxed">
                                <span className="font-semibold">Подсказка для игры:</span>{" "}
                                в открытых аукционах смотрите, кто долго держится в торгах,
                                кто пасует рано, а кто резко повышает цену. В закрытых аукционах
                                чужие ставки не видны, поэтому типы соперников сложнее угадать,
                                но итоговые победители и цены всё равно дают подсказки.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}