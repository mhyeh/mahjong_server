export class Card {
    public static stringArrayToCardArray(cards: string[]): Card[] {
        const color: {[key: string]: number} = { c: 0, d: 1, b: 2 };
        const res = [];
        for (const card of cards) {
            const c = color[card.charAt(0)];
            const v = Number(card.charAt(1)) - 1;
            res.push(new Card(c, v));
        }
        return res;
    }

    public static stringToCard(card: string): Card {
        const color: {[key: string]: number} = { c: 0, d: 1, b: 2 };
        return new Card(color[card.charAt(0)], Number(card.charAt(1)) - 1);
    }

    public color: number;
    public value: number;

    constructor(c: number, v: number) {
        this.color = c;
        this.value = v;
    }

    public toString(): string {
        const color = ["c", "d", "b"];
        return color[this.color] + (this.value + 1);
    }
}

export class Color {
    public value: number;

    constructor(v: number = 0) {
        this.value = v;
    }

    public getIndex(idx: number): number {
        return (this.value >> (idx * 3)) & 7;
    }

    public add(idx: number): void {
        this.value += (1 << (idx * 3));
    }

    public sub(idx: number): void {
        this.value -= (1 << (idx * 3));
    }

    public have(idx: number): boolean {
        return ((this.value >> (idx * 3)) & 7) > 0;
    }

    public Count(): number {
        let result = 0;
        for (let i = 0; i < 9; i++) {
            result += ((this.value >> (i * 3)) & 7);
        }
        return result;
    }
}

export class Cards {
    public static CardArrayToCards(cards: Card[]): Cards {
        const res = new Cards();
        res.add(cards);
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

    public isEmpty(): boolean {
        return (this.values[0].value + this.values[1].value + this.values[2].value) === 0;
    }

    public containColor(c: number): boolean {
        return this.values[c].Count() > 0;
    }

    public have(card: Card): boolean {
        return this.values[card.color].getIndex(card.value) > 0;
    }

    public at(idx: number): Card {
        let count = 0;
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                count += this.values[c].getIndex(v);
                if (count > idx) {
                    return new Card(c, v);
                }
            }
        }
        return new Card(-1, -1);
    }

    public Count(): number {
        let result = 0;
        for (let i = 0; i < 3; i++) {
            result += this.values[i].Count();
        }
        return result;
    }

    public Draw(): Card {
        const len = this.Count();
        const result = this.at(~~(Math.random() * len));
        this.sub(result);
        return result;
    }

    public Translate(lack: number): number {
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

    public toStringArray(): string[] {
        const result = [];
        const color = ["c", "d", "b"];
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                for (let n = 0; n < this.values[c].getIndex(v); n++) {
                    result.push(color[c] + (v + 1));
                }
            }
        }
        return result;
    }

    public add(input: Card[] | Card): void {
        if (input instanceof Array) {
            for (const card of input) {
                if (this.values[card.color].getIndex(card.value) < 4) {
                    this.add(card);
                }
            }
        } else {
            if (this.values[input.color].getIndex(input.value) < 4) {
                this.values[input.color].add(input.value);
            }
        }
    }

    public sub(input: Card[] | Card): void {
        if (input instanceof Array) {
            for (const card of input) {
                if (this.values[card.color].getIndex(card.value) > 0) {
                    this.sub(card);
                }
            }
        } else {
            if (this.values[input.color].getIndex(input.value) > 0) {
                this.values[input.color].sub(input.value);
            }
        }
    }
}
