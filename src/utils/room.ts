import * as SocketIO from "socket.io";
import { Card, Cards } from "./card";
import { CommandType, GameManager } from "./gameManager";
import Player, { IAction } from "./player";
import * as System from "./System";

export default class Room {
    public players      = new Array<Player>(4);
    public changedTiles = new Array<Card[]>(4);
    public choosedLack  = new Array<number>(4);
    public Deck:         Cards;
    public discardTiles: Cards;
    public huTiles:      Cards;

    public io: SocketIO.Server;

    private game:   GameManager;

    private name:   string;
    private amount: number;

    private seat = new Array<boolean>(false, false, false, false);

    public get Name(): string {
        return this.name;
    }

    public get numPlayer(): number {
        return this.amount;
    }

    private get nextSeat(): number {
        for (let i = 0; i < this.seat.length; i++) {
            if (!this.seat[i]) {
                return i;
            }
        }
        return -1;
    }

    constructor(game: GameManager, name: string) {
        this.game = game;
        this.name = name;
        this.amount = 0;
    }

    public addPlayer(name: string, room: string): number {
        const id = this.nextSeat;
        this.players[id] = new Player(this.game, id, name, room);
        this.seat[id] = true;
        this.amount++;
        const playerList = this.getPlayerList();
        this.io.to(this.name).emit("updatePlayerList", playerList);

        if (this.amount === 4) {
            this.io.to(this.name).emit("storePlayerList", playerList);
        }
        return id;
    }

    public removePlayer(id: number): void {
        this.players.splice(id, 1);
        this.seat[id] = false;
        this.amount--;
    }

    public findUser(name: string): boolean {
        for (let i = 0; i < 4; i++) {
            if (this.seat[i]) {
                if (this.players[i].Name === name) {
                    return true;
                }
            }
        }
        return false;
    }

    public getPlayerList(): string[] {
        const nameList: string[] = [];
        this.players.forEach((player) => nameList.push(player.Name));

        return nameList;
    }

    public broadcastChange(id: number): void {
        this.io.to(this.name).emit("broadcastChange", id);
    }

    public broadcastDraw(id: number): void {
        this.io.to(this.name).emit("broadcastDraw", id);
    }

    public broadcastThrow(id: number, card: Card): void {
        this.io.to(this.name).emit("broadcastThrow", id, card.toString());
    }

    public broadcastCommand(from: number, to: number, command: CommandType, card: Card, score: number): void {
        if (command === CommandType.COMMAND_ONGON) {
            this.io.to(this.name).emit("broadcastCommand", from, to, command, "", score);
        } else {
            this.io.to(this.name).emit("broadcastCommand", from, to, command, card.toString(), score);
        }
    }

    public async Run(): Promise<void> {
        this.Init();
        await System.Delay(3 * System.sec);
        await this.ChangeCard();
        await System.Delay(5 * System.sec);
        await this.ChooseLack();

        let currentIdx = 0;
        let onlyThrow  = false;
        let gameover   = false;
        while (!gameover) {
            let throwCard = new Card(-1, -1);
            let action: IAction = { command: CommandType.NONE, card: new Card(-1, -1), score: 0 };

            if (onlyThrow) {
                throwCard = await this.players[currentIdx].ThrowCard();
                this.players[currentIdx].Hand.sub(throwCard);
                onlyThrow = false;
            } else {
                const drawCard = this.Deck.Draw();
                this.broadcastDraw(currentIdx);
                action = await this.players[currentIdx].Draw(drawCard);
                throwCard = action.card;
            }

            let commandIdx: ICommandIdx = { gonIdx: -1, huIdx:  -1, ponIdx: -1 };
            let fail = false;
            if ((action.command & CommandType.COMMAND_PONGON)) {
                const PromiseArray = new Array<any>(4);
                const act: IAction = { command: CommandType.NONE, card: new Card(-1, -1), score: 0 };
                PromiseArray[0] = System.DelayValue(0, act);

                for (let i = 1; i < 4; i++) {
                    const id = (i + currentIdx) % 4;
                    const tai = this.players[id].checkHu(action.card);
                    if (tai) {
                        const cards = new Map<CommandType, Card[]>();
                        cards.set(CommandType.COMMAND_HU, new Array<Card>());
                        cards.get(CommandType.COMMAND_HU).push(action.card);
                        PromiseArray[i] = this.players[id].OnCommand(cards, CommandType.COMMAND_HU, (4 + currentIdx - id) % 4);
                    }
                }

                const actionSet = await Promise.all(PromiseArray);
                for (let i = 1; i < 4; i++) {
                    const id = (i + currentIdx) % 4;
                    const action = actionSet[i];
                    if (act.command & CommandType.COMMAND_HU) {
                        const tai = this.players[id].checkHu(action.card);
                        this.players[currentIdx].Door.sub(action.card);
                        this.players[currentIdx].VisiableDoor.sub(action.card);
                        this.players[currentIdx].credit -= Math.pow(2, tai);
                        this.players[id].HuCards.add(action.card);
                        this.huTiles.add(action.card);
                        this.players[id].credit += Math.pow(2, tai);
                        commandIdx.huIdx = id;
                        fail = true;
                    }
                }
            } else if (!(action.command & CommandType.COMMAND_ZIMO) && !(action.command & CommandType.COMMAND_ONGON)) {
                commandIdx = await this.CheckOthers(currentIdx, throwCard, commandIdx);
            }

            if (!fail) {
                this.players[currentIdx].OnFail(action.command);
            } else {
                this.players[currentIdx].OnSuccess(currentIdx, action.command, action.card, action.score);
            }

            this.players[currentIdx].justGon = false;

            if (commandIdx.huIdx !== -1) {
                currentIdx = (commandIdx.huIdx + 1) % 4;
                if (commandIdx.gonIdx !== -1) {
                    this.players[commandIdx.gonIdx].OnFail(action.command);
                }
                if (commandIdx.ponIdx !== -1) {
                    this.players[commandIdx.ponIdx].OnFail(action.command);
                }
            } else if (commandIdx.gonIdx !== -1) {
                this.players[commandIdx.gonIdx].Gon(throwCard);
                this.players[currentIdx].credit -= 2;
                this.players[commandIdx.gonIdx].credit += 2;
                this.players[commandIdx.gonIdx].gonRecord[currentIdx] += 2;
                currentIdx = commandIdx.gonIdx;
                this.players[commandIdx.gonIdx].OnSuccess(currentIdx, CommandType.COMMAND_GON, throwCard, 2);
                if (commandIdx.ponIdx !== -1) {
                    this.players[commandIdx.ponIdx].OnFail(action.command);
                }
            } else if (commandIdx.ponIdx !== -1) {
                this.players[commandIdx.ponIdx].Pon(throwCard);
                currentIdx = commandIdx.ponIdx;
                onlyThrow = true;
                this.players[commandIdx.ponIdx].OnSuccess(currentIdx, CommandType.COMMAND_PON, throwCard, 0);
            } else if (!fail && (action.command & CommandType.COMMAND_ONGON) || (action.command & CommandType.COMMAND_PONGON)) {
                currentIdx = currentIdx;
            } else {
                if (throwCard.color > 0) {
                    this.discardTiles.add(throwCard);
                }
                currentIdx = (currentIdx + 1) % 4;
            }
            if (this.Deck.isEmpty()) {
                gameover = true;
            }
        }
        if (this.HuUnder2()) {
            this.LackPenalty();
            this.NoTingPenalty();
            this.ReturnMoney();
        }
        this.End();
    }

    private Init(): void {
        this.Deck         = new Cards(true);
        this.discardTiles = new Cards();
        this.huTiles      = new Cards();

        let len = this.Deck.Count();
        for (const player of this.players) {
            player.Init();
            for (let j = 0; j < 13; j++) {
                const idx = ~~(Math.random() * len);
                const result = this.Deck.at(idx);
                this.Deck.sub(result);
                player.Hand.add(result);
                len -= 1;
            }
            player.socket.emit("dealCard", player.Hand.toStringArray());
        }
    }

    private async ChangeCard(): Promise<void> {
        const promiseArray = new Array<any>(4);
        for (const idx in this.players) {
            promiseArray[idx] = this.players[idx].ChangeCard();
        }
        this.changedTiles = await Promise.all(promiseArray);

        const rand = ~~(Math.random() * 3);
        let tmp: Card[];
        if (rand === 0) {
            tmp = this.changedTiles[0];
            for (let i = 0; i < 3; i++) {
                this.changedTiles[i] = this.changedTiles[i + 1];
            }
            this.changedTiles[3] = tmp;
        } else if (rand === 1) {
            tmp = this.changedTiles[3];
            for (let i = 3; i > 0; i--) {
                this.changedTiles[i] = this.changedTiles[i - 1];
            }
            this.changedTiles[0] = tmp;
        } else {
            for (let i = 0; i < 2; i++) {
                tmp = this.changedTiles[i];
                this.changedTiles[i] = this.changedTiles[i + 2];
                this.changedTiles[i + 2] = tmp;
            }
        }

        for (const idx in this.players) {
            this.players[idx].Hand.add(this.changedTiles[idx]);
            const t = Cards.CardArrayToCards(this.changedTiles[idx]);
            this.players[idx].socket.emit("afterChange", t.toStringArray(), rand);
        }
    }

    private async ChooseLack(): Promise<void> {
        const promiseArray = new Array<any>(4);
        for (const idx in this.players) {
            promiseArray[idx] = this.players[idx].ChooseLack();
        }
        this.choosedLack = await Promise.all(promiseArray);
        this.io.to(this.name).emit("afterLack", this.choosedLack);
    }

    private async CheckOthers(currentIdx: number, throwCard: Card, commandIdx: ICommandIdx): Promise<ICommandIdx> {
        let action: IAction = { command: CommandType.NONE, card: throwCard, score: 0 };
        const PromiseArray = new Array<any>(4);
        PromiseArray[0] = System.DelayValue(0, action);

        for (let i = 1; i < 4; i++) {
            const playerIdx = (i + currentIdx) % 4;
            const actions = new Map<CommandType, Card[]>();
            actions.set(CommandType.COMMAND_HU,  new Array<Card>());
            actions.set(CommandType.COMMAND_GON, new Array<Card>());
            actions.set(CommandType.COMMAND_PON, new Array<Card>());
            const other_player = this.players[playerIdx];

            let command = 0;
            action = { command: CommandType.NONE, card: throwCard, score: 0 };

            const tai = other_player.checkHu(throwCard);
            if (tai) {
                if (!other_player.isHu) {
                    command |= CommandType.COMMAND_HU;
                    actions.get(CommandType.COMMAND_HU).push(throwCard);
                }
            }

            if (other_player.Hand.values[throwCard.color].getIndex(throwCard.value) === 3) {
                if (other_player.checkGon(throwCard)) {
                    command |= CommandType.COMMAND_GON;
                    actions.get(CommandType.COMMAND_GON).push(throwCard);
                }
            }

            if (other_player.checkPon(throwCard)) {
                command |= CommandType.COMMAND_PON;
                actions.get(CommandType.COMMAND_PON).push(throwCard);
            }

            if (command === CommandType.NONE) {
                action.command = CommandType.NONE;
                PromiseArray[i] = System.DelayValue(0, action);
            } else if (other_player.isHu) {
                if (command & CommandType.COMMAND_HU) {
                    action.command  = CommandType.COMMAND_HU;
                    action.card = throwCard;
                } else if (command & CommandType.COMMAND_GON) {
                    action.command  = CommandType.COMMAND_GON;
                    action.card = throwCard;
                }
                PromiseArray[i] = System.DelayValue(0, action);
            } else {
                PromiseArray[i] = other_player.OnCommand(actions, command, ((4 + currentIdx - other_player.ID) % 4));
            }
        }
        const actionSet = await Promise.all(PromiseArray);

        for (let i = 1; i < 4; i++) {
            const playerIdx = (i + currentIdx) % 4;
            const other_player = this.players[playerIdx];
            action = actionSet[i];
            const tai = other_player.checkHu(throwCard);

            if (action.command & CommandType.COMMAND_HU) {
                other_player.isHu = true;
                other_player.HuCards.add(action.card);
                if (commandIdx.huIdx === -1) {
                    this.huTiles.add(action.card);
                }
                commandIdx.huIdx = playerIdx;
                const score = Math.pow(2, (tai + Number(this.players[currentIdx].justGon)) - 1);
                other_player.credit += score;
                if (other_player.maxTai < tai) {
                    other_player.maxTai = tai;
                }
                this.players[currentIdx].credit -= score;
                other_player.OnSuccess(currentIdx, CommandType.COMMAND_HU, action.card, score);
            } else if (action.command & CommandType.COMMAND_GON) {
                if (commandIdx.huIdx === -1 && commandIdx.gonIdx === -1) {
                    commandIdx.gonIdx = playerIdx;
                } else {
                    other_player.OnFail(action.command);
                }
            } else if (action.command & CommandType.COMMAND_PON) {
                if (commandIdx.huIdx === -1 && commandIdx.gonIdx === -1 && commandIdx.ponIdx === -1) {
                    commandIdx.ponIdx = playerIdx;
                } else {
                    other_player.OnFail(action.command);
                }
            }
        }
        return commandIdx;
    }

    private HuUnder2(): boolean {
        for (let i = 0; i < 4; i++) {
            if (!this.players[i].isHu) {
                this.players[i].maxTai = this.players[i].checkTing();
                this.players[i].isTing = this.players[i].maxTai > 0;
            }
        }
        return true;
    }

    private LackPenalty(): void {
        for (let i = 0; i < 4; i++) {
            if (this.players[i].Hand.containColor(this.players[i].lack)) {
                for (let j = 0; j < 4; j++) {
                    if ((this.players[j].Hand.values[this.players[j].lack].Count() === 0) && i !== j) {
                        this.players[j].credit += 16;
                        this.players[i].credit -= 16;
                    }
                }
            }
        }
    }

    private NoTingPenalty(): void {
        for (let i = 0; i < 4; i++) {
            if (!this.players[i].isTing && !this.players[i].isHu) {
                for (let j = 0; j < 4; j++) {
                    if ((this.players[j].isTing) && i !== j) {
                        this.players[j].credit += Math.pow(2, this.players[j].maxTai - 1);
                        this.players[i].credit -= Math.pow(2, this.players[j].maxTai - 1);
                    }
                }
            }
        }
    }

    private ReturnMoney(): void {
        for (let i = 0; i < 4; i++) {
            if (!this.players[i].isTing && !this.players[i].isHu) {
                for (let j = 0; j < 4; j++) {
                    if (i !== j) {
                        this.players[i].credit -= this.players[i].gonRecord[j];
                        this.players[j].credit += this.players[i].gonRecord[j];
                    }
                }
            }
        }
    }

    private End(): void {
        const data = [];
        for (const player of this.players) {
            data.push({ hand: player.Hand.toStringArray(), score: player.credit });
        }
        this.io.to(this.name).emit("end", data);
    }
}

interface ICommandIdx {
    gonIdx: number;
    huIdx:  number;
    ponIdx: number;
}
