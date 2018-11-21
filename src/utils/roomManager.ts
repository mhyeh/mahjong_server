import Player from "./player";
import Room from "./room";

class RoomManager extends Map<string, Room> {
    public static roomManager: RoomManager = new RoomManager();
    public createRoom(name: string): Room {
        this.set(name, new Room(name));
        return this.get(name);
    }

    public removeRoom(name: string): void {
        this.delete(name);
    }
}
export const roomManager = RoomManager.roomManager;
