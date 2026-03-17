import { Rng } from "./rng";

// просто ограничиваем число снизу и сверху
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// случайное целое через наш генератор
function randInt(rng, lo, hi) {
    return rng.nextInt(lo, hi);
}

// перемешиваем массивчик
function shuffle(arr, rng) {
    const a = [...arr];

    for (let i = a.length - 1; i > 0; i--) {
        const j = rng.nextInt(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
}

// сколько жетонов даем в сермм
function getTokenCount(format, lots) {
    const open = format === "english" || format === "dutch";

    // открытые аукционы
    if (open) {
        if (lots === 3) return 1;
        if (lots === 5 || lots === 7) return 2;
        return 0;
    }

    //закрытые аукционы  
    if (lots === 5 || lots === 7) return 2;
    if (lots === 9) return 3;

    return 0;
}

// минимум побед без штрафа
function getMinWins(lots) {
    return Math.ceil(lots / 4);
}

// стартовый банк серии
function getStartBank(lots) {
    return lots * 100;
}

// границы шума вокруг истинной ценности 
function getNoiseRange(x, yPct) {
    const d = Math.round(x * yPct / 100);
    return [x - d, x + d];
}

// 1 субъективная оцена с шумом
function genOneValue({ x, yPct, rng }) {
    const [lo, hi] = getNoiseRange(x, yPct);
    return clamp(randInt(rng, lo, hi), 0, 200);
}

// генерим оценку игрока и свинок на лот
function genLotValues({ x, yPct, useToken, rng, botCount }) {
    // если жетон активен, у игрока шум в 2 раза меньше
    const userNoise = useToken ? yPct / 2 : yPct;

    const userValue = genOneValue({ x, yPct: userNoise, rng });

    const botValues = {};

    for (let i = 1; i <= botCount; i++) {
        botValues[String(i)] = genOneValue({ x, yPct, rng });
    }

    return { userValue, botValues };
}

// случайно выбираем типы свинок на серию
function pickBotTypes(botCount, rng) {
    const all = ["honest", "aggressive", "rational", "cautious"];
    return shuffle(all, rng).slice(0, botCount);
}

// !!! стартовая цена в английском (НОВОЕ!!!) 
function englishStartPrice(x, rng) {
    return Math.max(1, x - randInt(rng, 12, 22));
}

// стартовая цена в голландском по кускам (как в начальном файле с правилами)
function dutchStartPrice(x) {
    if (x >= 181) return 240;
    if (x >= 151) return 210;
    if (x >= 126) return 180;
    if (x >= 104) return 150;
    if (x >= 86) return 120;
    if (x >= 74) return 100;
    return 90;
}

//предел для открытых аукционов 
function getBotOpenLimit(type, s, x) {
    if (type === "honest") return s;
    if (type === "rational") return s;

    // осторожная чуть раньше выходит 
    if (type === "cautious") {
        const b = Math.max(1, Math.floor(0.01 * x));
        return s - b;
    }

    // агрессивная отделной логмкой ниже
    return s;
}

// ставка в закрытых аукционах
function getBotSealedBid(type, s, n) {
    if (type === "honest") return s;
    if (type === "aggressive") return Math.round(0.95 * s);
    if (type === "cautious") return Math.round(0.8 * s);
    if (type === "rational") return Math.round((1 - 1 / n) * s);
    return s;
}

// вторая по ведичине ставка для викри
function secondHighest(arr) {
    const a = [...arr].sort((x, y) => y - x);
    return a[1] ?? a[0] ?? 0;
}

// создаем всю серию  целиком
export function createGameSeries({
    format,
    lots,
    botCount,
    yPct,
    tokensEnabled,
    seed,
}) {
    // если seed не задан, берем теукщее время
    const baseSeed = Number.isFinite(Number(seed)) ? Number(seed) : Date.now();
    const rng = new Rng(baseSeed);

    // каждому свину 1,2,3,4 даем скрытый тип 
    const botTypes = {};
    const picked = pickBotTypes(botCount, rng);

    for (let i = 1; i <= botCount; i++) {
        botTypes[String(i)] = picked[i - 1];
    }

    const bank = getStartBank(lots);
    const tokens = tokensEnabled ? getTokenCount(format, lots) : 0;

    return {
        baseSeed,
        format,
        lots,
        botCount,
        yPct,
        tokensEnabled: !!tokensEnabled,
        tokensTotal: tokens,
        tokensLeft: tokens,
        startBank: bank,
        userBank: bank,

        // банк свинок тоже считаем отдельно
        botBanks: Object.fromEntries(
            Array.from({ length: botCount }, (_, i) => [String(i + 1), bank])
        ),

        minWins: getMinWins(lots),
        userWins: 0,
        currentLot: 1,
        botTypes,
        history: [],
    };
}

// создаем один новый лот
export function createLot(game, { useToken = false }) {
    // для каждого лота свой seed, чтобы серии были воспроизводимыми
    const rng = new Rng(game.baseSeed + game.currentLot * 1000);

    // истинная ценность из заданного диапазона
    const x = randInt(rng, 60, 200);

    // генерим оценки игрока и свинок
    const { userValue, botValues } = genLotValues({
        x,
        yPct: game.yPct,
        useToken,
        rng,
        botCount: game.botCount,
    });

    // в начале все свинки активны
    const activeBots = Array.from({ length: game.botCount }, (_, i) => String(i + 1));

    let startPrice = 0;

    if (game.format === "english") startPrice = englishStartPrice(x, rng);
    if (game.format === "dutch") startPrice = dutchStartPrice(x);

    return {
        lotNo: game.currentLot,
        x,
        useToken,
        userValue,
        botValues,
        price: startPrice,

        // кто еще остался в торгах
        activeBots,
        userActive: true,

        // текущий лидер в открытых аукционах
        leader: null,

        // журнал событтий на экране
        logs: [],

        // waiting / duel / idle
        phase: game.format === "english" ? "waiting" : "idle",

        isFinished: false,
        winner: null,
        paid: null,
    };
}

//решаем, что делает свинка в английском
export function getEnglishBotAction({
    type,
    s,
    x,
    price,
    bank,
    rng,
}) {
    const nextPrice = price + 1;

    // если денег уже не хватает даже на +1, сразу пас
    if (bank < nextPrice) {
        return { action: "pass" };
    }

    // агрессивная свинка иногда делат jump
    if (type === "aggressive") {
        if (price >= s) return { action: "pass" };

        const doJump = rng.nextInt(1, 100) <= 30;

        if (doJump) {
            const jump = rng.nextInt(2, 3);
            const p = price + jump;

            if (p <= s && p <= bank) {
                return { action: "raise", step: jump };
            }
        }

        return { action: "raise", step: 1 };
    }

    // для остальных провепяем их предел
    const lim = getBotOpenLimit(type, s, x);

    if (nextPrice <= lim) {
        return { action: "raise", step: 1 };
    }

    return { action: "pass" };
}

// один автоход свинки в английском
export function applyEnglishBotStep(game, lot) {
    if (lot.isFinished) return lot;

    // активные свинки, которым еще хватает банка
    const active = lot.activeBots.filter((id) => game.botBanks[id] >= lot.price + 1);

    // если игрок уже выбыл и свинок не осталось, просто завершаем
    if (!lot.userActive && active.length === 0) {
        lot.isFinished = true;
        return lot;
    }

    // если остался только игрок
    if (lot.userActive && active.length === 0) {
        lot.isFinished = true;
        lot.winner = "user";
        lot.paid = lot.price;
        return lot;
    }

    // если игрок выбыл и осталсаь одна свинка, она победила
    if (!lot.userActive && active.length === 1) {
        lot.isFinished = true;
        lot.winner = active[0];
        lot.paid = lot.price;
        return lot;
    }

    // если остались игрок и одна свинка, врубаем дуэль
    if (lot.userActive && active.length === 1) {
        lot.phase = "duel";
    }

    // в дуэли автоходы тут уже не делаем
    if (lot.phase === "duel") {
        return lot;
    }

    if (active.length === 0) return lot;

    // выбираем случайную активную (которая еще не пасанула) свинку
    const rng = new Rng(game.baseSeed + lot.lotNo * 10000 + lot.logs.length + 1);
    const botId = active[rng.nextInt(0, active.length - 1)];
    const type = game.botTypes[botId];
    const s = lot.botValues[botId];
    const bank = game.botBanks[botId];

    const botAction = getEnglishBotAction({
        type,
        s,
        x: lot.x,
        price: lot.price,
        bank,
        rng,
    });

    if (botAction.action === "pass") {
        lot.activeBots = lot.activeBots.filter((id) => id !== botId);
        lot.logs.push(`Свин ${botId} спасовал`);
    } else {
        lot.price += botAction.step;
        lot.leader = botId;
        lot.logs.push(`Свин ${botId} повысил до ${lot.price}`);
    }

    // после хода еще раз проверяем, кто вообще жив
    const aliveBots = lot.activeBots.filter((id) => game.botBanks[id] >= lot.price + 1);

    if (!lot.userActive && aliveBots.length === 1) {
        lot.isFinished = true;
        lot.winner = aliveBots[0];
        lot.paid = lot.price;
        return lot;
    }

    if (lot.userActive && aliveBots.length === 0) {
        lot.isFinished = true;
        lot.winner = "user";
        lot.paid = lot.price;
        return lot;
    }

    if (lot.userActive && aliveBots.length === 1) {
        lot.phase = "duel";
    }

    return lot;
}

//действие игрока в английском
export function applyEnglishUserAction(game, lot, action) {
    if (lot.isFinished) return lot;

    // режим ждуна
    if (action === "wait") {
        lot.phase = "waiting";
        return lot;
    }

    // игрок пасует и больше не участвует в этом лоте
    if (action === "pass") {
        lot.userActive = false;
        lot.logs.push("Вы спасовали");

        if (lot.activeBots.length === 1) {
            lot.isFinished = true;
            lot.winner = lot.activeBots[0];
            lot.paid = lot.price;
        }

        return lot;
    }

    //игрок повышает цену
    const step = action === "raise1" ? 1 : action === "raise2" ? 2 : 3;
    const nextPrice = lot.price + step;

    // если денег не хватает, ничего не делаем(
    if (nextPrice > game.userBank) {
        lot.logs.push("Недостаточно хрюблей для такой ставки");
        return lot;
    }

    lot.price = nextPrice;
    lot.leader = "user";
    lot.logs.push(`Вы повысили до ${lot.price}`);

    // если после этого осталась одна свинка, приступаем к дуэли)
    if (lot.activeBots.length === 1) {
        lot.phase = "duel";
    }

    return lot;
}

// готовим пороги для голландского
export function runDutchPrepare(game, lot) {
    const n = game.botCount + 1;
    const thresholds = {};

    // заранее счиаем цену, на которой каждая свинка готова взять лот
    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];
        const type = game.botTypes[id];
        thresholds[id] = getBotSealedBid(type, s, n);
    }

    return { ...lot, botThresholds: thresholds };
}

// первая цена
export function runFirstPrice(game, lot, userBid) {
    const n = game.botCount + 1;

    // сначала кладем ставку игрока
    const bids = [{ id: "user", bid: userBid, value: lot.userValue }];

    //  потом ставки свинок
    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];
        const type = game.botTypes[id];

        bids.push({
            id,
            bid: Math.min(getBotSealedBid(type, s, n), game.botBanks[id]),
            value: s,
        });
    }

    // сортируем по убыв ставок
    bids.sort((a, b) => b.bid - a.bid || (a.id === "user" ? -1 : 1));

    return {
        ...lot,
        isFinished: true,
        winner: bids[0].id,
        paid: bids[0].bid,
        winnerValue: bids[0].value,
        userBid,
    };
}

// викри
export function runVickrey(game, lot, userBid) {
    const bids = [{ id: "user", bid: userBid, value: lot.userValue }];

    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];

        // в викри свинки ставят посвоей истинной оценке
        bids.push({
            id,
            bid: Math.min(s, game.botBanks[id]),
            value: s,
        });
    }

    bids.sort((a, b) => b.bid - a.bid || (a.id === "user" ? -1 : 1));

    return {
        ...lot,
        isFinished: true,
        winner: bids[0].id,
        paid: secondHighest(bids.map((x) => x.bid)),
        winnerValue: bids[0].value,
        userBid,
    };
}

// приминяем результат лота к серии
export function settleLot(game, lot) {
    const next = {
        ...game,
        history: [...game.history],
    };

    const winnerValue =
        lot.winner === "user"
            ? lot.userValue
            : lot.botValues[lot.winner];

    // считаем  оба выигрыша
    const piSubj = winnerValue - lot.paid;
    const piEx = lot.x - lot.paid;

    // списываем деньги победителю
    if (lot.winner === "user") {
        next.userBank -= lot.paid;
        next.userWins += 1;
    } else if (lot.winner) {
        next.botBanks[lot.winner] -= lot.paid;
    }

    // записываем лот в историю
    next.history.push({
        lotNo: lot.lotNo,
        winner: lot.winner,
        price: lot.paid,
        x: lot.x,
        winnerValue,
        piSubj,
        piEx,
        usedToken: lot.useToken,
    });

    //переходим к следующему лоту
    next.currentLot += 1;

    return next;
}

// финальная сводка по серии
export function finishSeries(game) {
    //штраф, если выиграли < четверти лотов
    const penalty = game.userWins < game.minWins ? 100 : 0;

    const spent = game.history
        .filter((h) => h.winner === "user")
        .reduce((s, h) => s + h.price, 0);

    const subj = game.history
        .filter((h) => h.winner === "user")
        .reduce((s, h) => s + h.piSubj, 0);

    const ex = game.history
        .filter((h) => h.winner === "user")
        .reduce((s, h) => s + h.piEx, 0);

    const finalBank = game.userBank - penalty;

    return {
        penalty,
        spent,
        subj,
        ex,
        finalBank,
        roi: spent > 0 ? Math.round((ex / spent) * 100) : 0,
    };
}