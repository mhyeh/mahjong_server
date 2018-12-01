/**
 * Module dependencies.
 */
import * as express from "express";
import * as http from "http";
import * as socketIO from "socket.io";

import { GameManager } from "./utils/GameManager";
import * as System from "./utils/System";

async function main(): Promise<void> {
    const game = new GameManager();

    await game.InitHuTable();

    const app = express();
    app.set("port", process.env.PORT || 3000);
    const server = http.createServer(app);
    const io = socketIO(server);
    game.exec();

    // whenever a user connects on port 3000 via
    // a websocket, log that a user has connected
    io.on("connection", (socket: socketIO.Socket) => {
        console.log("a user connected");

        socket.on("join", (name: string, callback: any) => callback(game.Login(name, socket)));

        socket.on("auth", (room: string, uuid: string, callback: any) => {
            if (!game.playerManager.Auth(room, uuid)) {
                callback("auth failed");
                return;
            }

            socket.join(room, () => {
                game.rooms.get(room).io = io;
                const index = game.playerManager.FindPlayerByUUID(uuid);
                game.PlayerList[index].socket = socket;
                callback();
            });
        });

        socket.on("ready", (room: string, uuid: string, callback: any) => {
            if (!game.playerManager.Auth(room, uuid)) {
                callback("auth failed");
                return;
            }

            const id = game.rooms.get(room).Accept(uuid);
            console.log("accept", id);
            if (id === -1) {
                callback("auth failed");
                return;
            }
            callback(id);
        });

        socket.on("disconnect", () => {
            game.Logout(socket);
        });
    });

    server.listen(3000, () => {
        console.log("listening on *:3000");
    });
}

main();
