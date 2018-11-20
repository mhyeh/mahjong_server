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

import RoomManager from "./utils/roomManager";
import Player from "./utils/player";
import Room from "./utils/room";
import * as logic from "./utils/logic"

const roomManager = new RoomManager();

const app = express();
app.set("port", process.env.PORT || 3000);

const server = http.createServer(app);
// set up socket.io and bind it to our
// http server.
const io = socketIO(server);

// whenever a user connects on port 3000 via
// a websocket, log that a user has connected
io.on("connection", (socket: any) => {
  console.log("a user connected");
  // join room ----------------------------------------------------------------------------------
    // region
    // validasi room penuh ga waktu mau mau login
  socket.on("playerLogin",(room: string, callback: any) => {
    var roomPlayer = roomManager.rooms[room].getPlayerList().length;
    if(roomPlayer >= 4){
        callback("Room is Full")
    }
    callback();
  });
  
  
  // ----------------------- EVENT 1. LISTEN JOIN ROOM -----------------------
  //region
  let id: string;
  // var timer;
  socket.on("join", (params: {Username: string, Room: string}, callback: any)=>{
      const username = params.Username;
      let room: Room;

      if (!roomManager.rooms[params.Room]) {
        room = roomManager.createRoom(params.Room);
      }
      if (room.numPlayer >= 4) { //validasi room pentuh waktu maksa masukin url
          return callback("Room is Full");
      }

      if (room.players[username]) {
          return callback("Username already taken");
      }

      
      console.log("New Player Join");
      socket.join(room); // join room
      
      const id = username;
      room.addPlayer(id, username); // setiap player yang join ditambahin ke arr player
      const playerList = room.getPlayerNameList();
      io.to(room.Name).emit("updatePlayerList", playerList); // update div nya player
      const roomPlayer = playerList.length; // ngambil ulang jumlah player
      
      //console.log(JSON.stringify(players,undefined,2))
      //console.log(roomPlayer)
      //console.log(playerList)
      //----------------------- EVENT 2. RETURN CALLBACK GAME START -----------------------
      if (roomPlayer === 4) {
          return callback("Room Ready");  
      }
      callback(); //gak ngasih apa-apa karna ga error
  });
  //endregion 
  // end join room ------------------------------------------------------------------------------
  
  
  ////----------------------- EVENT 2. LISTEN GAME START -----------------------
  //region
  socket.on("startGame", (room: string, callback: any)=>{
      // ngambil nama player pada room tersebut
      var number = roomManager.rooms[room].numPlayer; // players = seluruh player yang ada
      if (number === 4){
          io.to(room).emit("initState", room);
          return callback(roomManager.rooms[room].getPlayerNameList()); //player names 
      }
      callback();
  });
  
  socket.on("requestCard", (id: string, room: string) =>{
      playerHand = getPlayerHand(id,room);
      socket.emit("dealCard", playerHand); // kasih kartu
      players.updatePlayerHand(id, playerHand); // update player hand
      //console.log(JSON.stringify(rooms, undefined, 2));
  });
     
  //endregion
  // end making room ----------------------------------------------------
  
  ////----------------------- EVENT 3. LISTEN CHANGE CARD -----------------------
  // default change card
  socket.on("cdChangeCard", (id,roomname)=>{
      timer = setTimeout(()=>{
          var room = rooms.getRoom(roomname); // ambil room
          var cards = getPlayerHand(id,roomname).slice(0,3); //-=============================================== GANTI LOGICNYA
          rooms.returnCards(roomname, id, cards);
          room.changeCard++;

          var playerHand = getPlayerHand(id,roomname);
          socket.emit("dealCard", playerHand); // kasih kartu
          players.updatePlayerHand(id, playerHand); // update player hand

          if(room.changeCard === 4){
              //----------------------- EVENT 4. EMIT AFTER CHANGE -----------------------
              io.to(roomname).emit("afterChange", room.currentTurn);
              rooms.returnChangeCard(roomname);
              room.changeCard = 0;
          }
      }, 200)
  })

  socket.on("changeCard", (id, params, cards, callback)=>{
      clearTimeout(timer)
      var room = rooms.getRoom(params.Room); // ambil room
      rooms.returnCards(params.Room, id, cards);
      room.changeCard++;

      var playerHand = getPlayerHand(id,params.Room);
      socket.emit("dealCard", playerHand); // kasih kartu
      players.updatePlayerHand(id, playerHand); // update player hand
      //callback("you change "+cards+" to "+playerHand.slice(playerHand.length-3,playerHand.length));
      callback("you change "+cards);
      if(room.changeCard === 4){
          //----------------------- EVENT 4. EMIT AFTER CHANGE -----------------------
          io.to(params.Room).emit("afterChange", room.currentTurn);
          rooms.returnChangeCard(params.Room);
          room.changeCard = 0;
          callback();
      }
      //console.log(JSON.stringify(rooms, undefined, 2));
  })

  ////----------------------- EVENT 5. LISTEN CHOOSE LACK -----------------------
  // default change card
  socket.on("cdChooseLack", (id,roomname)=>{
      timer = setTimeout(()=>{
          var room = rooms.getRoom(roomname);
          var lackColor = Math.floor(Math.random() * 3); 
          players.updatePlayerLack(id, lackColor);
          room.chooseLack++;
          if(room.chooseLack === 4){
              //----------------------- EVENT 6. EMIT AFTER LACK -----------------------
              io.to(roomname).emit("afterAction", room.currentTurn);
              room.chooseLack = 0;
              //console.log(JSON.stringify(players, undefined, 2));
          }
      }, 200)
  })

  socket.on("chooseLack", (id, roomname, lackColor, callback)=>{
      clearTimeout(timer)
      var room = rooms.getRoom(roomname);
      players.updatePlayerLack(id, lackColor);
      callback("you choose lack "+lackColor);
      room.chooseLack++;
      if(room.chooseLack === 4){
          //----------------------- EVENT 6. EMIT AFTER LACK -----------------------
          io.to(roomname).emit("afterAction", room.currentTurn);
          room.chooseLack = 0;
          callback();
      }
      //console.log(JSON.stringify(rooms, undefined, 2));
      //console.log(JSON.stringify(players, undefined, 2));
  })
  
  ////----------------------- EVENT 7. LISTEN DRAW CARD -----------------------
  socket.on("drawCard", (id, room, callback)=>{
      var getroom = rooms.getRoom(room); // ambil room
      var name = players.getPlayerName(id);
      var card = rooms.getTopCard(room);                  //------------------------------------- for production
      var playerHand = rooms.drawCard(name, room);
      socket.emit("dealCard", card); // tampilin kartu di frontend ------------------------------------- for production
      players.updatePlayerHand(id, playerHand); // update kartu ke player data
      if (callback) {
          callback("you drew "+playerHand[playerHand.length-1]);
      }
      callback();

      // Check Command
      logic.checkCommand(playerHand)
      if(command != "none"){
          socket.emit("giveCommand", command)
      }
      
      // DEFAULT THROW CARD ---------------------------------------------
      timer = setTimeout(()=>{
          var name = players.getPlayerName(id);
          var card = getPlayerHand(id,room)[0]; //-============================================================ GANTI LOGICNYA
          var playerHand = rooms.throwCard(name, room, card);
          socket.emit("dealCard", playerHand); // tampilin kartu di frontend
          players.updatePlayerHand(id, playerHand); // update kartu ke player data
          rooms.changeTurn(name, room); //change turn
          
          console.log(getroom.currentTurn);
          console.log(getroom.roomField)
          io.to(room).emit("afterAction", getroom.currentTurn);
          //----------------------- EVENT 11. EMIT OTHERS THROW -----------------------
          socket.to(room).emit("othersThrow", name, card);
      }, 2000)
  })
  
  ////----------------------- EVENT 8. LISTEN THROW CARD -----------------------
  socket.on("throwCard", (id, room, card)=>{
      clearTimeout(timer)
      var name = players.getPlayerName(id);
      var playerHand = rooms.throwCard(name, room, card);
      socket.emit("dealCard", playerHand); // tampilin kartu di frontend
      players.updatePlayerHand(id, playerHand); // update kartu ke player data
      rooms.changeTurn(name, room); //change turn
      
      var room = rooms.getRoom(room); // ambil room
      console.log(room.currentTurn);
      console.log(room.roomField);
      io.to(room.roomname).emit("afterAction", room.currentTurn);
      //----------------------- EVENT 11. EMIT OTHERS THROW -----------------------
      socket.to(room.roomname).emit("othersThrow", name, card);
  });
  
  
  // not tested events---------------------------------------------------------
  // region
  
  ////----------------------- EVENT 9. LISTEN COMMAND -----------------------
  socket.on("getCommand", (id, room, callback)=>{
      var hand = players.getPlayerHand(id);
      var field = rooms.getRoom(room).roomField;
      var command = logic.checkCommand(hand, field);
      if(command != "none"){
          socket.emit("giveCommand", command)
      }
      //var obj = {command:cmd, card:card}
      //players.updatePlayerCommand(id, obj);
      //socket.emit("showCommand", obj); //kasih ke front end
  })
  
  ////----------------------- EVENT 10. LISTEN SUCCESS COMMAND -----------------------
  socket.on("onSuccess", (id, cmd, card, score)=>{
      var name = players.getPlayerName(id);
      var room = players.getPlayerRoom(id);
      var fromName = rooms.getRoom(room).roomField[0].name;
      
      players.updatePlayerScore(id, score);
      rooms.changeTurn(name, room); //change turn
      
      //----------------------- EVENT 12. EMIT OTHERS COMMAND -----------------------
      io.to(room).emit("othersCommand",name, fromName, cmd, card, score);
  })
  
  ////----------------------- EVENT 13. LISTEN END GAME -----------------------
  socket.on("endGame", (room, result)=>{
      var player = players.getPlayerList(room);
      var result = [];
      player.forEach((p)=>{
          var obj = {};
          obj["name"] = p.name;
          obj["score"] = p.score;
          result.push(obj);
      });
  })
  // endregion
  
  // on disconnect
  // region
  socket.on("disconnect", ()=>{
      var playerRoom = players.getPlayerRoom(id);
      var player = players.removePlayer(id);
      var playerList = rooms.getPlayerNames(players, playerRoom);
      if(player){
          io.to(player.room).emit("updatePlayerList", playerList);
      }
      console.log("disconnected")
  });
  // endregion
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
