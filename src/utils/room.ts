import * as logic from "./logic";
import Player from "./player";
export default class Room {
    public players: {[key: string]: Player};

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
    public addPlayer(id: string, name: string): void {
        this.players[id] = new Player(id, name);
        this.amount++;
    }

    public removePlayer(id: string): void {
        delete this.players[id];
        this.amount--;
    }

    public getPlayerList(): Player[] {
        const playerList = Object.keys(this.players).map((idx: string) => {
            return this.players[idx];
        });

        return playerList;
    }

    public getPlayerNameList(): string[] {
        const nameList = Object.keys(this.players).map((idx: string) => {
            return this.players[idx].Name;
        });

        return nameList;
    }
}
