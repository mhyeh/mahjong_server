import * as bcrypt from "bcrypt";
import * as socketIO from "socket.io";

import Lobby from "./Lobby";
import { IPlayer, PlayerManager, STATE } from "./PlayerManager";
import Room from "./Room";
import * as System from "./System";

export enum CommandType {
    NONE           = 0b0000000,	// 沒有
    COMMAND_PON    = 0b0000001, // 碰
    COMMAND_GON    = 0b0000010, // 直槓
    COMMAND_ONGON  = 0b0000100, // 暗槓
    COMMAND_PONGON = 0b0001000, // 面下槓
    COMMAND_HU     = 0b0010000, // 胡
    COMMAND_ZIMO   = 0b0100000, // 自摸
}

export class GameManager {
    public rooms: Map<string, Room> = new Map<string, Room>();
    public playerManager: PlayerManager = new PlayerManager();

    private lobby: Lobby = new Lobby(this);

    private SIZE = 76695844;
    private MAX  = 76699939;

    private g_data:  number[] = new Array<number>(this.MAX);
    private g_group: number[] = [];
    private g_eye:   number[] = [];

    public get PlayerList(): IPlayer[] {
        return this.playerManager.PlayerList;
    }

    public Login(name: string, socket: socketIO.Socket): number | string {
        const uuid = this.playerManager.AddPlayer(name);
        if (typeof uuid === "number") {
            return -1;
        }
        const index = this.playerManager.FindPlayerByUUID(uuid);
        this.PlayerList[index].socket = socket;
        this.PlayerList[index].state  = STATE.WAITING;
        // const uuid = this.lobby.Enter(name, socket);

        // if (this.lobby.waittingNum >= 4) {
        //     this.CreateRoom();
        // }

        return uuid;
    }

    public Logout(socket: SocketIO.Socket) {
        const index = this.playerManager.FindPlayerBySocket(socket);
        if (index >= 0 && index < this.PlayerList.length && this.PlayerList[index].state === STATE.WAITING) {
            this.playerManager.RemovePlayer(index);
        }
    }

    public async exec() {
        while (1) {
            if (this.lobby.waittingNum >= 4) {
                this.CreateRoom();
                await System.Delay(2 * System.sec);
            } else {
                await System.Delay(10 * System.sec);
            }
        }
    }

    public CreateRoom(): void {
        const roomName = bcrypt.genSaltSync(40).substr(7, 20);
        this.rooms.set(roomName, new Room(this, roomName));
        const matchPlayer = this.lobby.Match();
        const room = this.rooms.get(roomName);
        room.addPlayer(matchPlayer);
        room.waitToStart();
    }

    public RemoveRoom(name: string): void {
        this.rooms.delete(name);
    }

    public InitHuTable(): boolean {
        let i;
        if (!this.g_data) {
            return false;
        }
        this.g_group.push(0);
        for (i = 0; i < 9; i++) {
            this.g_group.push(3 << i * 3);
        }
        for (i = 0; i < 7; i++) {
            this.g_group.push(73 << i * 3);
        }
        for (i = 0; i < 9; i++) {
            this.g_eye.push(2 << i * 3);
        }
        this.B01(4, 0, this.SIZE);
        this.B2(4, 0, 1);
        this.B3(7, 0, 1);
        this.B4();
        this.B5(4, 0, 1);
        this.B6();
        this.B7();
        this.B8(4, 0, this.SIZE);
        this.B9UP();
        this.T();
        console.log("Initialization Completed!");
        return true;
    }

    public SSJ(hand: number, door: number): number {
        const idx = (((this.g_data[hand & 134217727] | 4) &
            (this.g_data[hand >> 27] | 4) &
            (this.g_data[door & 134217727] | 64) &
            (this.g_data[door >> 27] | 64) &
            (484 | ((this.g_data[door & 134217727] & this.g_data[door >> 27] & 16) >> 1)))
            | (((this.g_data[hand & 134217727] & (this.g_data[door & 134217727] | 3)) | (this.g_data[hand >> 27] & (this.g_data[door >> 27] | 3))) & 19)
            | ((this.g_data[(hand & 134217727) + (door & 134217727)] & 3584) + (this.g_data[(hand >> 27) + (door >> 27)] & 3584)));
        return this.g_data[this.SIZE + idx];
    }

    private have(m: number, s: number): boolean {
        let i;
        for (i = 0; i < 9; i++) {
            if (((m >> i * 3) & 7) < ((s >> i * 3) & 7)) {
                return false;
            }
        }

        return true;
    }

    private B01(n: number, d: number, p: number): void {
        let i;
        if (n) {
            for (i = 0; i < 17; i++) {
                if (this.have(p, this.g_group[i])) {
                    this.B01(n - 1, d + this.g_group[i], p - this.g_group[i]);
                }
            }
        } else {
            this.g_data[d] |= 1;
            for (i = 0; i < 9; i++) {
                if (this.have(p, this.g_eye[i])) {
                    this.g_data[d + this.g_eye[i]] |= 2;
                }
            }
        }
    }

    private B2(n: number, d: number, c: number): void {
        let i;
        this.g_data[d] |= 4;
        this.g_data[d] |= 32;
        if ((d & 16777208) === 0) {
            this.g_data[d] |= 256;
        }
        if (n) {
            for (i = c; i <= 9; i++) {
                this.B2(n - 1, d + this.g_group[i], i + 1);
                this.B2(n - 1, d + this.g_group[i] / 3 * 4, i + 1);
            }
        }
    }

    private B3(n: number, d: number, c: number): void {
        let i;
        this.g_data[d] |= 8;
        if (n) {
            for (i = c; i <= 9; i++) {
                this.B3(n - 1, d + this.g_group[i] / 3 * 2, i + 1);
                this.B3(n - 2, d + this.g_group[i] / 3 * 4, i + 1);
            }
        }
    }

    private B4(): void {
        this.g_data[0] |= 16;
    }

    private B5(n: number, d: number, c: number): void {
        let i;
        this.g_data[d] |= 32;
        for (i = 0; i < 9; i++) {
            if (this.have(this.SIZE - d, this.g_eye[i])) {
                this.g_data[d + this.g_eye[i]] |= 32;
            }
        }
        if (n) {
            for (i = c; i <= 9; i++) {
                this.B5(n - 1, d + this.g_group[i], i + 1);
            }
        }
    }

    private B6(): void {
        let i;
        this.g_data[0] |= 64;
        for (i = 0; i < 9; i++) {
            this.g_data[this.g_eye[i]] |= 64;
        }
    }

    private B7(): void {
        let i;
        for (i = 0; i < this.SIZE; i++) {
            if ((i & 119508935) === 0) {
                this.g_data[i] |= 128;
            }
        }
    }

    private B8(n: number, d: number, p: number): void {
        let i;
        if (n) {
            for (i = 0; i < 17; i++) {
                if (this.have(p, this.g_group[i]) && (i === 0 || i === 1 || i === 9 || i === 10 || i === 16)) {
                    this.B8(n - 1, d + this.g_group[i], p - this.g_group[i]);
                }
            }
        } else {
            this.g_data[d] |= 256;
            for (i = 0; i < 9; i++) {
                if (this.have(p, this.g_eye[i]) && (i === 0 || i === 8)) {
                    this.g_data[d + this.g_eye[i]] |= 256;
                }
            }
        }
    }

    private B9UP(): void {
        let i;
        let j;
        let k;
        for (i = 0; i < this.SIZE; i++) {
            k = 0;
            for (j = 0; j < 9; j++) {
                if (i & (4 << j * 3)) {
                    k++;
                }
            }
            if (k > 7) {
                k = 7;
            }
            this.g_data[i] |= (k << 9);
        }
    }

    private T(): void {
        let i;
        let k;
        for (i = 0; i < 4095; i++) {
            k = 0;
            if ((i & 7) === 7) {
                k = 1;
                if ((i & 32) === 32) {
                    k = 2;
                }
                if ((i & 16) === 16) {
                    k = 3;
                }
                if ((i & 64) === 64) {
                    k = 3;
                }
                if ((i & 256) === 256) {
                    k = 3;
                }
                if ((i & 48) === 48) {
                    k = 4;
                }
                if ((i & 160) === 160) {
                    k = 4;
                }
                if ((i & 272) === 272) {
                    k = 5;
                }
                if ((i & 80) === 80) {
                    k = 5;
                }
                if ((i & 192) === 192) {
                    k = 5;
                }
                k += (i >> 9);
            } else if (i & 8) {
                k = 3;
                if ((i & 16) === 16) {
                    k = 5;
                }
                if (i >> 9) {
                    k = 4;
                }
                if ((i & 16) === 16 && (i >> 9)) {
                    k = 5;
                }
                k += (i >> 9);
            }
            this.g_data[this.SIZE + i] = k;
        }
    }
}
