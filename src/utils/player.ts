import * as socketIO from "socket.io";
import { Card, Cards } from "./card";
import { CommandType, GameManager } from "./gameManager";
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

    private game: GameManager;
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

    constructor(game: GameManager, id: number, name: string, room: string) {
        this.game = game;
        this.id   = id;
        this.name = name;
        this.room = room;
    }

    public Init(): void {
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

    public checkGon(card: Card): boolean {
        if (card.color === this.lack || this.game.rooms.get(this.room).Deck.isEmpty()) {
            return false;
        }

        if (!this.isHu) {
            return true;
        }

        const handCount = this.Hand.values[card.color].getIndex(card.value);
        const oldTai = this.game.SSJ(this.Hand.Translate(this.lack), this.Door.Translate(this.lack));

        for (let i = 0; i < handCount; i++) {
            this.Hand.sub(card);
            this.Door.add(card);
        }
        let newTai = this.game.SSJ(this.Hand.Translate(this.lack), this.Door.Translate(this.lack));
        if (newTai > 0) {
            newTai -= 1;
        }
        for (let i = 0; i < handCount; i++) {
            this.Hand.add(card);
            this.Door.sub(card);
        }
        return (oldTai === newTai);
    }

    public checkPon(card: Card): boolean {
        if (card.color === this.lack || this.isHu) {
            return false;
        }
        const count = this.Hand.values[card.color].getIndex(card.value);
        return count >= 2;
    }

    public checkHu(card: Card = new Card(-1, -1)): number {
        let tai = 0;
        if ((this.Hand.values[this.lack].Count()) > 0) {
            return 0;
        }
        tai = this.game.SSJ(this.Hand.Translate(this.lack), this.Door.Translate(this.lack));
        return tai;
    }

    public checkTing(): number {
        let max = 0;
        const t_Hand = this.Hand.Translate(this.lack);
        const t_Door = this.Door.Translate(this.lack);
        const total = t_Hand + t_Door;
        for (let i = 0; i < 18; i++) {
            if (((total >> (i * 3)) & 7) < 4) {
                const newHand = t_Hand + (1 << (i * 3));
                const tai = this.game.SSJ(newHand, t_Door);
                if (tai > max) {
                    max = tai;
                }
            }
        }
        return max;
    }

    public Gon(card: Card, visible: boolean = true): void {
        this.justGon = true;
        this.Door.add(card);
        this.Door.add(card);
        this.Door.add(card);
        this.Door.add(card);

        if (visible) {
            this.VisiableDoor.add(card);
            this.VisiableDoor.add(card);
            this.VisiableDoor.add(card);
            this.VisiableDoor.add(card);
        }

        this.Hand.sub(card);
        this.Hand.sub(card);
        this.Hand.sub(card);
        this.Hand.sub(card);
    }

    public Pon(card: Card): void {
        this.Hand.sub(card);
        this.Hand.sub(card);

        this.VisiableDoor.add(card);
        this.VisiableDoor.add(card);
        this.VisiableDoor.add(card);

        this.Door.add(card);
        this.Door.add(card);
        this.Door.add(card);
    }

    public Tai(card: Card): number {
        this.Hand.add(card);
        const result = this.game.SSJ(this.Hand.Translate(this.lack), this.Door.Translate(this.lack));
        this.Hand.sub(card);
        return result;
    }

    public async ChangeCard(): Promise<Card[]> {
        const defaultChange = this.defaultChangeCard();
        const t = Cards.CardArrayToCards(defaultChange);
        const waitingTime = 30 * System.sec;
        this.socket.emit("change", t.toStringArray(), waitingTime);
        const changeByClient = this.waitForChangeCard();
        const delay = System.DelayValue(waitingTime, defaultChange);
        const changeCards = await Promise.race([delay, changeByClient]);
        this.Hand.sub(changeCards);
        this.game.rooms.get(this.room).broadcastChange(this.id);
        return changeCards;
    }

    public async ChooseLack(): Promise<number> {
        const defaultLack = 0;
        const waitingTime = 10 * System.sec;
        this.socket.emit("lack", defaultLack, waitingTime);
        const chooseByClient = this.waitForChooseLack();
        const delay = System.DelayValue(waitingTime, defaultLack);
        this.lack = await Promise.race([delay, chooseByClient]);
        return this.lack;
    }

    public async ThrowCard(): Promise<Card> {
        const defaultCard = this.Hand.at(0);
        const waitingTime = 10 * System.sec;
        this.socket.emit("throw", defaultCard.toString(), waitingTime);
        const throwByClient = this.waitForThrowCard();
        const delay = System.DelayValue(waitingTime, defaultCard);
        const card = await Promise.race([delay, throwByClient]);
        this.Hand.sub(card);
        this.game.rooms.get(this.room).broadcastThrow(this.id, card);
        return card;
    }

    public async Draw(drawCard: Card): Promise<IAction> {
        const actions = new Map<CommandType, Card[]>();
        actions.set(CommandType.COMMAND_ZIMO,   new Array<Card>());
        actions.set(CommandType.COMMAND_ONGON,  new Array<Card>());
        actions.set(CommandType.COMMAND_PONGON, new Array<Card>());
        let tai = 0;
        let command = 0;
        this.Hand.add(drawCard);

        this.socket.emit("draw", drawCard.toString());

        tai = this.checkHu();
        if (tai) {
            command |= CommandType.COMMAND_ZIMO;
            actions.get(CommandType.COMMAND_ZIMO).push(drawCard);
        }
        for (let c = 0; c < 3; c++) {
            for (let v = 0; v < 9; v++) {
                const tmpCard = new Card(c, v);
                if ((this.Hand.values[c].getIndex(v)) === 4) {
                    if (this.checkGon(tmpCard)) {
                        command |= CommandType.COMMAND_ONGON;
                        actions.get(CommandType.COMMAND_ONGON).push(new Card(c, v));
                    }
                } else if (this.Hand.values[c].getIndex(v) === 1 && this.Door.values[c].getIndex(v) === 3) {
                    if (this.checkGon(tmpCard)) {
                        command |= CommandType.COMMAND_PONGON;
                        actions.get(CommandType.COMMAND_PONGON).push(new Card(c, v));
                    }
                }
            }
        }

        let action: IAction = { command: CommandType.NONE, card: drawCard, score: 0 };
        if (command === CommandType.NONE) {
            action.command = CommandType.NONE;
            action.card = drawCard;
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
            this.HuCards.sub(action.card);
            this.game.rooms.get(this.room).huTiles.add(action.card);
            this.Hand.sub(action.card);
            action.card.color = -1;
            const score = Math.pow(2, tai + Number(this.justGon));
            for (let i = 0; i < 4; i++) {
                if (this.id !== i) {
                    this.credit += score;
                    action.score += score;
                    if (this.maxTai < tai) {
                        this.maxTai = tai;
                    }
                    this.game.rooms.get(this.room).players[i].credit -= score;
                }
            }
        } else if (action.command & CommandType.COMMAND_ONGON) {
            this.Gon(action.card, false);
            for (let i = 0; i < 4; i++) {
                if (i !== this.id) {
                    this.credit += 2;
                    action.score += 2;
                    this.gonRecord[i] += 2;
                }
            }
        } else if (action.command & CommandType.COMMAND_PONGON) {
            this.Gon(action.card);
            for (let i = 0; i < 4; i++) {
                if (i !== this.id) {
                    this.credit += 1;
                    action.score += 1;
                    this.gonRecord[i] += 1;
                }
            }
        } else {
            if (this.isHu) {
                action.card = drawCard;
            } else {
                action.card = await this.ThrowCard();
            }
            if (this.Hand.have(action.card)) {
                this.Hand.sub(action.card);
            }
        }
        return action;
    }

    public async OnCommand(cards: Map<CommandType, Card[]>, command: CommandType, from: number): Promise<IAction> {
        const map = new Map<CommandType, string[]>();
        for (const [key, value] of cards) {
            const t = Cards.CardArrayToCards(value);
            map.set(key, t.toStringArray());
        }

        const defaultCommand: IAction = { command: CommandType.NONE, card: new Card(-1, -1), score: 0 };
        const waitingTime = 10 * System.sec;
        this.socket.emit("command", JSON.stringify([...map]), command, waitingTime);
        const commandByClient = this.waitForCommand();
        const delay = System.DelayValue(waitingTime, defaultCommand);
        const action = await Promise.race([delay, commandByClient]);
        return action;
    }

    public OnFail(command: CommandType): void {
        this.socket.emit("fail", command);
    }

    public OnSuccess(from: number, command: CommandType, card: Card, score: number): void {
        this.socket.emit("success", from, command, card.toString(), score);
        this.game.rooms.get(this.room).broadcastCommand(from, this.id, command, card, score);
    }

    private defaultChangeCard(): Card[] {
        const result = [];
        let count = 0;
        for (let c = 0; c < 3 && count < 3; c++) {
            if ((this.Hand.values[c].Count()) >= 3) {
                for (let v = 0; count < 3 && v < 9; v++) {
                    for (let n = 0; count < 3 && (n < this.Hand.values[c].getIndex(v)); n++) {
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
            this.socket.on("changeCard", (cards: string[]) => {
                const res = Card.stringArrayToCardArray(cards);
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
            this.socket.on("throwCard", (card: string) => {
                resolve(Card.stringToCard(card));
            });
        });
    }

    private waitForCommand(): Promise<IAction> {
        return new Promise<IAction>((resolve, reject) => {
            this.socket.on("sendCommand", (action: CommandType, card: string) => {
                const res: IAction = { command: action, card: Card.stringToCard(card), score: 0 };
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
