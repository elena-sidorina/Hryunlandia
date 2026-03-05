export default function IntroPage() {
  return (
    <main className="min-h-screen bg-[url('/castle-bg.jpg')] bg-cover bg-center flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white/50 backdrop-blur-md rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-center">🏰 Хрюнляндия</h1>

        <p className="mt-6 text-slate-800 leading-relaxed">
          Королевство Хрюнляндия славится аукционами. Здесь проводят открытые торги — английский (цена растёт) и
          голландский (цена падает), — и закрытые — первой цены и Викри (вторая цена).
        </p>

        <p className="mt-6 font-semibold text-slate-900">
          Свин-аукционер шепнул секрет: все участники делятся на 4 архетипа:
        </p>

        <ul className="mt-3 space-y-2 text-slate-900">
          <li>• Честный свин ставит по своей оценке.</li>
          <li>• Агрессивный свин ставит близко к своей оценке.</li>
          <li>• Рациональный свин аккуратно снижает ставку по формуле.</li>
          <li>• Осторожный свин не любит рисковать, а потому занижает и уходит раньше.</li>
        </ul>

        <p className="mt-6 text-slate-800 leading-relaxed">
          В этом приложении вы можете посмотреть, как свинки торгуются, поиграть сами, и сравнить результаты разных
          форматов.
        </p>

        <p className="mt-4 text-slate-700 font-medium">
          Перед тем, как вы приступите к участию в аукционах во вкладке «Игра», настоятельно рекомендуем вам зайти в
          «Обучение» — там вы поймёте, как устроены 4 аукциона, как действуют свинки на практике и какая тактика когда
          работает.
        </p>

        <div className="mt-8 flex justify-center">
          <a
            href="/home"
            className="px-8 py-4 rounded-2xl bg-rose-400 text-white text-lg font-semibold shadow-md hover:bg-rose-500 transition-all duration-300"
          >
            Попасть в Хрюнляндию 🗝️
          </a>
        </div>
      </div>
    </main>
  );
}