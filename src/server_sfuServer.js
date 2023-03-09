import express from "express";
const http = require("http");
const socketio = require("socket.io");
const cors = require("cors");

const app = express();

const httpServer = http.createServer(app);
const io = new socketio.Server(httpServer, {
  path: "/sfusocket",
  credentials: true,
  cors: {
    origin: "https://onem1nutemem0ry.store",
    credentials: true,
    allowedHeaders: ["my-custom-header"],
    methods: ["GET", "POST", "OPTIONS"],
  },
});

//--------------------- webRTC ---------------------
const wrtc = require("wrtc");

const RTC_config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: [
        "stun:13.124.84.195:3478",
        "turn:13.124.84.195:3478?transport=udp",
      ],
      username: "choongil",
      credential: "Lee",
    },
    {
      urls: [
        "stun:43.201.148.88:3478",
        "turn:43.201.148.88:3478?transport=udp",
      ],
      username: "choongil",
      credential: "Lee",
    },
  ],
};

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
    try {
      // 새로고침해버리면 socket정보가 유실됨 추가 예외처리를 위해선 존재여부를 단톡 돌려봐야 할ㄷ스
      if (socket.name === undefined) {
        return;
      }
      // 연결이 끊어졌을 때
      // 다른 연결들에 전송되고있는 스트림 제거
      console.log(socket.name + " 나갔어요~");
      let roominfo = roomToUsers[socketIdToRoomId[socket.name]];
      if (roominfo === undefined) {
        return;
      }
      let removingStream = roominfo.IdToStream[socket.name];

      for (let i = 0; i < roominfo.users.length; i++) {
        if (roominfo.users[i] === socket.name) {
          roominfo.users.splice(i, 1);
          i--;
        }
      }
      if (removingStream) {
        roominfo.IdToStream[socket.name] = null;
        roominfo.users.forEach((Id) => {
          io.to(roominfo.IdToRTCId[Id]).emit("someoneLeft", {
            senderId: socket.name,
          });
          removingStream.getTracks().forEach((track) => {
            try {
              let removingTrackId = track.id;
              console.log(removingTrackId);
              let removingSender = roominfo.IdToSendingConnection[
                Id
              ].getSenders().find((s) => {
                return s.track != null && s.track.id === removingTrackId;
              });
              console.log("기존 연결에 트랙을 제거합니다");
              if (roominfo.IdToSendingConnection[Id] && removingSender) {
                roominfo.IdToSendingConnection[Id].removeTrack(removingSender);
              }
            } catch (e) {
              console.log(e);
            }
          });
        });
      }
      // 연결 끊기
      roominfo.IdToSendingConnection[socket.name] = null;
      // 방 내부 데이터에서 제거하기
      roominfo.IdToSender[socket.name] = null;
      roominfo.IdToSendingConnection[socket.name] = null;
    } catch (e) {
      console.log(e);
    }
  });
  // Room에 입장한 친구를 room에 넣고 sendingConnection의 offer로 연결 시작
  socket.on("joinRoom", async (data) => {
    try {
      console.log("누가 왔어요~");
      console.log(data.roomId);
      socket.name = data.Id;
      socketIdToRoomId[data.Id] = data.roomId;
      // 이미 존재하는 방이 아니라면
      let roomInfo;
      if (!roomToUsers.hasOwnProperty(data.roomId)) {
        roomInfo = {
          users: [],
          IdToSendingConnection: {},
          IdToStream: {},
          IdToSender: {},
          IdToRTCId: {},
        };
        roomToUsers[data.roomId] = roomInfo;
      } else {
        roomInfo = roomToUsers[data.roomId];
      }
      // if (roomInfo.users.length >= 5) {
      //   console.log(data.Id + " 가 방이 꽉차서 나갔습니다");
      //   return;
      // }
      socket.join(data.roomId);
      // sendingConnection 연결 수행
      let newSendingConnection = new wrtc.RTCPeerConnection(RTC_config);
      roomInfo.IdToSendingConnection[data.Id] = newSendingConnection;
      // sendingConnection이 연결이 완료되면 발생하는 이벤트 => 다른 애들한테도 보내주기 위한 함수 생성.
      newSendingConnection.addEventListener("track", (connection) => {
        if (roomInfo.IdToStream[data.Id] != 1) {
          roomInfo.IdToStream[data.Id] = 1;
          return;
        }
        console.log(connection.streams[0].getTracks());
        roomInfo.users.push(data.Id);
        roomInfo.IdToRTCId[data.Id] = data.RTCId;
        console.log("connection for" + data.Id + " is finished");
        roomInfo.IdToStream[data.Id] = connection.streams[0];

        roomInfo.users.forEach((Id) => {
          // 새로운 사람의 stream을받을 준비하라고 client에게 전달
          if (Id != data.Id) {
            // 기존에 있던 사람들에게 새로온 사람의 streamId와 userId를 제공
            io.to(roomInfo.IdToRTCId[Id]).emit("makeNewPeer", {
              senderId: data.Id,
              streamId: connection.streams[0].id,
            });

            // 새로온 사람에게 기존에 있던 사람들의 streamId와 userId르 제공
            io.to(roomInfo.IdToRTCId[data.Id]).emit("makeNewPeer", {
              senderId: Id,
              streamId: roomInfo.IdToStream[Id].id,
            });
          }
        });
      });
      // SDP client의 SDP를 등록
      await newSendingConnection.setRemoteDescription(data.sendingOffer);
      // 클라이언트에게 주기 위한 서버의 connection SDP를 생성 및 전달
      let answer = await newSendingConnection.createAnswer();
      await newSendingConnection.setLocalDescription(answer);

      // 서버가 negotiation이 필요할 때 발생하는 협상 이벤트 : 상대방에게 보내는 stream에서 트랙을 제거하거나 추가할 때 발생
      newSendingConnection.addEventListener(
        "negotiationneeded",
        async (unused) => {
          try {
            console.log("negotiation occur");
            let newOffer = await newSendingConnection.createOffer();
            await newSendingConnection.setLocalDescription(newOffer);
            io.to(roomInfo.IdToRTCId[data.Id]).emit("handleNegotiation", {
              offer: newOffer,
            });
          } catch (e) {
            console.log(e);
          }
        }
      );

      // 연결의 상태가 변화하였을 때 연결을 close하는 이벤트 리스너 disconnected, closed에 대한 처리
      newSendingConnection.addEventListener(
        "connectionstatechange",
        (unused) => {
          try {
            let removingStream;
            switch (newSendingConnection.connectionState) {
              case "disconnected":
                // 다른 peer들에게 연결된 stream을 제거
                removingStream = roomToUsers[data.roomId].IdToStream[data.Id];
                if (removingStream) {
                  roomInfo.IdToStream[data.Id] = null;
                  for (let i = 0; i < roomInfo.users.length; i++) {
                    if (roomInfo.users[i] === socket.name) {
                      roomInfo.users.splice(i, 1);
                      i--;
                    }
                  }
                  roomInfo.users.forEach((Id) => {
                    // 다른사람들에게 나간 사람의 socketid를 전달
                    io.to(roomInfo.IdToRTCId[Id]).emit("someoneLeft", {
                      senderId: data.Id,
                    });
                    removingStream.getTracks().forEach((track) => {
                      let removingTrackId = track.id;
                      console.log(removingTrackId);
                      let removingSender = roomInfo.IdToSendingConnection[
                        Id
                      ].getSenders().find((s) => {
                        return (
                          s.track != null && s.track.id === removingTrackId
                        );
                      });
                      // 트랙을 제거
                      if (roomInfo.IdToSendingConnection[Id]) {
                        roomInfo.IdToSendingConnection[Id].removeTrack(
                          removingSender
                        );
                      }
                    });
                  });
                }
                // 연결이 끊긴 사람에 대한 자료형 초기화
                roomInfo.IdToSender[data.Id] = null;
                roomInfo.IdToSendingConnection[data.Id] = null;
                newSendingConnection.close();
                break;
              case "closed":
                // 다른 peer들에게 연결된 stream을 제거
                removingStream = roomInfo.IdToStream[data.Id];
                if (removingStream) {
                  roomInfo.IdToStream[data.Id] = null;
                  for (let i = 0; i < roomInfo.users.length; i++) {
                    if (roomInfo.users[i] === socket.name) {
                      roomInfo.users.splice(i, 1);
                      i--;
                    }
                  }
                  roomInfo.users.forEach((Id) => {
                    // 다른사람들에게 나간 사람의 socketid를 전달
                    io.to(roomInfo.IdToRTCId[Id]).emit("someoneLeft", {
                      senderId: data.Id,
                    });
                    removingStream.getTracks().forEach((track) => {
                      let removingTrackId = track.id;
                      console.log(removingTrackId);
                      let removingSender = roomInfo.IdToSendingConnection[
                        Id
                      ].getSenders().find((s) => {
                        return (
                          s.track != null && s.track.id === removingTrackId
                        );
                      });
                      // 기존 연결들에서 트랙을 제거
                      if (roomInfo.IdToSendingConnection[Id]) {
                        roomInfo.IdToSendingConnection[Id].removeTrack(
                          removingSender
                        );
                      }
                    });
                  });
                }
                // 연결이 끊긴 사람에 대한 자료형 초기화
                roomInfo.IdToSender[data.Id] = null;
                roomInfo.IdToSendingConnection[data.Id] = null;
                newSendingConnection.close();
                break;
              default:
                return;
            }
          } catch (e) {
            console.log(e);
          }
        }
      );
      // 들어온 사람에게 서버의 SDP를 전달
      io.to(roomToUsers[data.roomId].IdToRTCId[data.Id]).emit(
        "welcome",
        answer
      );
      // icecandidate 생겨서 이벤트 발생하면 연결에 해당하는 사람에게 ice 보냄
      newSendingConnection.addEventListener("icecandidate", (e) => {
        if (e.candidate != null) {
          io.to(roomToUsers[data.roomId].IdToRTCId[data.Id]).emit(
            "iceForSending",
            {
              ice: e.candidate,
            }
          );
        }
      });
    } catch (error) {
      console.log(error);
    }
  });
  // 클라이언트가 video 태그와 스트림 id를 매핑하여 새로운 스트림을 받을 준비가 끝났을 때 보내는 소캣
  socket.on("readyForGettingStream", (data) => {
    try {
      let receivingConnection =
        roomToUsers[data.roomId].IdToSendingConnection[data.receiverId];
      let sendingStream = roomToUsers[data.roomId].IdToStream[data.senderId];
      sendingStream.getTracks().forEach((track) => {
        // 여기 수정 필요
        let removeSender = receivingConnection.getSenders().find((s) => {
          return s.track != null && s.track.id === track.id;
        });
        if (receivingConnection && removeSender) {
          receivingConnection.removeTrack(removeSender);
        }
        receivingConnection.addTrack(track, sendingStream);
      });
    } catch (e) {
      console.log(e);
    }
  });
  // 클라리언트가 자신의 ICE candidate를 받아 서버로 보내는 socket
  socket.on("iceForSending", async (data) => {
    try {
      if (
        roomToUsers[data.roomId].IdToSendingConnection &&
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

  // 클라이언트가 보낸 협상요청 : 클라이언트의 SDP가 담겨있다.
  socket.on("handleNegotiation", async (data) => {
    try {
      let handlingConnection =
        roomToUsers[data.roomId].IdToSendingConnection[data.receiverId];
      if (!handlingConnection) {
        return;
      }
      if (handlingConnection) {
        handlingConnection.setRemoteDescription(data.offer);
        let answer = await handlingConnection.createAnswer();
        await handlingConnection.setLocalDescription(answer);
        io.to(roomToUsers[data.roomId].IdToRTCId[data.receiverId]).emit(
          "answerForNegotiation",
          { answer }
        );
      }
    } catch (e) {
      console.log(e);
    }
  });

  // 클라이언트로부터 온 협상 답변 : 클라이언트의 SDP가 담겨 있다.
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
});

httpServer.listen(3000, () => {
  console.log("port 3000 listen");
});
