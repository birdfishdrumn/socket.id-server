const express = require("express")
const http = require("http")
const { v4: uuidv4 } = require("uuid")
const cors = require("cors")
const twilio = require("twilio")


const PORT = process.env.PORT || 5002

const app = express()



const server = http.createServer(app)

app.use(cors())

let connectedUsers = []
let rooms = []

app.get("/api/room-exists/:roomId", (req, res) => {
  const { roomId } = req.params
  const room = rooms.find(room => room.id === roomId)

  if (room) {
    if (room.connectedUsers.length > 3) {
      return res.send({ roomExists: true, full: true })
    } else {
      return res.send({ roomExists: true, full: false })
    }
  } else {
    return res.send({ roomExists: false })
  }
}
)



const io = require("socket.io")(server,{
  cors: {
    origin: "*",
    methods:["GET","POST"]
  }

})

// 送られてきたsocketを受信
io.on("connection", (socket) => {
  console.log(`user connected ${socket.id}`)
  //  onはデータを受信する処理
  // 第一引数はクライアントサイドで送信されたメソッド名
  // 第二引数は受け取ったデータに応じて処理を実行する
  socket.on("create-new-room", (data) => {
    //新しい部屋を作成する処理
  createNewRoomHandler(data,socket)
  })

  socket.on("join-room", (data) => {
      // 部屋に参加する処理
  joinRoomHandler(data,socket)
  })
  //  部屋から退出する処理
  socket.on("disconnect", () => {
    disconnectHandler(socket)
  })
})

// 新しい部屋を作成する処理
const createNewRoomHandler = (data,socket) => {
  console.log("host is creating room")
  console.log(data)
  const { identity } = data

  // roomIdはランダムな数字で作成
  const roomId = uuidv4()
  console.log(roomId)
  // 新規ユーザーの作成
  const newUser = {
    identity,
    id: uuidv4(),
    socketId: socket.id,
    roomId
  }
   //配列に新しいユーザーを追加する
  connectedUsers = [...connectedUsers, newUser]

  // 新部屋の作成
  const newRoom = {
    id: roomId,
    // connectedUsers: connectedUsers
    connectedUsers: [newUser]
  }
  // socket.ioルームへの参加
  socket.join(roomId)

  rooms = [...rooms, newRoom]

  //  emit to that which created that roomId
  socket.emit("room-id", { roomId })

  socket.emit("room-update",{connectedUsers: newRoom.connectedUsers})

}

const joinRoomHandler = (data,socket) => {
  const { identity, roomId } = data
  const newUser = {
    identity,
    id: uuidv4(),
    socketId: socket.id,
    roomId
  }

  // ルームidを入寮区してユーザーが参加する処理
  const room = rooms.find(room => room.id === roomId)
  room.connectedUsers = [...room.connectedUsers, newUser]

  // socket.idルームに参加する処理

  socket.join(roomId)
  // 新しいuserを参加させる処理
  connectedUsers = [...connectedUsers, newUser]
  // 既にあるデータの更新を送信する処理
  io.to(roomId).emit("room-update",{connectedUsers: room.connectedUsers})

}

const disconnectHandler = (socket) => {
  // 一致するユーザーを検索
  const user = connectedUsers.find((user) => user.socketId === socket.id)

  if (user) {
    const room = rooms.find(room => room.id === user.roomId)
    room.connectedUsers = room.connectedUsers.filter(user => user.socketId !== socket.id)

    socket.leave(user.roomId)


    if (room.connectedUsers.length > 0) {
        io.to(room.id).emit("room-update", {
      connectedUsers: room.connectedUsers
    })
    } else {
      rooms = rooms.filter(r => r.id !== room.id)
    }

  }
}


server.listen(PORT,() => {
  console.log(`server listening on ${PORT}`)
})
