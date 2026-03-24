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

    // локальные штучки
    const [userBid, setUserBid] = useState(0);
    const [busy, setBusy] = useState(false);
    const [dutchPaused, setDutchPaused] = useState(false);
    const actionLockRef = useRef(false);
    const [quickTipOpen, setQuickTipOpen] = useState(false);

    const isOpen = format === "english" || format === "dutch";

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
        const data = await apiPost({
            mode: "start",
            format,
            lots,
            botCount,
            yPct,
            tokensEnabled,
            seed,
        });

        setGame(data.game);
        setLot(null);
        setSummary(null);
        setUserBid(0);
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

    return (
        <main className="min-h-screen bg-pink-100 p-8">
            <div className="max-w-6xl mx-auto px-6 py-10">
                <a href="/" className="text-green-700 font-medium">← На главную</a>

                <h1 className="text-3xl font-bold mt-4">Режим игры</h1>

                <div className="mt-6 bg-white/80 border rounded-2xl shadow p-6">

                    {/* вводный экран */}
                    {screen === "intro" && (
                        <div className="max-w-3xl">
                            <h2 className="text-2xl font-extrabold">✨ Поздравляем!</h2>

                            <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
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
                                            <h2 className="text-2x1 font-semibold">Выберите тип аукциона</h2>

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
                                            У каждого формата свои правила, темп и оптимальная стратегия.
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
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    className="absolute right-3 top-3 w-9 h-9 rounded-full border bg-white/70 hover:bg-white flex items-center justify-center"
                                                    title="Пояснение"
                                                >
                                                    ?
                                                </button>

                                                <div className="pr-12">
                                                    <div className="text-lg font-bold">{f.title}</div>
                                                    <div className="mt-2 h-px bg-black/20" />

                                                    <div className="mt-2 text-slate-800">
                                                        {f.desc}
                                                    </div>

                                                    <div className="mt-3 space-y-1 text-sm text-slate-800">
                                                        {f.id === "english" && (
                                                            <>
                                                                <div>• Свинки перебивают ставки друг друга</div>
                                                                <div>• Самый динамичный фрмат</div>
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
                                    onClick={() => setScreen("settings")}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Дальше
                                </button>

                                <button
                                    onClick={() => setScreen("intro")}
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Назад
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
                                        <div className="font-semibold">Seed (необязательно)</div>

                                        <input
                                            value={seed}
                                            onChange={(e) => setSeed(e.target.value)}
                                            className="mt-2 w-full border rounded-xl px-4 py-2 bg-white"
                                            placeholder="Например, 123"
                                        />
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

                                    <div className="mt-6 text-sm text-slate-600">
                                        Типы свинок будут скрыты до конца серии.
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={startSeries}
                                    className="px-5 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600"
                                >
                                    Начать серию
                                </button>

                                <button
                                    onClick={() => setScreen("format")}
                                    className="px-5 py-3 rounded-xl border bg-white/70 hover:bg-white"
                                >
                                    Назад
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

                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-xl border bg-white p-4">
                                            <div className="text-sm text-slate-600">Ваша оценка</div>
                                            <div className="text-3xl font-extrabold">{lot.userValue}</div>

                                            {lot.useToken && (
                                                <div className="mt-2 inline-block rounded-full bg-pink-100 text-pink-700 px-3 py-1 text-xs font-medium">
                                                    Жетон активен
                                                </div>
                                            )}
                                        </div>

                                        {(game.format === "english" || game.format === "dutch") && (
                                            <div className="rounded-xl border bg-white p-4">
                                                <div className="text-sm text-slate-600">Текущая цена</div>
                                                <div className="text-3xl font-extrabold">{lot.price}</div>

                                                {lot.phase === "duel" && (
                                                    <div className="mt-2 text-sm text-violet-700 font-medium">
                                                        🔥 Финальная дуэль
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                            <h2 className="text-2xl font-bold">Результат лота</h2>

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-sm text-slate-600">Победитель</div>

                                    <div className="text-3xl font-extrabold">
                                        {lot.winner === "user"
                                            ? "🐱 Вы"
                                            : lot.winner
                                                ? `🐷 Свин ${lot.winner}`
                                                : "Никто"}
                                    </div>

                                    <div className="mt-5 text-sm text-slate-600">Цена лота</div>
                                    <div className="text-3xl font-extrabold">{lot.paid}</div>

                                    <div className="mt-5 text-sm text-slate-600">Истинная ценность лота</div>
                                    <div className="text-2xl font-bold">{lot.x}</div>

                                    <div className="mt-5 text-sm text-slate-600">Ваша субъективная оценка</div>
                                    <div className="text-2xl font-bold">{lot.userValue}</div>

                                    <div className="mt-5 text-sm text-slate-600">Ваша ставка</div>
                                    <div className="text-2xl font-bold">
                                        {lotResultUserBid == null ? "—" : lotResultUserBid}
                                    </div>

                                    {lot.winner === "user" && (
                                        <>
                                            <div className="mt-5 text-sm text-slate-600">Ваш субъективный выигрыш</div>
                                            <div className="text-2xl font-bold">{lotResultPiSubj}</div>

                                            <div className="mt-5 text-sm text-slate-600">Ваш ex post выигрыш</div>
                                            <div className="text-2xl font-bold">{lotResultPiEx}</div>
                                        </>
                                    )}
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-sm text-slate-600">Ваш банк сейчас</div>
                                    <div className="text-3xl font-extrabold">{lotResultBank}</div>

                                    <div className="mt-5 text-sm text-slate-600">Выиграно лотов</div>
                                    <div className="text-2xl font-bold">
                                        {lotResultWins} / {game.lots}
                                    </div>

                                    {lot.winner === "user" && (
                                        <div className="mt-5 text-slate-700">
                                            {lotResultPiEx < 0
                                                ? "Для вас этот лот оказался убыточным по истинной ценности."
                                                : "Для вас этот лот оказался выгодным по истинной ценности."}
                                        </div>
                                    )}
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
                                            <th className="py-3 pr-4">x</th>
                                            <th className="py-3 pr-4">Оценка победителя</th>
                                            <th className="py-3 pr-4">π_subj</th>
                                            <th className="py-3 pr-4">π_ex</th>
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

                                    <div className="mt-4 space-y-3 text-slate-700">
                                        <div>Побед: <span className="font-semibold">{game.userWins}</span></div>
                                        <div>Сумма трат: <span className="font-semibold">{summary.spent}</span></div>
                                        <div>Суммарный π_subj: <span className="font-semibold">{summary.subj}</span></div>
                                        <div>Суммарный π_ex: <span className="font-semibold">{summary.ex}</span></div>
                                        <div>Штраф: <span className="font-semibold">{summary.penalty}</span></div>
                                        <div>Итоговый банк: <span className="font-semibold">{summary.finalBank}</span></div>
                                        <div>ROI: <span className="font-semibold">{summary.roi}%</span></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-5">
                                    <div className="text-lg font-bold">Кто кем оказался</div>

                                    <div className="mt-4 space-y-3">
                                        {Object.entries(game.botTypes).map(([id, type]) => (
                                            <div key={id} className="rounded-xl border bg-white px-4 py-3">
                                                🐷 Свин {id} — <span className="font-semibold">{BOT_TITLES[type]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setGame(null);
                                        setLot(null);
                                        setSummary(null);
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
        </main>
    );
}