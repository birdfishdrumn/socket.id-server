import { Request,Response } from "express";
const express = require("express")
const http = require("http")
const { v4: uuidv4 } = require("uuid")
const cors = require("cors")
const twilio = require("twilio")


const PORT = process.env.PORT || 5002

const app = express()

type SignalData = {
  signal: any,
  connUserSocketId:string
}

type User = {
   identity:string
    id: string
    socketId:string
    roomId:string
}

type newRoomData = {
   identity:string
}

type JoinRoomData= {
  identity: string
  roomId:string
}

const server = http.createServer(app)

app.use(cors())

let connectedUsers:User[] = []
let rooms:any[] = []

app.get("/api/room-exists/:roomId", (req:Request, res:Response) => {
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
io.on("connection", (socket:any) => {
  console.log(`user connected userId ${socket.id}`)
  //  onはデータを受信する処理
  // 第一引数はクライアントサイドで送信されたメソッド名
  // 第二引数は受け取ったデータに応じて処理を実行する
  socket.on("create-new-room", (data:newRoomData) => {
    //新しい部屋を作成する処理
  createNewRoomHandler(data,socket)
  })

  socket.on("join-room", (data:JoinRoomData) => {
      // 部屋に参加する処理
  joinRoomHandler(data,socket)
  })
  //  部屋から退出する処理
  socket.on("disconnect", () => {
    disconnectHandler(socket)
  })

   socket.on("conn-signal",(data:SignalData) => {
    signalingHandler(data,socket)
   })

     socket.on("conn-init",(data:SignalData) => {
    initializeConnectionHandler(data,socket)
  })
})

// 新しい部屋を作成する処理
const createNewRoomHandler = (data:newRoomData,socket:any) => {
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

const joinRoomHandler = (data:JoinRoomData,socket:any) => {
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
  connectedUsers= [...connectedUsers, newUser]
// 全てのユーザーに対してのpeerConnectionの準備をする処理
  // 一番最初のpeerコネクション接続の処理
  room.connectedUsers.forEach((user: User)=>{
    if (user.socketId !== socket.id) {
      const data = {
        connUserSocketId: socket.id
      }

      io.to(user.socketId).emit("conn-prepare",data)
    }
  })

  // 既にあるデータの更新を送信する処理
  io.to(roomId).emit("room-update",{connectedUsers: room.connectedUsers})

}

const disconnectHandler = (socket:any) => {
  // 一致するユーザーを検索
  const user = connectedUsers.find((user) => user.socketId === socket.id)

  if (user) {
    const room = rooms.find(room => room.id === user.roomId)
    room.connectedUsers = room.connectedUsers.filter((user:User) => user.socketId !== socket.id)

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

const signalingHandler = (data:SignalData, socket:any) => {
  const { connUserSocketId, signal } = data
  console.log("data",data)
  const signalingData:SignalData= { signal, connUserSocketId: socket.id }
  io.to(connUserSocketId).emit("conn-signal",signalingData)
}
//  既に部屋に接続しているという情報
const initializeConnectionHandler = (data:SignalData, socket:any) => {
  const { connUserSocketId } = data
  console.log("user",connUserSocketId)

  const initData = { connUserSocketId: socket.id }
  io.to(connUserSocketId).emit("conn-init",initData)
}


server.listen(PORT,() => {
  console.log(`server listening on ${PORT}`)
})
