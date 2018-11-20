import Player from "./player";
import Room from "./room";

export default class RoomManager {
    public static rooms: {[key: string]: Room};

    public createRoom(name: string): Room {
        RoomManager.rooms[name] = new Room(name);
        return RoomManager.rooms[name];
    }

    public removeRoom(name: string): void {
        delete RoomManager.rooms[name];
    }
}
