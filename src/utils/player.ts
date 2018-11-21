import * as socketIO from "socket.io";
import {Card, Cards, Color} from "./card";
import {SSJ} from "./logic";
import {roomManager as RoomManager} from "./RoomManager";
import * as System from "./System";

export default class Player {
    public lack:   number;
    public credit: number;

    public Hand         = new Cards();
    public Door         = new Cards();
    public VisiableDoor = new Cards();
    public HuCards      = new Cards();

    public gonRecord = new Array<number>(4);
    public maxTai: number;

    public isHu:    boolean;
    public isTing:  boolean;
    public justGon: boolean;

    public socket: socketIO.Socket;

    private id:   number;
    private name: string;
    private room: string;

    public get ID(): number {
        return this.id;
    }

    public get Name(): string {
        return this.name;
    }

    public get Room(): string {
        return this.room;
    }

    constructor(id: number, name: string, room: string) {
        this.id = id;
        this.name = name;
        this.room = room;
    }

    public async Init(): Promise<void> {
        for (let i = 0; i < 3; i++) {
            this.Door.values[i].value = 0;
            this.VisiableDoor.values[i].value = 0;
            this.Hand.values[i].value = 0;
            this.HuCards.values[i].value = 0;
        }

        this.gonRecord[0] = 0;
        this.gonRecord[1] = 0;
        this.gonRecord[2] = 0;
        this.gonRecord[3] = 0;

        this.credit  = 0;
        this.maxTai  = 0;
        this.isHu    = false;
        this.isTing  = false;
        this.justGon = false;
        this.lack    = -1;
    }

    public async checkGon(card: Card): Promise<boolean> {
        if (card.color === this.lack || (await RoomManager.get(this.room).Deck.isEmpty())) {
            return false;
        }

        if (!this.isHu) {
            return true;
        }

        const handCount = await this.Hand.values[card.color].getIndex(card.value);
        const oldTai = await SSJ(await this.Hand.Translate(this.lack), await this.Door.Translate(this.lack));

        for (let i = 0; i < handCount; i++) {
            this.Hand.sub(card);
            this.Door.add(card);
        }
        let newTai = await SSJ(await this.Hand.Translate(this.lack), await this.Door.Translate(this.lack));
        if (newTai > 0) {
            newTai -= 1;
        }
        for (let i = 0; i < handCount; i++) {
            await this.Hand.add(card);
            await this.Door.sub(card);
        }
        return (oldTai === newTai);
    }

    public async checkPon(card: Card): Promise<boolean> {
        if (card.color === this.lack || this.isHu) {
            return false;
        }
        const count = await this.Hand.values[card.color].getIndex(card.value);
        return count >= 2;
    }

    public async checkHu(card: Card = new Card(-1, -1)): Promise<number> {
        let tai = 0;
        if ((await this.Hand.values[this.lack].Count()) > 0) {
            return 0;
        }
        tai = await SSJ(await this.Hand.Translate(this.lack), await this.Door.Translate(this.lack));
        return tai;
    }

    public async checkTing(): Promise<number> {
        let max = 0;
        const t_Hand = await this.Hand.Translate(this.lack);
        const t_Door = await this.Door.Translate(this.lack);
        const total = t_Hand + t_Door;
        for (let i = 0; i < 18; i++) {
            if (((total >> (i * 3)) & 7) < 4) {
                const newHand = t_Hand + (1 << (i * 3));
                const tai = await SSJ(newHand, t_Door);
                if (tai > max) {
                    max = tai;
                }
            }
        }
        return max;
    }

    public async Gon(card: Card, visible: boolean = true): Promise<void> {
        this.justGon = true;
        await this.Door.add(card);
        await this.Door.add(card);
        await this.Door.add(card);
        await this.Door.add(card);

        if (visible) {
            await this.VisiableDoor.add(card);
            await this.VisiableDoor.add(card);
            await this.VisiableDoor.add(card);
            await this.VisiableDoor.add(card);
        }

        await this.Hand.sub(card);
        await this.Hand.sub(card);
        await this.Hand.sub(card);
        await this.Hand.sub(card);
    }

    public async Pon(card: Card): Promise<void> {
        await this.Hand.sub(card);
        await this.Hand.sub(card);

        await this.VisiableDoor.add(card);
        await this.VisiableDoor.add(card);
        await this.VisiableDoor.add(card);

        await this.Door.add(card);
        await this.Door.add(card);
        await this.Door.add(card);
    }

    public async Tai(card: Card): Promise<number> {
        await this.Hand.add(card);
        const result = await SSJ(await this.Hand.Translate(this.lack), await this.Door.Translate(this.lack));
        await this.Hand.sub(card);
        return result;
    }

    public async ChangeCard(): Promise<Card[]> {
        const defaultChange = await this.defaultChangeCard();
        const t = await Cards.CardArrayToCards(defaultChange);
        const waitingTime = 30000;
        this.socket.emit("change", await t.toStringArray(), waitingTime);
        const changeByClient = this.waitForChangeCard();
        const delay = System.DelayValue(waitingTime, defaultChange);
        const changeCards = await Promise.race([delay, changeByClient]);
        await this.Hand.sub(changeCards);
        return changeCards;
    }

    public async ChooseLack(): Promise<number> {
        const defaultLack = 0;
        const waitingTime = 10000;
        this.socket.emit("lack", defaultLack, waitingTime);
        const chooseByClient = this.waitForChooseLack();
        const delay = System.DelayValue(waitingTime, defaultLack);
        this.lack = await Promise.race([delay, chooseByClient]);
        return this.lack;
    }

    private async defaultChangeCard(): Promise<Card[]> {
        const result = [];
        let count = 0;
        for (let c = 0; c < 3 && count < 3; c++) {
            if ((await this.Hand.values[c].Count()) >= 3) {
                for (let v = 0; count < 3 && v < 9; v++) {
                    for (let n = 0; count < 3 && (n < await this.Hand.values[c].getIndex(v)); n++) {
                        result.push(new Card(c, v));
                        count++;
                    }
                }
            }
        }
        return result;
    }

    private waitForChangeCard(): Promise<Card[]> {
        return new Promise<Card[]>((resolve, reject) => {
            this.socket.on("changeCard", async (cards: string[]) => {
                const res = await Card.stringArrayToCardArray(cards);
                resolve(res);
            });
        });
    }

    private waitForChooseLack(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.socket.on("chooseLack", (lack: number) => {
                resolve(lack);
            });
        });
    }
}
