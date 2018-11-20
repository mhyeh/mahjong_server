import {Cards} from "./card";
export default class Player {
    public hand: Cards;
    public lack: number;

    private id: string;
    private name: string;

    public get ID(): string {
        return this.id;
    }

    public get Name(): string {
        return this.name;
    }


    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

}
