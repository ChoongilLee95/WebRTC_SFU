import express from "express";
const http = require("http");
const socketio = require("socket.io");
const cors = require("cors");

const app = express();
// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://13.124.246.86:3000');
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
//   next();
// });
// app.use(cors());
app.use(cors({
  origin: 'http://13.124.246.86:3000',
  credentials: true,
  allowedHeaders:['my-custom-header'],
  methods: ['GET', 'POST','PUT','DELETE','OPTIONS'],
  optionsSuccessStatus:200,
}))

// app.use(cors({
//   origin: 'http://13.124.246.86:3000',
//   credentials: true,
//   methods: ['GET', 'POST','PUT','DELETE','OPTIONS'],
//   optionsSuccessStatus:200,
// }))


// const httpServer = http.createServer(app);
const httpServer = http.createServer(app);
const io = new socketio.Server(httpServer, {
  credentials: true,
  cors: {
    origin: 'http://13.124.246.86:3000',
    credentials: true,
    allowedHeaders:['my-custom-header'],
    methods: ['GET', 'POST','OPTIONS'],
  }
});
//, 'https://b3dd-1-223-174-170.jp.ngrok.io' 'http://13.124.246.86:3000'
// const io = socketio(httpServer, {
//   handlePreflightRequest: (req, res) => {
//       const headers = {
//           "Access-Control-Allow-Headers": "Content-Type, Authorization",
//           "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
//           "Access-Control-Allow-Credentials": true
//       };
//       res.writeHead(200, headers);
//       res.end();
//   }
// });



// ----------------------전-------
// const io = new socketio.Server(httpServer, {
//   // path: "/socket.io",
//   cors: {
//     origin: ['http://13.124.246.86:3000','https://b3dd-1-223-174-170.jp.ngrok.io/','localhost:3000','x-forwarded-for'],
//     credentials: true,
//     allowedHeaders:['my-custom-header','x-forwarded-for','abcd'],
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     optionsSuccessStatus:200,
//   }
// });
// socketio.set('origins', 'http://13.124.246.86:3000')
// const io = new socketio.Server(httpServer, {
//   path: "/socket.io",
//   cors: {
//     origin: '*',
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     optionsSuccessStatus:200,
//   }
// });



//--------------------- webRTC ---------------------
const wrtc = require("wrtc");

const RTC_config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: [
        "stun:13.125.215.89:3478",
        "turn:13.125.215.89:3478?transport=udp",
      ],
      username: "choongil",
      credential: "Lee",
      // iceCandidatePoolSize: 100,
    },
    {
      urls: ["stun:43.201.60.133:3478", "turn:43.201.60.133:3478?transport=udp"],
      username: "choongil",
      credential: "Lee",
      // iceCandidatePoolSize: 100,
    },
  ],
};



// DB에 존재하는 자료형 roomId를 입력하면
// users, IdToSendingconnection, IdToRecevingConnection을 담은 객체 리턴
let roomToUsers = {};

// socketId to roomId
let socketIdToRoomId = {};

// user들의 ID 나열
let users = [];

// ID랑 stream 매칭
let IdToStream = {};

// Id가 키값으로 sendingConnection에 매칭(연결에 직접 매칭)
let IdToSendingConnection = {};


io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    // 새로고침해버리면 socket정보가 유실됨 추가 예외처리를 위해선 존재여부를 단톡 돌려봐야 할ㄷ스
    if (socket.name === undefined) {
      return;
    }
    // 연결이 끊어졌을 때

    // 다른 연결들에 전송되고있는 스트림 제거
    console.log(socket.name + " 나갔어요~");
    let roominfo = roomToUsers[socketIdToRoomId[socket.name]];
    let removingStream = roominfo.IdToStream[socket.name];
    roominfo.users.forEach((Id) => {
      if (Id != socket.name) {
        removingStream.getTracks().forEach((track) => {
          let removingTrackId = track.id;
          let removingSender = roominfo.IdToSendingConnection[
            Id
          ].getSenders().find((s) => {
            return s.track != null && s.track.id === removingTrackId;
          });
          roominfo.IdToSendingConnection[Id].removeTrack(removingSender);
        });
        io.to(Id).emit("someoneLeft", { senderId: socket.name });
      }
    });

    // 연결 끊기
    roominfo.IdToSendingConnection[socket.name].close();

    // 방 내부 데이터에서 제거하기
    roominfo.IdToStream[socket.name] = null;
    roominfo.IdToSender[socket.name] = null;
    roominfo.IdToSendingConnection[socket.name] = null;
    for (let i = 0; i < 5; i++) {
      if (roominfo.users[i] === socket.name) {
        roominfo.users.splice(i, 1);
        break;
      }
    }
  });
  // Room에 입장한 친구를 room에 넣고 sendingConnection의 offer로 연결 시작
  socket.on("joinRoom", async (data) => {
    try {
      console.log("누가 왔어요~");
      socket.name = data.Id;
      socket.join(data.roomId);
      socketIdToRoomId[data.Id] = data.roomId;
      // 이미 존재하는 방이 아니라면
      let roomInfo;
      if (!roomToUsers.hasOwnProperty(data.roomId)) {
        roomInfo = {
          users: [],
          IdToSendingConnection: {},
          IdToStream: {},
          IdToSender: {},
        };
        roomToUsers[data.roomId] = roomInfo;
      } else {
        roomInfo = roomToUsers[data.roomId];
      }

      // sendingConnection 연결 수행
      let newSendingConnection = new wrtc.RTCPeerConnection(RTC_config);
      roomInfo.IdToSendingConnection[data.Id] = newSendingConnection;

      // ---------------- 추가 관리 필요 ---------------------
      // sendingConnection이 연결이 완료되면 발생하는 이벤트 => 다른 애들한테도 보내주기 위한 함수 생성.
      newSendingConnection.addEventListener("track", (connection) => {
        if (roomInfo.IdToStream[data.Id] != 1) {
          // roomInfo.IdToStream[data.Id].push(connection.streams[0]);
          roomInfo.IdToStream[data.Id] = 1;
          return;
        }
        roomInfo.users.push(data.Id);
        console.log("connection for" + data.Id + "is finished");
        roomInfo.IdToStream[data.Id] = connection.streams[0];

        roomInfo.users.forEach((Id) => {
          if (Id != data.Id) {
            //-------------------------- 새로운 피어의 연결이 완료되었을 떄 무엇을 할 것인가------

            // 기존에 있던 사람들에게 새로온 사람의 streamId와 userId를 제공
            io.to(Id).emit("makeNewPeer", {
              senderId: data.Id,
              streamId: connection.streams[0].id,
            });

            // 새로온 사람에게 기존에 있던 사람들의 streamId와 userId르 제공
            io.to(data.Id).emit("makeNewPeer", {
              senderId: Id,
              streamId: roomInfo.IdToStream[Id].id,
            });
          }
        });
      });
      await newSendingConnection.setRemoteDescription(data.sendingOffer);
      let answer = await newSendingConnection.createAnswer();
      await newSendingConnection.setLocalDescription(answer);

      // 서버가 negotiation이 필요할 때

      newSendingConnection.addEventListener(
        "negotiationneeded",
        async (unused) => {
          try {
            console.log("negotiation occur");
            let newOffer = await newSendingConnection.createOffer();
            await newSendingConnection.setLocalDescription(newOffer);
            io.to(data.Id).emit("handleNegotiation", { offer: newOffer });
          } catch (e) {
            console.log(e);
          }
        }
      );

      // 연결의 상태가 변화하였을 때 연결을 close하는 이벤트 리스너
      newSendingConnection.addEventListener(
        "connectionstatechange",
        (unused) => {
          switch (newSendingConnection.connectionState) {
            case "disconnected":
              console.log(
                "connectionstatechange 감지!!!!" + data.Id + " 나갔어요~~~~~"
              );
              // 다른 peer들에게 연결된 stream을 제거
              let removingStream = roomToUsers[data.roomId].IdToStream[data.Id];
              roomToUsers[data.roomId].users.forEach((Id) => {
                if (Id != data.Id) {
                  removingStream.getTracks().forEach((track) => {
                    let removingTrackId = track.id;
                    let removingSender = roomToUsers[
                      data.roomId
                    ].IdToSendingConnection[Id].getSenders().find((s) => {
                      return s.track != null && s.track.id === removingTrackId;
                    });
                    roomToUsers[data.roomId].IdToSendingConnection[
                      Id
                    ].removeTrack(removingSender);
                  });
                }
              });
              newSendingConnection.close();

              roomToUsers[data.roomId].IdToStream[data.Id] = null;
              break;
            case "closed":
              console.log("connection closed");
              break;

            default:
              return;
          }
        }
      );

      //
      io.to(data.Id).emit("welcome", answer);
      // icecandidate 생겨서 이벤트 발생하면 연결에 해당하는 사람에게 ice 보냄
      newSendingConnection.addEventListener("icecandidate", (e) => {
        if (e.candidate != null) {
          io.to(data.Id).emit("iceForSending", {
            ice: e.candidate,
          });
        }
      });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("readyForGettingStream", (data) => {
    let receivingConnection =
      roomToUsers[data.roomId].IdToSendingConnection[data.receiverId];
    let sendingStream = roomToUsers[data.roomId].IdToStream[data.senderId];
    sendingStream.getTracks().forEach((track) => {
      receivingConnection.addTrack(track, sendingStream);
    });
  });

  socket.on("iceForSending", async (data) => {
    try {
      if (
        roomToUsers[data.roomId].IdToSendingConnection.hasOwnProperty(
          data.Id
        ) &&
        roomToUsers[data.roomId].IdToSendingConnection[data.Id]
          .remoteDescription != null
      ) {
        roomToUsers[data.roomId].IdToSendingConnection[data.Id].addIceCandidate(
          data.ice
        );
      }
    } catch (e) {
      console.log(e);
    }
  });

  // 클라이언트로부터 온 네고 offer
  socket.on("handleNegotiation", async (data) => {
    try {
      let handlingConnection =
        roomToUsers[data.roomId].IdToSendingConnection[data.receiverId];
      if (!handlingConnection) {
        return;
      }
      handlingConnection.setRemoteDescription(data.offer);
      let answer = await handlingConnection.createAnswer();
      await handlingConnection.setLocalDescription(answer);
      io.to(data.receiverId).emit("answerForNegotiation", { answer });
    } catch (e) {
      console.log(e);
    }
  });

  // 클라이언트로부터 온 nogo answer
  socket.on("answerForNegotiation", async (data) => {
    try {
      let handlingConnection =
        roomToUsers[data.roomId].IdToSendingConnection[data.receiverId];
      if (handlingConnection === null) {
        return;
      }
      handlingConnection.setRemoteDescription(data.answer);
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("reconnectOffer", async (data) => {
    try {
      let newSendingConnection = new wrtc.RTCPeerConnection(RTC_config);
      roomToUsers[data.roomId].IdToSendingConnection[data.Id] =
        newSendingConnection;
      newSendingConnection.addEventListener(
        "negotiationneeded",
        async (unused) => {
          try {
            let newOffer = await newSendingConnection.createOffer();
            await newSendingConnection.setLocalDescription(newOffer);
            io.to(data.Id).emit("handleNegotiation", { offer: newOffer });
          } catch (e) {
            console.log(e);
          }
        }
      );

      // 연결의 상태가 변화하였을 때 연결을 close하는 이벤트 리스너
      newSendingConnection.addEventListener(
        "connectionstatechange",
        (unused) => {
          switch (newSendingConnection.connectionState) {
            case "disconnected":
              console.log(
                "connectionstatechange 감지!!!!" + data.Id + " 나갔어요~~~~~"
              );
              let removingStream = roomToUsers[data.roomId].IdToStream[data.Id];
              roomToUsers[data.roomId].users.forEach((Id) => {
                if (Id != data.Id) {
                  removingStream.getTracks().forEach((track) => {
                    let removingTrackId = track.id;
                    let removingSender = roomToUsers[
                      data.roomId
                    ].IdToSendingConnection[Id].getSenders().find((s) => {
                      return s.track != null && s.track.id === removingTrackId;
                    });
                    roomToUsers[data.roomId].IdToSendingConnection[
                      Id
                    ].removeTrack(removingSender);
                  });
                }
              });

              newSendingConnection.close();
              roomToUsers[data.roomId].IdToStream[data.Id] = null;
              break;
            case "closed":
              console.log("connection closed");
              break;
            default:
              return;
          }
        }
      );
      newSendingConnection.addEventListener("track", (connection) => {
        if (roomToUsers[data.roomId].IdToStream[data.Id] != 1) {
          roomToUsers[data.roomId].IdToStream[data.Id] = 1;
          return;
        }
        roomInfo.users.push(data.Id);
        let roomInfo = roomToUsers[data.roomId];
        let newStream = connection.streams[0];
        roomInfo.IdToStream[data.Id] = newStream;
        roomInfo.users.forEach((Id) => {
          if (Id != data.Id) {
            io.to(Id).emit("someoneReconnected", {
              senderId: data.Id,
              streamId: newStream.id,
            });
            roomInfo.IdToStream[Id].getTracks().forEach((track) => {
              newSendingConnection.addTrack(track, roomInfo.IdToStream[Id]);
            });
          }
        });
        console.log("reconnection for" + data.Id + "is finished");
      });

      await newSendingConnection.setRemoteDescription(data.sendingOffer);
      let answer = await newSendingConnection.createAnswer();
      await newSendingConnection.setLocalDescription(answer);
    } catch (e) {
      console.log(e);
    }
  });
});

// io.listen(3000);
httpServer.listen(3000, () => {
  console.log("port 3000 listen");
});
