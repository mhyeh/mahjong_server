import * as socketIO from "socket.io";
import { v4 } from "uuid";

export enum STATE {
    WAITING = 0x0000,
    MATCHED = 0x0001,
    READY   = 0x0010,
    PLAYING = 0x0100,
    LEAVE   = 0x1000,
}

export interface IPlayer {
    name:    string;
    uuid:    string;
    room:    string;
    socket?: socketIO.Socket;
    state:   STATE;
}

export class PlayerManager {
    public static GetNameList(list: IPlayer[]): string[] {
        const nameList = [];
        for (const player of list) {
            nameList.push(player.name);
        }
        return nameList;
    }

    public static GetUUIDList(list: IPlayer[]): string[] {
        const uuidList = [];
        for (const player of list) {
            uuidList.push(player.uuid);
        }
        return uuidList;
    }

    public get PlayerList(): IPlayer[] {
        return this.playerList;
    }

    private playerList: IPlayer[];

    public AddPlayer(_name: string): number | string {
        if (this.FindPlayerByName(_name) !== -1) {
            return -1;
        }
        const _uuid = v4();
        this.playerList.push({ name: _name, uuid: _uuid, room: "", socket: undefined, state: STATE.WAITING });
        return _uuid;
    }

    public RemovePlayer(id: number) {
        if (id > 0 && id < this.playerList.length) {
            this.playerList.splice(id, 1);
        }
    }

    public FindPlayerByName(name: string): number {
        return this.playerList.findIndex((player) => player.name === name);
    }

    public FindPlayerByUUID(uuid: string): number {
        return this.playerList.findIndex((player) => player.uuid === uuid);
    }

    public FindPlayerBySocket(socket: socketIO.Socket): number {
        return this.playerList.findIndex((player) => player.socket.id === socket.id);
    }

    public FindPlayersInRoom(room: string): IPlayer[] {
        const list = [];
        for (const player of this.playerList) {
            if (player.room === room) {
                list.push(player);
                if (list.length === 4) {
                    break;
                }
            }
        }
        return list;
    }

    public FindPlayersIsSameState(state: STATE): IPlayer[] {
        const list = [];
        for (const player of this.playerList) {
            if (player.state === state) {
                list.push(player);
                if (list.length === 4) {
                    break;
                }
            }
        }
        return list;
    }

    public Auth(room: string, uuid: string): boolean {
        return this.playerList.findIndex((player) => player.room === room && player.uuid === uuid) !== -1;
    }
}
