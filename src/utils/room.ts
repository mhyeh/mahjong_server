import * as socketIO from "socket.io";
import {Cards} from "./card";
import * as logic from "./logic";
import Player from "./player";

export default class Room {
    public players: {[key: string]: Player};

    public deck:         Cards;
    public discardTiles: Cards;
    public huTiles:      Cards;
    public changedTiles: {[key: string]: Cards};

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
        this.name = name;
        this.amount = 0;
    }

    public async addPlayer(id: string, name: string, room: string): Promise<void> {
        this.players[id] = new Player(id, name, room);
        this.amount++;
        this.io.to(this.name).emit("updatePlayerList", await this.getPlayerNameList());

        if (this.amount === 4) {

        }
    }

    public removePlayer(id: string): void {
        delete this.players[id];
        this.amount--;
    }

    public async getPlayerList(): Promise<Player[]> {
        const playerList = Object.keys(this.players).map((idx: string) => this.players[idx]);

        return playerList;
    }

    public async getPlayerNameList(): Promise<string[]> {
        const nameList = Object.keys(this.players).map((idx: string) => this.players[idx].Name);

        return nameList;
    }

    public Init(): void {
        this.deck = new Cards(true);
        this.discardTiles = new Cards();
        this.huTiles = new Cards();
        for (const idx in this.players) {
            this.players[idx].Init();
        }
    }

    public async ChangeCard(): Promise<void> {
        this.io.to(this.name).emit("changeCard");
    }

    public async ChooseLack(): Promise<void> {
        
    }

    public async Run(): Promise<void> {
        this.Init();
        await this.ChangeCard();
        await this.ChooseLack();
    }
}
