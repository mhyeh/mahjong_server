/**
 * Module dependencies.
 */
import * as bodyParser from "body-parser";
import * as errorHandler from "errorhandler";
import * as express from "express";
import * as path from "path";
import * as socketIO from "socket.io";
import expressValidator = require("express-validator");
import * as http from "http";

import * as logic from "./utils/logic";
import Room from "./utils/room";
import {roomManager as RoomManager} from "./utils/roomManager";
import * as System from "./utils/System";

async function main(): Promise<void> {
    await logic.InitHuTable();

    const app = express();
    app.set("port", process.env.PORT || 3000);
    const server = http.createServer(app);
    const io = socketIO(server);

    // whenever a user connects on port 3000 via
    // a websocket, log that a user has connected
    io.on("connection", (socket: any) => {
        console.log("a user connected");
        // join room ----------------------------------------------------------------------------------
        // region
        socket.on("playerLogin", (room: string, callback: any) => {
            if (typeof RoomManager.get(room) !== "undefined") {
                const roomPlayer = RoomManager.get(room).numPlayer;
                if (roomPlayer >= 4) {
                    callback("Room is Full");
                }
            }
            callback();
        });

        // ----------------------- EVENT 1. LISTEN JOIN ROOM -----------------------
        // region
        socket.on("join", async (params: { Username: string, Room: string }, callback: any) => {
            const username = params.Username;
            let room: Room;

            if (typeof RoomManager.get(params.Room) === "undefined") {
                room = RoomManager.createRoom(params.Room);
            } else {
                room = RoomManager.get(params.Room);
            }
            if (room.numPlayer >= 4) { // validasi room pentuh waktu maksa masukin url
                return callback("Room is Full");
            }

            if (room.findUser(username)) {
                return callback("Username already taken");
            }

            console.log("New Player Join");
            socket.join(room.Name); // join room
            room.io = io;

            const id = room.addPlayer(username, params.Room); // setiap player yang join ditambahin ke arr player
            room.players[id].socket = socket;

            // ----------------------- EVENT 2. RETURN CALLBACK GAME START -----------------------
            if (room.numPlayer === 4) {
                await System.Delay(10000);
                room.Run();
            }
            callback(); // gak ngasih apa-apa karna ga error
        });
        // endregion
        // end join room ------------------------------------------------------------------------------

        socket.on("login", (id: number, room: string, callback: any) => {
            socket.join(room);
            try {
                RoomManager.get(room).io = io;
                RoomManager.get(room).players[id].socket = socket;
            } catch (e) {
                console.log(e);
                callback(e);
            }
            callback();
        });
    });

    server.listen(3000, () => {
        console.log("listening on *:3000");
    });

}

main();
