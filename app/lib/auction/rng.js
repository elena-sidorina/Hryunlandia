// это детерминированный генератор случайных чисел, нужен чтобы при одном seed результаты повторялись

export class Rng {

    // seed-число, которое фиксирует случайность
    // если одинаковый seed, то и одинаковые результаты
    constructor(seed) {
        this.seed = (seed ?? Date.now()) >>> 0; // если seed не дали, берём текущее время
        this.state = this.seed || 123456789; // внутреннее состояние генератора
    }

    // nextU32 генерирует следующее псевдослучайное число
    nextU32() {
        // используем простой алгоритм xorshift32
        let x = this.state >>> 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return this.state;
    }

    // int(min, max) возвращает целое число из диапазона [min; max]
    int(min, max) {
        const a = Math.min(min, max);
        const b = Math.max(min, max);
        const span = b - a + 1;
        return a + (this.nextU32() % span);
    }
}