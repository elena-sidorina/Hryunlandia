export default function Home() {
    // главная страница с выбором режима
    return (
        <main className="min-h-screen bg-rose-100 flex items-center justify-center p-8">
            {/* общий контейнер, чтобы карточка была по центру */}
            <div className="max-w-2xl w-full">
                {/* кнопка возврата на самый первый экран */}
                <a
                    href="/"
                    className="mb-4 inline-flex items-center rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/90"
                >
                    ← На главную
                </a>

                {/* главная карточка с описанием приложеня */}
                <div className="w-full bg-white/70 rounded-2xl shadow-lg p-8 text-center">
                    <h1 className="text-4xl font-bold">🐷 Хрюнляндия</h1>

                    {/* короткое описание проекта */}
                    <p className="mt-3 text-slate-700">
                        Симулятор аукционной теории: английский, голландский, первая цена, Викри аукционы
                    </p>

                    {/* две кнопки выбора режима */}
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* переход в режим обучения */}
                        <a
                            href="/learning"
                            className="px-6 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600"
                        >
                            Режим «Обучение»
                            <div className="text-sm font-normal opacity-90 mt-1">
                                Серии экспериментов, изучение стратегий
                            </div>
                        </a>

                        {/* переход в режим игры */}
                        <a
                            href="/game"
                            className="px-6 py-4 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600"
                        >
                            Режим «Игра»
                            <div className="text-sm font-normal opacity-90 mt-1">
                                Торги против ботов
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}