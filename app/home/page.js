export default function Home() {
    return (
        <main className="min-h-screen bg-rose-100 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-white/70 rounded-2xl shadow-lg p-8 text-center">
                <h1 className="text-4xl font-bold">🐷 Хрюнляндия</h1>
                <p className="mt-3 text-slate-700">
                    Симулятор аукционной теории: английский, голландский, первая цена, Викри аукционы
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                        href="/learning"
                        className="px-6 py-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600"
                    >
                        Режим «Обучение»
                        <div className="text-sm font-normal opacity-90 mt-1">
                            Серии экспериментов, изучение стратегий
                        </div>
                    </a>

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

                <div className="mt-6 text-sm text-slate-500">
                    MVP-версия
                </div>
            </div>
        </main>
    );
}