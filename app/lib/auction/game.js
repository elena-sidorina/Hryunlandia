import { Rng } from "./rng";

// просто ограничиваем число
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// случайное целое через наш генератор
function randInt(rng, lo, hi) {
    return rng.int(lo, hi);
}

// перемешиваем массив
function shuffle(arr, rng) {
    const a = [...arr];

    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(rng, 0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
}

// сколько жетонов в серии
function getTokenCount(format, lots) {
    const open = format === "english" || format === "dutch";

    if (open) {
        if (lots === 3) return 1;
        if (lots === 5 || lots === 7) return 2;
        return 0;
    }

    if (lots === 5 || lots === 7) return 2;
    if (lots === 9) return 3;

    return 0;
}

// минимум побед без штрафа
function getMinWins(lots) {
    return Math.ceil(lots / 4);
}

// стартовый банк
function getStartBank(lots) {
    return lots * 100;
}

// границы шума вокруг x
function getNoiseRange(x, yPct) {
    const d = Math.round(x * yPct / 100);
    return [x - d, x + d];
}

// одна оценка с шумом
function genOneValue({ x, yPct, rng }) {
    const [lo, hi] = getNoiseRange(x, yPct);
    return clamp(randInt(rng, lo, hi), 0, 200);
}

// оценки игрока и свинок на лот
function genLotValues({ x, yPct, useToken, rng, botCount }) {
    const userNoise = useToken ? yPct / 2 : yPct;

    const userValue = genOneValue({ x, yPct: userNoise, rng });

    const botValues = {};
    for (let i = 1; i <= botCount; i++) {
        botValues[String(i)] = genOneValue({ x, yPct, rng });
    }

    return { userValue, botValues };
}

// скрытые типы свинок
// типы могут повторяться
function pickBotTypes(botCount, rng) {
    const all = ["honest", "aggressive", "rational", "cautious"];
    const picked = [];

    for (let i = 0; i < botCount; i++) {
        const idx = randInt(rng, 0, all.length - 1);
        picked.push(all[idx]);
    }

    return picked;
}

// стартовая цена в английском
function englishStartPrice(x, rng) {
    return Math.max(1, x - randInt(rng, 12, 22));
}

// стартовая цена в голландском
function dutchStartPrice(x) {
    if (x >= 181) return 240;
    if (x >= 151) return 210;
    if (x >= 126) return 180;
    if (x >= 104) return 150;
    if (x >= 86) return 120;
    if (x >= 74) return 100;
    return 90;
}

// предел для открытых аукционов
function getBotOpenLimit(type, s, x) {
    if (type === "honest") return s;
    if (type === "rational") return s;

    if (type === "cautious") {
        const b = Math.max(1, Math.floor(0.01 * x));
        return s - b;
    }

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

// вторая по величине ставка для викри
function secondHighest(arr) {
    const a = [...arr].sort((x, y) => y - x);
    return a[1] ?? a[0] ?? 0;
}

// создаем всю серию
export function createGameSeries({
    format,
    lots,
    botCount,
    yPct,
    tokensEnabled,
    seed,
}) {
    const baseSeed = Number.isFinite(Number(seed)) ? Number(seed) : Date.now();
    const rng = new Rng(baseSeed);

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

//создаем новый лот
export function createLot(game, { useToken = false }) {
    const rng = new Rng(game.baseSeed + game.currentLot * 1000);

    const x = randInt(rng, 60, 200);

    const { userValue, botValues } = genLotValues({
        x,
        yPct: game.yPct,
        useToken,
        rng,
        botCount: game.botCount,
    });

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

        // кто еще в торгах
        activeBots,
        userActive: true,

        // кто  сейчас лидер
        leader: null,

        // лог событий
        logs: [],

        // waiting/user_turn/duel/idle
        phase: game.format === "english" ? "waiting" : "idle",

        // служебные поля английского
        passedBots: [],
        roundOrder: [],
        turnIndex: 0,
        lastUserBid: null,
        lastBids: {
            user: null,
            ...Object.fromEntries(
                Array.from({ length: game.botCount }, (_, i) => [String(i + 1), null])
            ),
        },

        isFinished: false,
        winner: null,
        paid: null,
    };
}

// что делает свинка в английском
function getEnglishBotAction({
    type,
    s,
    x,
    price,
    bank,
    rng,
}) {
    const nextPrice = price + 1;

    if (bank < nextPrice) {
        return { action: "pass" };
    }

    if (type === "aggressive") {
        if (price >= s) return { action: "pass" };

        const doJump = randInt(rng, 1, 100) <= 30;

        if (doJump) {
            const jump = randInt(rng, 2, 3);
            const p = price + jump;

            if (p <= s && p <= bank) {
                return { action: "raise", step: jump };
            }
        }

        return { action: "raise", step: 1 };
    }

    const lim = getBotOpenLimit(type, s, x);

    if (nextPrice <= lim) {
        return { action: "raise", step: 1 };
    }

    return { action: "pass" };
}

// движок английского аукциона
class EnglishLotEngine {
    constructor(game, lot) {
        this.game = game;
        this.lot = {
            ...lot,
            activeBots: [...(lot.activeBots ?? [])],
            passedBots: [...(lot.passedBots ?? [])],
            roundOrder: [...(lot.roundOrder ?? [])],
            logs: [...(lot.logs ?? [])],
            lastBids: { ...(lot.lastBids ?? {}) },
        };
    }

    getState() {
        return this.lot;
    }

    // живые свинки то есть те что еще не пасанули
    getAliveBots() {
        return [...this.lot.activeBots];
    }

    // собираем новый раунд среди  свинок 
    // лидера из очереди исключаем
    buildRoundOrder() {
        const rng = new Rng(
            this.game.baseSeed +
            this.lot.lotNo * 10000 +
            this.lot.logs.length +
            1
        );

        const pool = this.getAliveBots().filter((id) => id !== this.lot.leader);
        this.lot.roundOrder = shuffle(pool, rng);
        this.lot.turnIndex = 0;
    }

    // завершение лота в разных ситуациях
    finishWithWinner(winnerId, paid) {
        this.lot.isFinished = true;
        this.lot.winner = winnerId;
        this.lot.paid = paid;
        this.lot.phase = "finished";
        return this.getState();
    }

    finishUnsold() {
        this.lot.isFinished = true;
        this.lot.winner = null;
        this.lot.paid = 0;
        this.lot.phase = "finished";
        return this.getState();
    }

    // это бот лидер и все остальныеуже выбыли
    botLeaderWinsNow() {
        return this.lot.leader && this.lot.leader !== "user" && this.getAliveBots().length === 1;
    }

    // это игрок лидер и все свинки уже выбыли
    userLeaderWinsNow() {
        return this.lot.leader === "user" && this.getAliveBots().length === 0;
    }

    // один следующий ход свинок
    advanceBots() {
        if (this.lot.isFinished) return this.getState();
        if (this.lot.phase !== "waiting") return this.getState();

        // если свинок вообще  не осталось
        if (this.getAliveBots().length === 0) {
            if (this.lot.leader === "user") {
                return this.finishWithWinner("user", this.lot.price);
            }

            if (this.lot.leader && this.lot.leader !== "user") {
                return this.finishWithWinner(this.lot.leader, this.lot.price);
            }

            return this.finishUnsold();
        }

        // если очередь пустая, начинаем новый раунд
        if (this.lot.roundOrder.length === 0) {
            this.buildRoundOrder();

            // если после генерации раунда никого нет
            if (this.lot.roundOrder.length === 0) {
                if (this.lot.leader === "user") {
                    return this.finishWithWinner("user", this.lot.price);
                }

                if (this.lot.leader && this.lot.leader !== "user") {
                    return this.finishWithWinner(this.lot.leader, this.lot.price);
                }

                return this.finishUnsold();
            }
        }

        // если раунд закочнился и в нем никто не повысил
        if (this.lot.turnIndex >= this.lot.roundOrder.length) {
            if (this.lot.leader === "user") {
                return this.finishWithWinner("user", this.lot.price);
            }

            if (this.lot.leader && this.lot.leader !== "user") {
                return this.finishWithWinner(this.lot.leader, this.lot.price);
            }

            return this.finishUnsold();
        }

        const botId = this.lot.roundOrder[this.lot.turnIndex];
        this.lot.turnIndex += 1;

        // если бот уже выбыл просто ждем следующий тик
        if (!this.lot.activeBots.includes(botId)) {
            return this.getState();
        }

        const type = this.game.botTypes[botId];
        const s = this.lot.botValues[botId];
        const bank = this.game.botBanks[botId];

        const rng = new Rng(
            this.game.baseSeed +
            this.lot.lotNo * 20000 +
            this.lot.logs.length +
            1
        );

        const botAction = getEnglishBotAction({
            type,
            s,
            x: this.lot.x,
            price: this.lot.price,
            bank,
            rng,
        });

        //бот пасует
        if (botAction.action === "pass") {
            this.lot.activeBots = this.lot.activeBots.filter((id) => id !== botId);
            this.lot.passedBots.push(botId);
            this.lot.logs.push(`Свин ${botId} спасовал`);

            // если осталсаь одна свинка и пользователь еще в игре,включаем дуэль
            if (this.lot.userActive && this.getAliveBots().length === 1) {
                this.lot.phase = "duel";
                this.lot.roundOrder = [];
                this.lot.turnIndex = 0;
                return this.getState();
            }

            // если пользователь уже выбыл и остался один бот
            if (!this.lot.userActive && this.getAliveBots().length === 1) {
                const onlyBot = this.getAliveBots()[0];
                return this.finishWithWinner(onlyBot, this.lot.price);
            }

            // если свинок не осталось
            if (this.getAliveBots().length === 0) {
                if (this.lot.leader === "user") {
                    return this.finishWithWinner("user", this.lot.price);
                }

                if (this.lot.leader && this.lot.leader !== "user") {
                    return this.finishWithWinner(this.lot.leader, this.lot.price);
                }

                return this.finishUnsold();
            }

            return this.getState();
        }

        // бот повышает ставку
        this.lot.price += botAction.step;
        this.lot.leader = botId;
        this.lot.lastBids[botId] = this.lot.price;
        this.lot.logs.push(`Свин ${botId} повысил до ${this.lot.price}`);

        //если пользователь в игре и осталась одна свинка, дуэль
        if (this.lot.userActive && this.getAliveBots().length === 1) {
            this.lot.phase = "duel";
            this.lot.roundOrder = [];
            this.lot.turnIndex = 0;
            return this.getState();
        }

        // если пользователь выбыл и остался один бот, он победил
        if (!this.lot.userActive && this.getAliveBots().length === 1) {
            return this.finishWithWinner(botId, this.lot.price);
        }

        // после  повышения сразу новый раунд без лидера
        this.buildRoundOrder();
        this.lot.phase = "waiting";

        // если после исключения лидера в раунде не кому ходить
        if (this.lot.roundOrder.length === 0) {
            return this.finishWithWinner(this.lot.leader, this.lot.price);
        }

        return this.getState();
    }

    // действие пользователя
    applyUserAction(action) {
        if (this.lot.isFinished) return this.getState();

        // пользователь только так сказать вклинивается
        if (action === "enter") {
            if (!this.lot.userActive) return this.getState();

            if (this.lot.phase === "waiting") {
                if (this.getAliveBots().length === 1) {
                    this.lot.phase = "duel";
                } else {
                    this.lot.phase = "user_turn";
                }
            }

            return this.getState();
        }

        // вернуться к наблюдению
        if (action === "wait") {
            if (this.lot.phase === "user_turn") {
                this.lot.phase = "waiting";
            }
            return this.getState();
        }

        //  в обычном режиме пользователь может ходить только в user_turn или duel
        if (this.lot.phase !== "user_turn" && this.lot.phase !== "duel") {
            return this.getState();
        }

        // пас пользователя
        if (action === "pass") {
            // если пользователь сейчас лидер, пас запрещаем
            if (this.lot.leader === "user") {
                this.lot.logs.push("Вы лидер торгов");
                return this.getState();
            }

            this.lot.userActive = false;
            this.lot.logs.push("Вы спасовали");

            // если осталась одна свинка, она победила
            if (this.getAliveBots().length === 1) {
                const onlyBot = this.getAliveBots()[0];
                return this.finishWithWinner(onlyBot, this.lot.price);
            }

            // если свинок не осталось, лот непродан
            if (this.getAliveBots().length === 0) {
                return this.finishUnsold();
            }

            this.lot.phase = "waiting";
            return this.getState();
        }

        if (
            this.lot.leader === "user" &&
            (action === "raise1" || action === "raise2" || action === "raise3")
        ) {
            this.lot.logs.push("Вы уже являетесь лидером торгов");
            return this.getState();
        }

        const step =
            action === "raise1" ? 1 :
                action === "raise2" ? 2 :
                    action === "raise3" ? 3 :
                        0;

        if (step === 0) return this.getState();

        const nextPrice = this.lot.price + step;

        if (nextPrice > this.game.userBank) {
            this.lot.logs.push("Недостаточно хрюблей для такой ставки");
            return this.getState();
        }

        this.lot.price = nextPrice;
        this.lot.leader = "user";
        this.lot.lastUserBid = this.lot.price;
        this.lot.lastBids.user = this.lot.price;
        this.lot.logs.push(`Вы повысили до ${this.lot.price}`);

        // если свинок не осталось, игрок победил
        if (this.getAliveBots().length === 0) {
            return this.finishWithWinner("user", this.lot.price);
        }

        //если осталась одна свинка, дуэль
        if (this.getAliveBots().length === 1) {
            this.lot.phase = "duel";
            this.lot.roundOrder = [];
            this.lot.turnIndex = 0;
            return this.getState();
        }

        // после ставки игрока снова запускаем  раунд свинок
        this.buildRoundOrder();
        this.lot.phase = "waiting";

        return this.getState();
    }

    // ответ последней свикни в дуэли
    advanceDuelBot() {
        if (this.lot.isFinished) return this.getState();
        if (this.lot.phase !== "duel") return this.getState();
        if (!this.lot.userActive) return this.getState();

        const aliveBots = this.getAliveBots();

        // дуэль только если осталась одна свинка
        if (aliveBots.length !== 1) return this.getState();

        // !!! свинка отвечает только! если сейчас лидер игрок
        if (this.lot.leader !== "user") return this.getState();

        const botId = aliveBots[0];
        const type = this.game.botTypes[botId];
        const s = this.lot.botValues[botId];
        const bank = this.game.botBanks[botId];

        const rng = new Rng(
            this.game.baseSeed +
            this.lot.lotNo * 30000 +
            this.lot.logs.length +
            1
        );

        const botAction = getEnglishBotAction({
            type,
            s,
            x: this.lot.x,
            price: this.lot.price,
            bank,
            rng,
        });

        // если свинка пасует, игрок победил
        if (botAction.action === "pass") {
            this.lot.activeBots = [];
            this.lot.passedBots.push(botId);
            this.lot.logs.push(`Свин ${botId} спасовал`);
            return this.finishWithWinner("user", this.lot.price);
        }

        // свинка повышает
        this.lot.price += botAction.step;
        this.lot.leader = botId;
        this.lot.lastBids[botId] = this.lot.price;
        this.lot.logs.push(`Свин ${botId} повысил до ${this.lot.price}`);

        // дуэль продолжается, теперь ход пользователя
        return this.getState();
    }
}

// один следующий ход свинок в английском
export function applyEnglishBotStep(game, lot) {
    const eng = new EnglishLotEngine(game, lot);
    return eng.advanceBots();
}

// действие игрока в английском
export function applyEnglishUserAction(game, lot, action) {
    const eng = new EnglishLotEngine(game, lot);
    return eng.applyUserAction(action);
}

// ответ свинки в дуэли
export function applyEnglishDuelBotStep(game, lot) {
    const eng = new EnglishLotEngine(game, lot);
    return eng.advanceDuelBot();
}

// для голландского
export function runDutchPrepare(game, lot) {
    const n = game.botCount + 1;
    const thresholds = {};

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

    const bids = [{ id: "user", bid: userBid, value: lot.userValue }];

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

// применяем результат лота
export function settleLot(game, lot) {
    const next = {
        ...game,
        history: [...game.history],
    };

    const winnerValue =
        lot.winner === "user"
            ? lot.userValue
            : lot.winner
                ? lot.botValues[lot.winner]
                : null;

    const piSubj = winnerValue == null ? 0 : winnerValue - lot.paid;
    const piEx = lot.winner == null ? 0 : lot.x - lot.paid;

    if (lot.winner === "user") {
        next.userBank -= lot.paid;
        next.userWins += 1;
    } else if (lot.winner) {
        next.botBanks[lot.winner] -= lot.paid;
    }

    next.history.push({
        lotNo: lot.lotNo,
        winner: lot.winner,
        price: lot.paid,
        x: lot.x,
        winnerValue,
        piSubj,
        piEx,
        usedToken: lot.useToken,
        lastUserBid: lot.lastUserBid,
    });

    next.currentLot += 1;

    return next;
}

// финальная сводка
export function finishSeries(game) {
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