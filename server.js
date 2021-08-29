var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var express = require("express");
var http = require("http");
var uuidv4 = require("uuid").v4;
var cors = require("cors");
var twilio = require("twilio");
var PORT = process.env.PORT || 5002;
var app = express();
var server = http.createServer(app);
app.use(cors());
var connectedUsers = [];
var rooms = [];
app.get("/api/room-exists/:roomId", function (req, res) {
    var roomId = req.params.roomId;
    var room = rooms.find(function (room) { return room.id === roomId; });
    if (room) {
        if (room.connectedUsers.length > 3) {
            return res.send({ roomExists: true, full: true });
        }
        else {
            return res.send({ roomExists: true, full: false });
        }
    }
    else {
        return res.send({ roomExists: false });
    }
});
var io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
io.on("connection", function (socket) {
    console.log("user connected " + socket.id);
    //  onはデータを受信する処理
    // 第一引数はクライアントサイドで送信されたメソッド名
    // 第二引数は受け取ったデータに応じて処理を実行する
    socket.on("create-new-room", function (data) {
        createNewRoomHandler(data, socket);
    });
    socket.on("join-room", function (data) {
        joinRoomHandler(data, socket);
    });
    socket.on("disconnect", function () {
        disconnectHandler(socket);
    });
});
// 新しい部屋を作成する処理
var createNewRoomHandler = function (data, socket) {
    console.log("host is creating room");
    console.log(data);
    var identity = data.identity;
    var roomId = uuidv4();
    console.log(roomId);
    // 新規ユーザーの作成
    var newUser = {
        identity: identity,
        id: uuidv4(),
        socketId: socket.id,
        roomId: roomId
    };
    //配列に新しいユーザーを追加する
    connectedUsers = __spreadArray(__spreadArray([], connectedUsers), [newUser]);
    // 新部屋の作成
    var newRoom = {
        id: roomId,
        // connectedUsers: connectedUsers
        connectedUsers: [newUser]
    };
    // socket.ioルームへの参加
    socket.join(roomId);
    rooms = __spreadArray(__spreadArray([], rooms), [newRoom]);
    //  emit to that which created that roomId
    socket.emit("room-id", { roomId: roomId });
    socket.emit("room-update", { connectedUsers: newRoom.connectedUsers });
};
var joinRoomHandler = function (data, socket) {
    var identity = data.identity, roomId = data.roomId;
    var newUser = {
        identity: identity,
        id: uuidv4(),
        socketId: socket.id,
        roomId: roomId
    };
    // ルームidを入寮区してユーザーが参加する処理
    var room = rooms.find(function (room) { return room.id === roomId; });
    room.connectedUsers = __spreadArray(__spreadArray([], room.connectedUsers), [newUser]);
    // socket.idルームに参加する処理
    socket.join(roomId);
    // 新しいuserを参加させる処理
    connectedUsers = __spreadArray(__spreadArray([], connectedUsers), [newUser]);
    io.to(roomId).emit("room-update", { connectedUsers: room.connectedUsers });
};
var disconnectHandler = function (socket) {
    // 一致するユーザーを検索
    var user = connectedUsers.find(function (user) { return user.socketId === socket.id; });
    if (user) {
        var room_1 = rooms.find(function (room) { return room.id === user.roomId; });
        room_1.connectedUsers = room_1.connectedUsers.filter(function (user) { return user.socketId !== socket.id; });
        socket.leave(user.roomId);
        if (room_1.connectedUsers.length > 0) {
            io.to(room_1.id).emit("room-update", {
                connectedUsers: room_1.connectedUsers
            });
        }
        else {
            rooms = rooms.filter(function (r) { return r.id !== room_1.id; });
        }
    }
};
server.listen(PORT, function () {
    console.log("server listening on " + PORT);
});
