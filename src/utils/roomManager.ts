import Player from "./player";
import Room from "./room";

export default class RoomManager {
    public rooms: {[key: string]: Room};

    public createRoom(name: string): Room {
        this.rooms[name] = new Room(name);
        return this.rooms[name];
    }

    public removeRoom(name: string): void {
        delete this.rooms[name];
    }
}
