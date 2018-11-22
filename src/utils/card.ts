export class Card {
    public static async stringArrayToCardArray(cards: string[]): Promise<Card[]> {
        const color: {[key: string]: number} = {
            b: 0,
            c: 1,
            d: 2,
        };
        const res = [];
        for (const card of cards) {
            const c = color[card.charAt(0)];
            const v = Number(card.charAt(1));
            res.push(new Card(c, v));
        }
        return res;
    }

    public static async stringToCard(card: string): Promise<Card> {
        const color: {[key: string]: number} = {
            b: 0,
            c: 1,
            d: 2,
        };
        return new Card(color[card.charAt(0)], Number(card.charAt(1)));
    }

    public color: number;
    public value: number;

    constructor(c: number, v: number) {
        this.color = c;
        this.value = v;
    }

    public async toString(): Promise<string> {
        const color = ["b", "c", "d"];
        return color[this.color] + (this.value + 1);
    }
}

export class Color {
    public value: number;

    constructor(v: number = 0) {
        this.value = v;
    }

    public async getIndex(idx: number): Promise<number> {
        return (this.value >> (idx * 3)) & 7;
    }

    public async add(idx: number): Promise<void> {
        this.value += (1 << (idx * 3));
    }

    public async sub(idx: number): Promise<void> {
        this.value -= (1 << (idx * 3));
    }

    public async have(idx: number): Promise<boolean> {
        return ((this.value >> (idx * 3)) & 7) > 0;
    }

    public async Count(): Promise<number> {
        let result = 0;
        for (let i = 0; i < 9; i++) {
            result += ((this.value >> (i * 3)) & 7);
        }
        return result;
    }
}

export class Cards {
    public static async CardArrayToCards(cards: Card[]): Promise<Cards> {
        const res = new Cards();
        await res.add(cards);
        return res;
    }

    public values = new Array<Color>(3);

    constructor(full: boolean = false) {
        for (let i = 0; i < 3; i++) {
            if (full) {
                this.values[i] = new Color(0b100100100100100100100100100);
            }
            else {
                this.values[i] = new Color();
            }
        }
    }

    public async isEmpty(): Promise<boolean> {
        return (this.values[0].value + this.values[1].value + this.values[2].value) === 0;
    }

    public async containColor(c: number): Promise<boolean> {
        return (await this.values[c].Count()) > 0;
    }

    public async have(card: Card): Promise<boolean> {
        return (await this.values[card.color].getIndex(card.value)) > 0;
    }

    public async at(idx: number): Promise<Card> {
        let count = 0;
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                count += await this.values[c].getIndex(v);
                if (count > idx) {
                    return new Card(c, v);
                }
            }
        }
        return new Card(-1, -1);
    }

    public async Count(): Promise<number> {
        let result = 0;
        for (let i = 0; i < 3; i++) {
            result += await this.values[i].Count();
        }
        return result;
    }

    public async Draw(): Promise<Card> {
        const len = await this.Count();
        const result = await this.at(~~(Math.random() * len));
        this.sub(result);
        return result;
    }

    public async Translate(lack: number): Promise<number> {
        let first = true;
        let result = 0;
        for (let i = 0; i < 3; i++) {
            if (i !== lack) {
                result |= this.values[i].value;
                if (first) {
                    result <<= 27;
                    first = false;
                }
            }
        }
        return result;
    }

    public async toStringArray(): Promise<string[]> {
        const result = [];
        const color = ["b", "c", "d"];
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                for (let n = 0; n < await this.values[c].getIndex(v); n++) {
                    result.push(color[c] + (v + 1));
                }
            }
        }
        return result;
    }

    public async add(input: Card[] | Card): Promise<void> {
        if (input instanceof Array) {
            for (const card of input) {
                if ((await this.values[card.color].getIndex(card.value)) < 4) {
                    this.add(card);
                }
            }
        } else {
            if ((await this.values[input.color].getIndex(input.value)) < 4) {
                this.values[input.color].add(input.value);
            }
        }
    }

    public async sub(input: Card[] | Card): Promise<void> {
        if (input instanceof Array) {
            for (const card of input) {
                if ((await this.values[card.color].getIndex(card.value)) > 0) {
                    this.sub(card);
                }
            }
        } else {
            if ((await this.values[input.color].getIndex(input.value)) > 0) {
                this.values[input.color].sub(input.value);
            }
        }
    }
}
