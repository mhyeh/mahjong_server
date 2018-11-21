import * as SocketIO from "socket.io";
import {Card, Cards} from "./card";
import {CommandType, SSJ} from "./logic";
import Player from "./player";
import { Delay } from "./System";

export default class Room {
    public players      = new Array<Player>(4);
    public changedTiles = new Array<Card[]>(4);
    public choosedLack  = new Array<number>(4);
    public Deck:         Cards;
    public discardTiles: Cards;
    public huTiles:      Cards;

    public io: SocketIO.Server;

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

    constructor(name: string) {
        this.name = name;
        this.amount = 0;
    }

    public async addPlayer(name: string, room: string): Promise<number> {
        const id = this.nextSeat;
        this.players[id] = new Player(id, name, room);
        this.seat[id] = true;
        this.amount++;
        const playerList = await this.getPlayerList();
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
        return this.players.findIndex((player) => player.Name === name) !== -1;
    }

    public async getPlayerList(): Promise<string[]> {
        const nameList: string[] = [];
        this.players.forEach((player) => nameList.push(player.Name));

        return nameList;
    }

    public async Init(): Promise<void> {
        this.Deck         = new Cards(true);
        this.discardTiles = new Cards();
        this.huTiles      = new Cards();

        let len = await this.Deck.Count();
        for (const player of this.players) {
            player.Init();
            for (let j = 0; j < 13; j++) {
                const idx = ~~(Math.random() * len);
                const result = await this.Deck.at(idx);
                await this.Deck.sub(result);
                await player.Hand.add(result);
                len -= 1;
            }
            player.socket.emit("dealCard", await player.Hand.toStringArray());
        }
    }

    public async ChangeCard(): Promise<void> {
        for (const idx in this.players) {
            this.changedTiles[idx] = await this.players[idx].ChangeCard();
        }
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
            await this.players[idx].Hand.add(this.changedTiles[idx]);
            const t = await Cards.CardArrayToCards(this.changedTiles[idx]);
            this.players[idx].socket.emit("afterChange", await t.toStringArray(), rand);
        }
    }

    public async ChooseLack(): Promise<void> {
        for (const idx in this.players) {
            this.choosedLack[idx] = await this.players[idx].ChooseLack();
        }
        this.io.to(this.name).emit("afterLack", this.choosedLack);
    }

    public async Run(): Promise<void> {
        await this.Init();
        await Delay(5000);
        await this.ChangeCard();
        await Delay(3000);
        await this.ChooseLack();

        let currentIdx = 0;
        let onlyThrow  = false;
        let gameover   = false;
        while (!gameover) {
            let throwCard = new Card(-1, -1);
            let action = {command: CommandType.NONE, card: new Card(-1, -1)};
            if (onlyThrow) {
                throwCard = await this.players[currentIdx].ThrowCard();
                await this.players[currentIdx].Hand.sub(throwCard);
                onlyThrow = false;
            } else {
                const drawCard = await this.Deck.Draw();
                action = await this.players[currentIdx].Draw(drawCard);
                throwCard = action.card;
            }
            let commandIdx = {
                gonIdx: -1,
                huIdx:  -1,
                ponIdx: -1,
            };
            let fail   = false;

            if ((action.command & CommandType.COMMAND_PONGON)) {
                for (let i = 0; i < 4; i++) {
                    if (i !== currentIdx) {
                        let tai = 0;
                        tai = await this.players[i].checkHu(action.card);
                        if (tai) {
                            const cards = new Map<CommandType, Card[]>();
                            cards.set(CommandType.COMMAND_HU, new Array<Card>());
                            cards.get(CommandType.COMMAND_HU).push(action.card);
                            const act = await this.players[i].OnCommand(cards, CommandType.COMMAND_HU, (4 + currentIdx - i) % 4);
                            if (act.command & CommandType.COMMAND_HU) {
                                await this.players[currentIdx].Door.sub(action.card);
                                await this.players[currentIdx].VisiableDoor.sub(action.card);
                                this.players[currentIdx].credit -= Math.pow(2, tai);
                                await this.players[i].HuCards.add(action.card);
                                await this.huTiles.add(action.card);
                                this.players[i].credit += Math.pow(2, tai);
                                commandIdx.huIdx = i;
                                fail = true;
                                break;
                            }
                        }
                    }
                }
            } else if (!(action.command & CommandType.COMMAND_ZIMO) && !(action.command & CommandType.COMMAND_ONGON)) {
                commandIdx = this.CheckOthers(currentIdx, throwCard);
            }

            if (fail) {
                this.players[currentIdx].OnFail(action);
            } else {
                this.players[currentIdx].OnSuccess(action);
            }

            this.players[currentIdx].justGon = false;

            if (commandIdx.huIdx !== -1) {
                currentIdx = (commandIdx.huIdx + 1) % 4;
                if (commandIdx.gonIdx !== -1) {
                    this.players[commandIdx.gonIdx].OnFail(action);
                }
                if (commandIdx.ponIdx !== -1) {
                    this.players[commandIdx.ponIdx].OnFail(action);
                }
            } else if (commandIdx.gonIdx !== -1) {
                await this.players[commandIdx.gonIdx].Gon(throwCard);
                this.players[currentIdx].credit -= 2;
                this.players[commandIdx.gonIdx].credit += 2;
                this.players[commandIdx.gonIdx].gonRecord[currentIdx] += 2;
                currentIdx = commandIdx.gonIdx;
                this.players[commandIdx.gonIdx].OnSuccess(CommandType.COMMAND_GON);
                if (commandIdx.ponIdx !== -1) {
                    this.players[commandIdx.ponIdx].OnFail(action);
                }
            } else if (commandIdx.ponIdx !== -1) {
                await this.players[commandIdx.ponIdx].Pon(throwCard);
                currentIdx = commandIdx.ponIdx;
                onlyThrow = true;
                this.players[commandIdx.ponIdx].OnSuccess(CommandType.COMMAND_PON);
            }
            else if (!fail && (action.command & CommandType.COMMAND_ONGON) || (action.command & CommandType.COMMAND_PONGON)) {
                currentIdx = currentIdx;
            }
            else {
                if (throwCard.color > 0) {
                    await this.discardTiles.add(throwCard);
                }
                currentIdx = (currentIdx + 1) % 4;
            }
            if (await this.Deck.isEmpty()) {
                gameover = true;
            }
        }
        if (await this.HuUnder2()) {
            await this.LackPenalty();
            await this.NoTingPenalty();
            await this.ReturnMoney();
        }
        this.gameEnd();
    }
}
