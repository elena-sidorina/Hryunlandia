"use client";

import { useState } from "react";
// чтобы хранить выбранные значения

export default function LearningPage() {

    // тут просто храним выбранные параметры
    const [auctionType, setAuctionType] = useState("english");
    // по умолчанию английский

    const [lotsCount, setLotsCount] = useState(3);
    // сколько лотов в серии (старт 3)

    const [botsCount, setBotsCount] = useState(3);
    // сколько ботов (тоже 3 по умолчанию)

    const [noise, setNoise] = useState(10);
    // шум оценки, пока 10%

    const [resultText, setResultText] = useState("");
    // сюда будем выводить результат (сначала пусто)

    function runDemo() {
        // пока это просто тест, позже тут будет реальный расчёт

        const text =
            `Демо-эксперимент запущен.\n` +
            `Тип аукциона: ${auctionType}\n` +
            `Лотов: ${lotsCount}\n` +
            `Ботов: ${botsCount}\n` +
            `Шум оценки y: ${noise}%\n\n` +
            `Потом здесь будет таблица с ценами и победителями.`;

        setResultText(text);
        // обновляем состояние
    }

    return (
        <main className="min-h-screen bg-rose-100 p-8">
            {/* просто ссылка назад */}
            <div className="max-w-4xl mx-auto">
                <a href="/" className="text-green-600">
                    ← На главную
                </a>

                <h1 className="text-3xl font-bold mt-4">
                    Режим «Обучение»
                </h1>

                <p className="mt-2 text-slate-700">
                    Тут можно запускать симуляции и смотреть что происходит
                </p>

                {/* делаем 2 колонки: слева параметры, справа результат */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* блок с настройками */}
                    <div className="bg-white rounded-2xl shadow p-6">
                        <h2 className="text-xl font-semibold">
                            Параметры эксперимента
                        </h2>

                        {/* выбор типа аукциона */}
                        <div className="mt-4">
                            <label className="block font-medium">
                                Тип аукциона
                            </label>

                            <select
                                className="mt-1 w-full border rounded-lg p-2"
                                value={auctionType}
                                onChange={(e) => setAuctionType(e.target.value)}
                            // когда меняем select, обновляем auctionType
                            >
                                <option value="english">Английский</option>
                                <option value="dutch">Голландский</option>
                                <option value="first">Первая цена</option>
                                <option value="vickrey">Викри</option>
                            </select>
                        </div>

                        {/* сколько лотов */}
                        <div className="mt-4">
                            <label className="block font-medium">
                                Количество лотов
                            </label>

                            <select
                                className="mt-1 w-full border rounded-lg p-2"
                                value={lotsCount}
                                onChange={(e) => setLotsCount(Number(e.target.value))}
                            // Number нужен потому что select возвращает строку
                            >
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={7}>7</option>
                            </select>
                        </div>

                        {/* сколько ботов */}
                        <div className="mt-4">
                            <label className="block font-medium">
                                Количество ботов
                            </label>

                            <select
                                className="mt-1 w-full border rounded-lg p-2"
                                value={botsCount}
                                onChange={(e) => setBotsCount(Number(e.target.value))}
                            >
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                            </select>
                        </div>

                        {/* шум */}
                        <div className="mt-4">
                            <label className="block font-medium">
                                Шум оценки y
                            </label>

                            <select className="mt-1 w-full border rounded-lg p-2"
                                value={noise}
                                onChange={(e) => setNoise(Number(e.target.value))}
                            >
                                <option value={5}>5%</option>
                                <option value={10}>10%</option>
                                <option value={15}>15%</option>
                            </select>
                        </div>

                        {/* кнопка запуска */}
                        <button
                            onClick={runDemo}
                            className="mt-6 w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                        >
                            Запустить демо
                        </button>

                        <div className="mt-4 text-sm text-slate-500">
                            Сейчас это просто проверка интерфейса.
                        </div>
                    </div>

                    {/* блок результата */}
                    <div className="bg-white rounded-2xl shadow p-6">
                        <h2 className="text-xl font-semibold">
                            Результат
                        </h2>

                        <pre className="mt-4 whitespace-pre-wrap text-slate-800 bg-slate-100 rounded-xl p-4 min-h-[220px]">
                            {resultText || "Пока пусто. Нажми кнопочку 👈"}
                        </pre>
                    </div>

                </div>
            </div>
        </main >
    );
}