import { NextResponse } from "next/server";
import {
    createGameSeries,
    createLot,
    applyEnglishBotStep,
    applyEnglishUserAction,
    applyEnglishDuelBotStep,
    runDutchPrepare,
    runFirstPrice,
    runVickrey,
    settleLot,
    finishSeries,
} from "@/app/lib/auction/game";

function clampInt(v, lo, hi, def) {
    // переводим значение в число
    const n = Number(v);

    // если пришло не число, берем значение по умолчанию
    if (!Number.isFinite(n)) return def;

    // округляем и ограничиваем число снизу и сверху
    const x = Math.round(n);
    return Math.max(lo, Math.min(hi, x));
}

export async function POST(req) {
    try {
        const body = await req.json();
        const mode = body.mode;

        // старт новой серии
        if (mode === "start") {
            const format = body.format;

            // английский и голландский считаем открытыми форматами
            const open = format === "english" || format === "dutch";

            // для открытых и закрытых форматов разные допустимые числа лотов
            const lots = open
                ? clampInt(body.lots, 3, 7, 5)
                : clampInt(body.lots, 5, 9, 5);

            // ограничиваем настройки, чтобы пользователь не сломал модель
            const botCount = clampInt(body.botCount, 2, 4, 3);
            const yPct = clampInt(body.yPct, 5, 15, 10);
            const tokensEnabled = !!body.tokensEnabled;

            const game = createGameSeries({
                format,
                lots,
                botCount,
                yPct,
                tokensEnabled,
                seed: body.seed,
            });

            return NextResponse.json({ ok: true, game });
        }

        // новый лот
        if (mode === "new_lot") {
            const game = body.game;
            const useToken = !!body.useToken;

            const lot = createLot(game, { useToken });

            return NextResponse.json({ ok: true, lot });
        }

        // автоход свинки в английском
        if (mode === "english_bot_step") {
            const game = body.game;
            const lot = applyEnglishBotStep(game, body.lot);

            return NextResponse.json({ ok: true, lot });
        }

        // действие игрока в английском
        if (mode === "english_user_action") {
            const game = body.game;
            const action = body.action;
            const lot = applyEnglishUserAction(game, body.lot, action);

            return NextResponse.json({ ok: true, lot });
        }

        // ответ свинки в дуэли
        if (mode === "english_duel_bot_step") {
            const game = body.game;
            const lot = applyEnglishDuelBotStep(game, body.lot);

            return NextResponse.json({ ok: true, lot });
        }

        // подготавливаем голландский
        if (mode === "dutch_prepare") {
            const game = body.game;
            const lot = runDutchPrepare(game, body.lot);

            return NextResponse.json({ ok: true, lot });
        }

        // первая цена
        if (mode === "first_price") {
            const game = body.game;

            const lot = runFirstPrice(
                game,
                body.lot,
                // ставка игрока не может быть меньше 0 и больше его банка
                clampInt(body.userBid, 0, game.userBank, 0)
            );

            return NextResponse.json({ ok: true, lot });
        }

        // викри
        if (mode === "vickrey") {
            const game = body.game;

            const lot = runVickrey(
                game,
                body.lot,
                // ставка игрока не может быть меньше 0 и больше его банка
                clampInt(body.userBid, 0, game.userBank, 0)
            );

            return NextResponse.json({ ok: true, lot });
        }

        // применяем результат лота
        if (mode === "settle") {
            const game = settleLot(body.game, body.lot);
            return NextResponse.json({ ok: true, game });
        }

        // финальная сводка
        if (mode === "finish") {
            const summary = finishSeries(body.game);
            return NextResponse.json({ ok: true, summary });
        }

        // если режим неизвестен, возвращаем ошибку
        return NextResponse.json(
            { ok: false, error: "Unknown game mode" },
            { status: 400 }
        );
    } catch (e) {
        // если что-то сломалось на сервере, возвращаем ошибку
        return NextResponse.json(
            { ok: false, error: String(e) },
            { status: 500 }
        );
    }
}