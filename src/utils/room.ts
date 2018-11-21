import * as socketIO from "socket.io";
import {Card, Cards} from "./card";
import * as logic from "./logic";
import Player from "./player";
import { Delay } from "./System";

export default class Room extends Map<string, Player> {
    public Deck:         Cards;
    public discardTiles: Cards;
    public huTiles:      Cards;
    public changedTiles = new Map<string, Cards>();

    public io: SocketIO.Server;

    private name: string;
    private amount: number;

    public get Name(): string {
        return this.name;
    }

    public get numPlayer(): number {
        return this.amount;
    }

    constructor(name: string) {
        super();
        this.name = name;
        this.amount = 0;
    }

    public async addPlayer(id: string, name: string, room: string): Promise<void> {
        this.set(id, new Player(id, name, room));
        this.amount++;
        const nameList = await this.getPlayerNameList();
        this.io.to(this.name).emit("updatePlayerList", nameList);

        if (this.amount === 4) {
            this.io.to(this.name).emit("storePlayerList", nameList);
        }
    }

    public removePlayer(id: string): void {
        this.delete(id);
        this.amount--;
    }

    public async getPlayerList(): Promise<Player[]> {
        const playerList: Player[] = [];
        this.forEach((player) => playerList.push(player));

        return playerList;
    }

    public async getPlayerNameList(): Promise<string[]> {
        const nameList: string[] = [];
        this.forEach((player) => nameList.push(player.Name));

        return nameList;
    }

    public async Init(): Promise<void> {
        this.Deck = new Cards(true);
        this.discardTiles = new Cards();
        this.huTiles = new Cards();

        let len = await this.Deck.Count();
        for (const [name, player] of this.entries()) {
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
        for (const [name, player] of this.entries()) {
            const defaultChangeCard = await player.defaultChangeCard();
            player.socket.emit("change", await defaultChangeCard.toStringArray(), 30000);
            player.socket.on("changeCard", (card: string[]) => {
                // TODO
            });
        }

    }

    public async ChooseLack(): Promise<void> {
        // TODO
    }

    public async Run(): Promise<void> {
        await this.Init();
        await Delay(5000);
        await this.ChangeCard();
        await this.ChooseLack();
    }
}
