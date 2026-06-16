import Link from "next/link";

// основные 4 аукциона, которые показываем в справке
const auctions = [
    {
        title: "Английский аукцион",
        tag: "открытый · цена растёт",
        emoji: "📈",
        color: "bg-blue-50 border-blue-200",
        what: "Участники открыто повышают цену. Торги продолжаются, пока не останется один активный участник.",
        history:
            "Это один из самых узнаваемых форматов публичных торгов. Его исторические предшественники встречались ещё в классических открытых торгах, а в Англии в XVII–XVIII веках были популярны аукционы «по свече»: торги завершались, когда догорала свеча, чтобы никто точно не знал момент окончания.",
        strategy:
            "В нашей игре свинки в английском аукционе ориентируются на свою максимальную готовность платить. Честная и рациональная свинка идут примерно до своей оценки, осторожная выходит раньше, агрессивная может делать скачки +2 или +3, но тоже не должна уходить сильно выше своей оценки.",
        inGame:
            "Для игрока хорошая стратегия — не переплачивать выше своей оценки, повышать минимально и следить, кто ещё остаётся в торгах. Если Вы уже лидер, перебивать самого себя не нужно.",
    },
    {
        title: "Голландский аукцион",
        tag: "открытый · цена падает",
        emoji: "⏳",
        color: "bg-yellow-50 border-yellow-200",
        what: "Аукционист начинает с высокой цены и постепенно снижает её. Первый участник, который соглашается купить, забирает лот по текущей цене.",
        history:
            "Формат тесно связан с торговлей скоропортящимися товарами, особенно с цветочными аукционами в Нидерландах. Такой механизм удобен, когда нужно быстро продавать большое количество однородного товара.",
        strategy:
            "По стратегическому смыслу голландский аукцион близок к аукциону первой цены: участник заранее выбирает свой порог, при котором готов купить.",
        inGame:
            "В нашей игре цена падает постепенно, а игрок нажимает «Беру!». Хорошая стратегия — заранее решить, при какой цене лот ещё выгоден, и не ждать слишком долго, потому что соперник может забрать его раньше.",
    },
    {
        title: "Аукцион первой цены",
        tag: "закрытый · победитель платит свою ставку",
        emoji: "✉️",
        color: "bg-pink-50 border-pink-200",
        what: "Все участники тайно подают ставки. Побеждает максимальная ставка, и победитель платит именно свою ставку.",
        history:
            "Закрытые аукционы первой цены часто используются там, где участники не должны видеть ставки друг друга: например, в конкурсах, тендерах и закупках.",
        strategy:
            "Главная идея — не просто выиграть, а выиграть без переплаты. Поэтому участники часто шейдят ставку, то есть ставят ниже своей оценки.",
        inGame:
            "В нашей модели честная свинка ставит по оценке, агрессивная ставит близко к оценке, рациональная снижает ставку по формуле, осторожная снижает сильнее. Игроку тоже обычно выгодно немного занизить ставку, иначе можно выиграть лот, но получить отрицательный выигрыш.",
    },
    {
        title: "Аукцион Викри",
        tag: "закрытый · победитель платит вторую цену",
        emoji: "🏆",
        color: "bg-violet-50 border-violet-200",
        what: "Все участники тайно подают ставки. Побеждает максимальная ставка, но победитель платит не свою ставку, а вторую по величине.",
        history:
            "Этот формат связан с работой Уильяма Викри. В 1961 году он опубликовал статью о закрытых аукционах и конкурентных тендерах, где формально разобрал аукцион второй цены.",
        strategy:
            "Классическая идея Викри: при стандартных предпосылках участнику выгодно ставить свою настоящую оценку. Если поставить ниже, можно случайно проиграть выгодный лот. Если поставить выше, можно выиграть лот, который на самом деле не стоил такой ставки.",
        inGame:
            "В нашей игре свинки в Викри не шейдят и ставят ровно по своей субъективной оценке. Поэтому этот формат специально отличается от первой цены: здесь победитель определяется по честным оценкам, а платит вторую ставку.",
    },
];

// короткий блок про другие форматы аукционов
const otherAuctions = [
    {
        title: "Аукцион со всеобщей оплатой",
        text: "Все участники платят свои ставки, даже если не выиграли. Такой формат часто используют как модель конкурсов, лоббирования или соревнований за приз.",
    },
    {
        title: "Обратный аукцион",
        text: "Не покупатели повышают цену, а продавцы конкурируют за заказ и снижают цену. Часто используется в закупках.",
    },
    {
        title: "Двусторонний аукцион",
        text: "Покупатели и продавцы одновременно подают заявки. Такой принцип близок к работе бирж и рынков с большим числом заявок.",
    },
    {
        title: "Многообъектный аукцион",
        text: "Продаётся не один лот, а сразу несколько объектов. Такие механизмы важны, например, для частот, электроэнергии и сложных торгов.",
    },
];

// поведение свинок в разных форматах
const pigBehaviors = [
    {
        title: "Честная",
        img: "/pigs/honest_pig.png",
        color: "bg-blue-50 border-blue-200",
        text: "Ставит по своей субъективной оценке. В Викри это особенно логично, потому что ставка по оценке является безопасной стратегией.",
    },
    {
        title: "Рациональная",
        img: "/pigs/rational_pig.png",
        color: "bg-green-50 border-green-200",
        text: "В первой цене и голландском формате снижает ставку по формуле. В нашей модели при 4 участниках это примерно 0.75 от оценки.",
    },
    {
        title: "Агрессивная",
        img: "/pigs/agressive_pig.png",
        color: "bg-rose-50 border-rose-200",
        text: "Ставит близко к своей оценке. В открытых торгах может делать резкие повышения, но в закрытых форматах всё равно учитывает стратегический коэффициент.",
    },
    {
        title: "Осторожная",
        img: "/pigs/cautious_pig.png",
        color: "bg-yellow-50 border-yellow-200",
        text: "Сильнее снижает ставку и раньше выходит из открытых торгов. Её цель — уменьшить риск переплаты.",
    },
];

// источники, которые открываются по ссылкам
const sources = [
    {
        title: "К. Сонин — «Основы теории аукционов»",
        note: "Русский источник: базовые типы аукционов, стратегии, связь форматов.",
        href: "https://voices.uchicago.edu/ksonin/files/2019/04/SoninAuctionsVE2021.pdf",
    },
    {
        title: "С. Пивоварова, ВШЭ — «Теория аукционов»",
        note: "Русский источник: 4 основных типа аукционов и стратегические эквивалентности.",
        href: "https://www.hse.ru/data/2012/01/26/1264433944/lecture_06_12.pdf",
    },
    {
        title: "William Vickrey, 1961 — Counterspeculation, Auctions, and Competitive Sealed Tenders",
        note: "Классическая статья про аукцион второй цены и закрытые конкурентные торги.",
        href: "https://cramton.umd.edu/market-design-papers/vickrey-counterspeculation-auctions-and-competitive-sealed-tenders.pdf",
    },
    {
        title: "Britannica — Dutch auction / Auction",
        note: "Краткие определения английского и голландского форматов.",
        href: "https://www.britannica.com/topic/Dutch-auction",
    },
    {
        title: "Jonathan Levin — Auction Theory",
        note: "Иностранный учебный материал по теории аукционов и эквивалентности доходов.",
        href: "https://web.stanford.edu/~jdlevin/Econ%20286/Auctions.pdf",
    },
];

// страница со справкой по теории аукционов
export default function LearningHelpPage() {
    return (
        <main className="min-h-screen bg-rose-100 px-4 py-6 sm:p-8">
            {/* общий контейнер страницы */}
            <div className="w-full max-w-3xl mx-auto">
                {/* кнопки навигации назад */}
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/learning?restore=1"
                        className="inline-flex items-center rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/90"
                    >
                        ← Назад к обучению
                    </Link>

                    <Link
                        href="/"
                        className="inline-flex items-center rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/90"
                    >
                        ← На главную
                    </Link>
                </div>

                {/* заголовок справки */}
                <h1 className="mt-6 text-4xl font-extrabold">
                    Справка по аукционам
                </h1>

                <p className="mt-4 max-w-4xl text-lg text-slate-700 leading-relaxed">
                    Здесь собрана теория по четырём форматам, которые используются в Хрюнляндии:
                    английскому, голландскому, аукциону первой цены и аукциону Викри. Справка
                    объясняет не только правила, но и то, почему свинки ведут себя именно так.
                </p>

                {/* блок с разделением на открытые и закрытые аукционы */}
                <section className="mt-8 rounded-2xl border bg-white/70 p-6 shadow-sm">
                    <h2 className="text-2xl font-bold">Главная идея</h2>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border bg-white p-4">
                            <div className="font-bold">Открытые аукционы</div>
                            <div className="mt-2 text-slate-700 leading-relaxed">
                                Участники видят ход торгов. В Хрюнляндии это английский и голландский
                                аукционы. Здесь важен не только размер оценки, но и момент выхода или входа
                                в торги.
                            </div>
                        </div>

                        <div className="rounded-xl border bg-white p-4">
                            <div className="font-bold">Закрытые аукционы</div>
                            <div className="mt-2 text-slate-700 leading-relaxed">
                                Участники подают ставки тайно. В Хрюнляндии это первая цена и Викри.
                                Здесь особенно важно заранее выбрать ставку, потому что чужих решений
                                во время хода торгов не видно.
                            </div>
                        </div>
                    </div>
                </section>

                {/* карточки 4 основных аукционов */}
                <section className="mt-8">
                    <h2 className="text-2xl font-bold">4 основных аукциона Хрюнляндии</h2>

                    <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* выводим каждую карточку из массива auctions */}
                        {auctions.map((a) => (
                            <article
                                key={a.title}
                                className={`rounded-2xl border p-6 shadow-sm ${a.color}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-3xl">{a.emoji}</div>
                                        <h3 className="mt-2 text-2xl font-extrabold">{a.title}</h3>
                                        <div className="mt-1 text-sm font-semibold text-slate-600">
                                            {a.tag}
                                        </div>
                                    </div>
                                </div>

                                {/* внутри карточки отдельно правила, история, стратегия и игра */}
                                <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
                                    <div>
                                        <div className="font-bold text-slate-900">Как работает</div>
                                        <p className="mt-1">{a.what}</p>
                                    </div>

                                    <div>
                                        <div className="font-bold text-slate-900">История и применение</div>
                                        <p className="mt-1">{a.history}</p>
                                    </div>

                                    <div>
                                        <div className="font-bold text-slate-900">Выигрышная стратегия</div>
                                        <p className="mt-1">{a.strategy}</p>
                                    </div>

                                    <div className="rounded-xl border bg-white/70 p-4">
                                        <div className="font-bold text-slate-900">Как это устроено в игре</div>
                                        <p className="mt-1">{a.inGame}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {/* блок про поведние свинок */}
                <section className="mt-8 rounded-2xl border bg-white/70 p-6 shadow-sm">
                    <h2 className="text-2xl font-bold">Как ведут себя свинки</h2>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* карточки свинок берем из pigBehaviors */}
                        {pigBehaviors.map((pig) => (
                            <div
                                key={pig.title}
                                className={`rounded-2xl border p-4 ${pig.color}`}
                            >
                                <div className="flex items-start gap-4">
                                    <img
                                        src={pig.img}
                                        alt={pig.title}
                                        className="h-20 w-20 shrink-0 rounded-full object-cover border bg-white/50"
                                    />

                                    <div>
                                        <div className="text-lg font-bold">
                                            {pig.title}
                                        </div>

                                        <p className="mt-2 text-slate-700 leading-relaxed">
                                            {pig.text}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* дополнительные виды аукционов, не из основной игры */}
                <section className="mt-8 rounded-2xl border bg-white/70 p-6 shadow-sm">
                    <h2 className="text-2xl font-bold">Коротко про другие виды аукционов</h2>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* просто перебираем список других аукционов */}
                        {otherAuctions.map((a) => (
                            <div key={a.title} className="rounded-xl border bg-white p-4">
                                <div className="font-bold">{a.title}</div>
                                <div className="mt-2 text-slate-700 leading-relaxed">
                                    {a.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* короткие выводы, чтобы игрок понял как действовать */}
                <section className="mt-8 rounded-2xl border bg-white/70 p-6 shadow-sm">
                    <h2 className="text-2xl font-bold">Главные выводы для игры</h2>

                    <div className="mt-5 space-y-3 text-slate-700 leading-relaxed">
                        <p>
                            <span className="font-semibold">В английском аукционе</span> не стоит
                            перебивать самого себя и уходить выше своей оценки. Здесь важно выдержать
                            конкуренцию, но не превратить победу в переплату.
                        </p>

                        <p>
                            <span className="font-semibold">В голландском аукционе</span> нужно заранее
                            выбрать порог: если ждать слишком долго, лот может забрать другая свинка.
                        </p>

                        <p>
                            <span className="font-semibold">В аукционе первой цены</span> победитель платит
                            свою ставку, поэтому ставка ровно по оценке часто опасна. Здесь обычно выгодно
                            шейдить.
                        </p>

                        <p>
                            <span className="font-semibold">В аукционе Викри</span> победитель платит вторую
                            ставку, поэтому в нашей модели свинки не шейдят и ставят по своей субъективной
                            оценке.
                        </p>
                    </div>
                </section>

                {/* список источников по теме */}
                <section className="mt-8 rounded-2xl border bg-white/70 p-6 shadow-sm">
                    <h2 className="text-2xl font-bold">Источники</h2>

                    <div className="mt-5 space-y-3">
                        {/* ссылки открываются в новой вкладке */}
                        {sources.map((s) => (
                            <a
                                key={s.title}
                                href={s.href}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-xl border bg-white p-4 transition hover:bg-slate-50"
                            >
                                <div className="font-bold text-slate-900">{s.title}</div>
                                <div className="mt-1 text-sm text-slate-600">{s.note}</div>
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}