import * as socketIO from "socket.io";
import {Card, Cards} from "./card";
import {CommandType, SSJ} from "./logic";
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

    public async ThrowCard(): Promise<Card> {
        const defaultCard = await this.Hand.at(0);
        const waitingTime = 10000;
        this.socket.emit("throw", await defaultCard.toString(), waitingTime);
        const throwByClient = this.waitForThrowCard();
        const delay = System.DelayValue(waitingTime, defaultCard);
        const card = await Promise.race([delay, throwByClient]);
        await this.Hand.sub(card);
        RoomManager.get(this.room).broadcastThrow(this.id, card);
        return card;
    }

    public async Draw(throwCard: Card): Promise<IAction> {
        const actions = new Map<CommandType, Card[]>();
        actions.set(CommandType.COMMAND_ZIMO,   new Array<Card>());
        actions.set(CommandType.COMMAND_ONGON,  new Array<Card>());
        actions.set(CommandType.COMMAND_PONGON, new Array<Card>());
        let tai = 0;
        let command = 0;
        await this.Hand.add(throwCard);

        tai = await this.checkHu();
        if (tai) {
            command |= CommandType.COMMAND_ZIMO;
            actions.get(CommandType.COMMAND_ZIMO).push(throwCard);
        }
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                const tmpCard = new Card(c, v);
                if ((await this.Hand.values[c].getIndex(v)) === 4) {
                    if (await this.checkGon(tmpCard)) {
                        command |= CommandType.COMMAND_ONGON;
                        actions.get(CommandType.COMMAND_ONGON).push(new Card(c, v));
                    }
                } else if ((await this.Hand.values[c].getIndex(v)) === 1 && (await this.Door.values[c].getIndex(v)) === 3) {
                    if (this.checkGon(tmpCard)) {
                        command |= CommandType.COMMAND_PONGON;
                        actions.get(CommandType.COMMAND_PONGON).push(new Card(c, v));
                    }
                }
            }
        }

        let action: IAction = { command: CommandType.NONE, card: throwCard, score: 0 };
        if (command === CommandType.NONE) {
            action.command = CommandType.NONE;
            action.card = throwCard;
        } else if (this.isHu) {
            if (command & CommandType.COMMAND_ZIMO) {
                action.command = CommandType.COMMAND_ZIMO;
                action.card = actions.get(action.command)[0];
            } else if (command & CommandType.COMMAND_ONGON) {
                action.command = CommandType.COMMAND_ONGON;
                action.card = actions.get(action.command)[0];
            } else if (command & CommandType.COMMAND_PONGON) {
                action.command = CommandType.COMMAND_PONGON;
                action.card = actions.get(action.command)[0];
            }
        } else {
            action = await this.OnCommand(actions, command, 0);
        }

        if (action.command & CommandType.COMMAND_ZIMO) {
            this.isHu = true;
            await this.HuCards.sub(action.card);
            await RoomManager.get(this.room).huTiles.add(action.card);
            await this.Hand.sub(action.card);
            action.card.color = -1;
            const score = Math.pow(2, tai + Number(this.justGon));
            for (let i = 0; i < 4; i++) {
                if (this.id !== i) {
                    this.credit += score;
                    action.score += score;
                    if (this.maxTai < tai) {
                        this.maxTai = tai;
                    }
                    RoomManager.get(this.room).players[i].credit -= score;
                }
            }
        } else if (action.command & CommandType.COMMAND_ONGON) {
            await this.Gon(action.card, false);
            for (let i = 0; i < 4; i++) {
                if (i !== this.id) {
                    this.credit += 2;
                    action.score += 2;
                    this.gonRecord[i] += 2;
                }
            }
        } else if (action.command & CommandType.COMMAND_PONGON) {
            await this.Gon(action.card);
            for (let i = 0; i < 4; i++) {
                if (i !== this.id) {
                    this.credit += 1;
                    action.score += 1;
                    this.gonRecord[i] += 1;
                }
            }
        } else {
            if (this.isHu) {
                action.card = throwCard;
            } else {
                action.card = await this.ThrowCard();
            }
            if (await this.Hand.have(action.card)) {
                await this.Hand.sub(action.card);
            }
        }
        return action;
    }

    public async OnCommand(cards: Map<CommandType, Card[]>, command: CommandType, from: number): Promise<IAction> {
        const defaultCommand: IAction = { command: CommandType.NONE, card: new Card(-1, -1), score: 0 };
        const waitingTime = 10000;
        this.socket.emit("command", cards, command, waitingTime);
        const commandByClient = this.waitForCommand();
        const delay = System.DelayValue(waitingTime, defaultCommand);
        const action = await Promise.race([delay, commandByClient]);
        return action;
    }

    public async OnFail(command: CommandType): Promise<void> {
        this.socket.emit("fail", command);
    }

    public async OnSuccess(from: number, command: CommandType, card: Card, score: number): Promise<void> {
        this.socket.emit("success", from, command, await card.toString(), score);
        RoomManager.get(this.room).broadcastCommand(from, this.id, command, card, score);
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

    private waitForThrowCard(): Promise<Card> {
        return new Promise<Card>((resolve, reject) => {
            this.socket.on("throwCard", async (card: string) => {
                resolve(await Card.stringToCard(card));
            });
        });
    }

    private waitForCommand(): Promise<IAction> {
        return new Promise<IAction>((resolve, reject) => {
            this.socket.on("sendCommand", async (action: CommandType, card: string) => {
                const res: IAction = { command: action, card: await Card.stringToCard(card), score: 0 };
                resolve(res);
            });
        });
    }
}

export interface IAction {
    command: CommandType;
    card: Card;
    score: number;
}
