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
        socket.on("playerLogin", async (room: string, callback: any) => {
            if (typeof RoomManager.get(room) !== "undefined") {
                const roomPlayer = (await RoomManager.get(room).getPlayerList()).length;
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

            const id = await room.addPlayer(username, params.Room); // setiap player yang join ditambahin ke arr player
            room.players[id].socket = socket;

            // ----------------------- EVENT 2. RETURN CALLBACK GAME START -----------------------
            if (room.numPlayer === 4) {
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

    //     //// ----------------------- EVENT 7. LISTEN DRAW CARD -----------------------
    //     socket.on("drawCard", (id, room, callback) => {
    //         var getroom = rooms.getRoom(room); // ambil room
    //         var name = players.getPlayerName(id);
    //         var card = rooms.getTopCard(room);                  // ------------------------------------- for production
    //         var playerHand = rooms.drawCard(name, room);
    //         socket.emit("dealCard", card); // tampilin kartu di frontend ------------------------------------- for production
    //         players.updatePlayerHand(id, playerHand); // update kartu ke player data
    //         if (callback) {
    //             callback("you drew " + playerHand[playerHand.length - 1]);
    //         }
    //         callback();

    //         // Check Command
    //         logic.checkCommand(playerHand)
    //         if (command != "none") {
    //             socket.emit("giveCommand", command)
    //         }

    //         // DEFAULT THROW CARD ---------------------------------------------
    //         timer = setTimeout(() => {
    //             var name = players.getPlayerName(id);
    //             var card = getPlayerHand(id, room)[0]; // -============================================================ GANTI LOGICNYA
    //             var playerHand = rooms.throwCard(name, room, card);
    //             socket.emit("dealCard", playerHand); // tampilin kartu di frontend
    //             players.updatePlayerHand(id, playerHand); // update kartu ke player data
    //             rooms.changeTurn(name, room); // change turn

    //             console.log(getroom.currentTurn);
    //             console.log(getroom.roomField)
    //             io.to(room).emit("afterAction", getroom.currentTurn);
    //             // ----------------------- EVENT 11. EMIT OTHERS THROW -----------------------
    //             socket.to(room).emit("othersThrow", name, card);
    //         }, 2000);
    //     });

    //     //// ----------------------- EVENT 8. LISTEN THROW CARD -----------------------
    //     socket.on("throwCard", (id, room, card) => {
    //         clearTimeout(timer)
    //         var name = players.getPlayerName(id);
    //         var playerHand = rooms.throwCard(name, room, card);
    //         socket.emit("dealCard", playerHand); // tampilin kartu di frontend
    //         players.updatePlayerHand(id, playerHand); // update kartu ke player data
    //         rooms.changeTurn(name, room); // change turn

    //         var room = rooms.getRoom(room); // ambil room
    //         console.log(room.currentTurn);
    //         console.log(room.roomField);
    //         io.to(room.roomname).emit("afterAction", room.currentTurn);
    //         // ----------------------- EVENT 11. EMIT OTHERS THROW -----------------------
    //         socket.to(room.roomname).emit("othersThrow", name, card);
    //     });

    //     // not tested events---------------------------------------------------------
    //     // region

    //     //// ----------------------- EVENT 9. LISTEN COMMAND -----------------------
    //     socket.on("getCommand", (id, room, callback) => {
    //         var hand = players.getPlayerHand(id);
    //         var field = rooms.getRoom(room).roomField;
    //         var command = logic.checkCommand(hand, field);
    //         if (command != "none") {
    //             socket.emit("giveCommand", command);
    //         }
    //         // var obj = {command:cmd, card:card}
    //         // players.updatePlayerCommand(id, obj);
    //         // socket.emit("showCommand", obj); //kasih ke front end
    //     });

    //     //// ----------------------- EVENT 10. LISTEN SUCCESS COMMAND -----------------------
    //     socket.on("onSuccess", (id, cmd, card, score) => {
    //         var name = players.getPlayerName(id);
    //         var room = players.getPlayerRoom(id);
    //         var fromName = rooms.getRoom(room).roomField[0].name;

    //         players.updatePlayerScore(id, score);
    //         rooms.changeTurn(name, room); // change turn

    //         // ----------------------- EVENT 12. EMIT OTHERS COMMAND -----------------------
    //         io.to(room).emit("othersCommand", name, fromName, cmd, card, score);
    //     });

    //     //// ----------------------- EVENT 13. LISTEN END GAME -----------------------
    //     socket.on("endGame", (room, result) => {
    //         var player = players.getPlayerList(room);
    //         var result = [];
    //         player.forEach((p) => {
    //             var obj = {};
    //             obj["name"] = p.name;
    //             obj["score"] = p.score;
    //             result.push(obj);
    //         });
    //     });
    //     // endregion

    //     // on disconnect
    //     // region
    //     socket.on("disconnect", () => {
    //         var playerRoom = players.getPlayerRoom(id);
    //         var player = players.removePlayer(id);
    //         var playerList = rooms.getPlayerNames(players, playerRoom);
    //         if (player) {
    //             io.to(player.room).emit("updatePlayerList", playerList);
    //         }
    //         console.log("disconnected");
    //     });
    //     // endregion
    });

    server.listen(3000, () => {
        console.log("listening on *:3000");
    });

}

main();
