import { Rng } from "./rng";

// просто ограничиваем число
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// случайное целое через наш генератор
function randInt(rng, lo, hi) {
    return rng.int(lo, hi);
}

// перемешиваем массив по нашему rng (генератор с seed)
// при одном seed порядок будет повторяться
function shuffle(arr, rng) {
    const a = [...arr];

    for (let i = a.length - 1; i > 0; i--) {
        // выбираем случайный индекс от 0 до i
        // потом меняем элементы местами
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
    return clamp(randInt(rng, lo, hi), 0, 250);
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

// выбираем картинки лотов для одной серии
// мешаем все 18, берем только столько, сколько лотов в серии
function pickLotImages(lots, rng) {
    // тут создаем массив, это номера файлов lot1.jpg, lot2.jpg ...
    const all = Array.from({ length: 18 }, (_, i) => i + 1);
    // shuffle мешает массив по seed, при одном seed порядок будет один
    // slice(0, lots) берет первые lots штук из уже перемешанного списка
    return shuffle(all, rng).slice(0, lots);
}

// стартовая цена в английском
function englishStartPrice(x, rng) {
    return Math.max(1, x - randInt(rng, 16, 25));
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

// предел для английского аукциона
//логика такая же ккак в голландском и первой цене
// считаем максимальную цену, до которой свинка готова идти в открытом аукционе
function getBotOpenLimit(type, s, n) {
    if (type === "honest") return s;
    if (type === "aggressive") return Math.round(0.95 * s);
    if (type === "cautious") return Math.round(0.8 * s);
    if (type === "rational") return Math.round((1 - 1 / n) * s);

    return s;
}

// ставка в закрытых аукционах
// считаем закрытую ставку свинки по ее типу
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
    // если seed нормальный, используем его, иначе берем текущее время
    const baseSeed = Number.isFinite(Number(seed)) ? Number(seed) : Date.now();
    // создаем генератор случайностей для всей серии
    // если seed одинаковый, то и серия получится такая же
    const rng = new Rng(baseSeed);

    // заранее выбираем картинки для всех лотов в серии
    // чтобы в одной серии картинки не повторялись
    const lotImageOrder = pickLotImages(lots, rng);

    // тут храним скрытые типы свинок
    const botTypes = {};

    // выбираем типы сопергиков
    // после правки типы могут повторяться, напр две агрессивные свинки
    const picked = pickBotTypes(botCount, rng);

    for (let i = 1; i <= botCount; i++) {
        botTypes[String(i)] = picked[i - 1];
    }

    // банк зависит от числа лотов: на каждый лот по 100 хрюблей
    const bank = getStartBank(lots);
    // жетоны выдаем только если они включены в настройках
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

        // банки ботов, у каждого сначала такой же банк, как у игрока
        botBanks: Object.fromEntries(
            Array.from({ length: botCount }, (_, i) => [String(i + 1), bank])
        ),

        minWins: getMinWins(lots),
        userWins: 0,
        currentLot: 1,

        // порядок картинок лотов на всю серию
        // напр [12, 3, 8]
        lotImageOrder,

        // сурытые типы свинок, игрок увидит их только в конце
        botTypes,

        // история всех сыгранных лотов
        history: [],
    };
}

//создаем новый лот
export function createLot(game, { useToken = false }) {
    // для каждого лота свой rng, чтобы лоты были разными, но повторяемыми по seed
    const rng = new Rng(game.baseSeed + game.currentLot * 1000);

    // истинная ценность лота случайная в заданном диапазоне
    const x = randInt(rng, 60, 200);

    const { userValue, botValues } = genLotValues({
        x,
        yPct: game.yPct,
        useToken,
        rng,
        botCount: game.botCount,
    });

    // в начале лота все свинки еще участвуют
    const activeBots = Array.from({ length: game.botCount }, (_, i) => String(i + 1));

    // выбираем картинку для определ лота
    // currentLot начинается с 1, а массивы в js с 0, поэтому пишем -1
    // если вдруг массива нет,просто берем номер текущего лота
    const lotImageId =
        game.lotImageOrder?.[game.currentLot - 1] ?? game.currentLot;

    // стартовая цена нужна только для открытых форматов
    let startPrice = 0;

    if (game.format === "english") startPrice = englishStartPrice(x, rng);
    if (game.format === "dutch") startPrice = dutchStartPrice(x);

    return {
        lotNo: game.currentLot,

        // номер картинки лота
        // на фронте из этого потом делаем путь /lots/lotN.jpg
        lotImageId,

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
    n,
    price,
    bank,
    rng,
}) {
    // лимит ограничен и стратегией свинки, и ее банком
    const lim = Math.min(getBotOpenLimit(type, s, n), bank);
    // минимальное повышение в английском — на 1 хрюбль
    const nextPrice = price + 1;

    if (nextPrice > lim) {
        return { action: "pass" };
    }

    // агрессивная свинка иногда прыгает сразу на +2 или +3
    if (type === "aggressive") {
        const doJump = randInt(rng, 1, 100) <= 30;

        if (doJump) {
            const jump = randInt(rng, 2, 3);
            const p = price + jump;

            if (p <= lim) {
                return { action: "raise", step: jump };
            }
        }
    }

    return { action: "raise", step: 1 };
}

// движок английского аукциона
// отдельный класс, чтобы не размазывать логику английского по всему файлу
class EnglishLotEngine {
    // копируем лот, чтобы аккуратно менять его внутри движка
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

        // лидер не ходит сам против себя, поэтому убираем его из очереди
        const pool = this.getAliveBots().filter((id) => id !== this.lot.leader);
        // порядок хода свинок случайный, но повторяемый при том же seed
        this.lot.roundOrder = shuffle(pool, rng);
        this.lot.turnIndex = 0;
    }

    // завершение лота в разных ситуациях
    finishWithWinner(winnerId, paid) {
        // помечаем лот завершенным и записываем победителя
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

    // проверяем, может ли одна свинка купить по текущ цене
    finishSingleBotIfPossible(botId) {
        const type = this.game.botTypes[botId];
        const s = this.lot.botValues[botId];
        const bank = this.game.botBanks[botId];
        const n = this.game.botCount + 1;

        // если осталась одна свинка, проверяем, готова ли она купить по текущ цене
        const lim = Math.min(getBotOpenLimit(type, s, n), bank);

        if (this.lot.price <= lim) {
            return this.finishWithWinner(botId, this.lot.price);
        }

        this.lot.activeBots = this.lot.activeBots.filter((id) => id !== botId);
        this.lot.passedBots.push(botId);
        this.lot.logs.push(`Свин ${botId} спасовал`);

        if (this.lot.leader && this.lot.leader !== botId) {
            return this.finishWithWinner(this.lot.leader, this.lot.price);
        }

        return this.finishUnsold();
    }

    // это игрок лидер и все свинки уже выбыли
    userLeaderWinsNow() {
        return this.lot.leader === "user" && this.getAliveBots().length === 0;
    }

    // один следующий ход свинок
    // этот метод вызывается таймером с фронта для автохода свинок
    advanceBots() {
        // если лот уже закрыт, ничего не делаем
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

        // берем следующую свинку из очереди текущего раунда
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

        // решаем: свинка пасует или повышает ставку
        const botAction = getEnglishBotAction({
            type,
            s,
            n: this.game.botCount + 1,
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

            // если игрок выбыл и осталась одна свинка
            if (!this.lot.userActive && this.getAliveBots().length === 1) {
                const onlyBot = this.getAliveBots()[0];
                return this.finishSingleBotIfPossible(onlyBot);
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
        // если свинка повысила, новая цена становится текущей
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

        // если игрок выбыл и осталась одна свинка
        if (!this.lot.userActive && this.getAliveBots().length === 1) {
            return this.finishSingleBotIfPossible(botId);
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
    // сюда приходят действия игрока из интерфейса
    applyUserAction(action) {
        if (this.lot.isFinished) return this.getState();

        // пользователь только так сказать вклинивается
        // игрок может вручную войти в торги после наблюдения
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

            // если осталась одна свинка, сначала проверяем лимит
            if (this.getAliveBots().length === 1) {
                const onlyBot = this.getAliveBots()[0];
                return this.finishSingleBotIfPossible(onlyBot);
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

        // из названия кнопки получаем размер повышения
        const step =
            action === "raise1" ? 1 :
                action === "raise2" ? 2 :
                    action === "raise3" ? 3 :
                        0;

        if (step === 0) return this.getState();

        // считам цену после ставки игрока
        const nextPrice = this.lot.price + step;

        if (nextPrice > this.game.userBank) {
            this.lot.logs.push("Недостаточно хрюблей для такой ставки");
            return this.getState();
        }

        // игрок становится лидером после успешного повышения
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
    // ответ последней свинки, когда остались игрок и один бот
    advanceDuelBot() {
        if (this.lot.isFinished) return this.getState();
        if (this.lot.phase !== "duel") return this.getState();
        if (!this.lot.userActive) return this.getState();

        // в дуэли должна остаться ровно одна активная свинка
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

        // последняя свинка тоже смотрит на свой лимит и банк
        const botAction = getEnglishBotAction({
            type,
            s,
            n: this.game.botCount + 1,
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
// обертки ниже вызываются из api/game/route.js
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
// готовим пороги свинок для голландского аукциона
export function runDutchPrepare(game, lot) {
    const n = game.botCount + 1;
    // сюда кладем цену, на которой каждая свинка готова забрать лот
    const thresholds = {};

    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];
        const type = game.botTypes[id];
        // в голландском порог считается так же, как закрытая ставка
        thresholds[id] = getBotSealedBid(type, s, n);
    }

    return { ...lot, botThresholds: thresholds };
}

// первая цена
// расчет закрытого аукциона первой цены
export function runFirstPrice(game, lot, userBid) {
    const n = game.botCount + 1;

    // сначала добавляем ставку игрока
    const bids = [{ id: "user", bid: userBid, value: lot.userValue }];

    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];
        const type = game.botTypes[id];

        // потом добавляем ставки всех свинок
        bids.push({
            id,
            bid: Math.min(getBotSealedBid(type, s, n), game.botBanks[id]),
            value: s,
        });
    }

    // сортируем по убыванию ставки, при равенстве игрок выше
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
// расчет аукциона викри
export function runVickrey(game, lot, userBid) {
    // снова сначала берем ставку игрока
    const bids = [{ id: "user", bid: userBid, value: lot.userValue }];

    for (let i = 1; i <= game.botCount; i++) {
        const id = String(i);
        const s = lot.botValues[id];

        // в викри свинки ставят свою субъективную оценку без шейдинга
        bids.push({
            id,
            bid: Math.min(s, game.botBanks[id]),
            value: s,
        });
    }

    // сортируем ставки, чтобы первым был победитель
    bids.sort((a, b) => b.bid - a.bid || (a.id === "user" ? -1 : 1));

    return {
        ...lot,
        isFinished: true,
        winner: bids[0].id,
        // победитель платит вторую по величине ставку
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

    // оценка победителя нужна для субъективного выигрыша
    const winnerValue =
        lot.winner === "user"
            ? lot.userValue
            : lot.winner
                ? lot.botValues[lot.winner]
                : null;

    // субъективный выигрыш = оценка победителя минус цена
    const piSubj = winnerValue == null ? 0 : winnerValue - lot.paid;
    // ex post выигрыш = истинная ценность минус цена
    const piEx = lot.winner == null ? 0 : lot.x - lot.paid;

    // если выиграл игрок, списываем цену с его банка
    if (lot.winner === "user") {
        next.userBank -= lot.paid;
        next.userWins += 1;
    } else if (lot.winner) {
        next.botBanks[lot.winner] -= lot.paid;
    }

    // сохраняем лот в историю, чтобы потом показать итоговую таблицу
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
    // штраф, если игрок купил слишком мало лотов
    const penalty = game.userWins < game.minWins ? 100 : 0;

    // считаем, сколько игрок всего потратил
    const spent = game.history
        .filter((h) => h.winner === "user")
        .reduce((s, h) => s + h.price, 0);

    // суммарный субъективный выигрыш игрока
    const subj = game.history
        .filter((h) => h.winner === "user")
        .reduce((s, h) => s + h.piSubj, 0);

    // суммарный ex post выигрыш игрока
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
        // roi показывает результат относительно потраченных денег
        roi: spent > 0 ? Math.round((ex / spent) * 100) : 0,
    };
}
