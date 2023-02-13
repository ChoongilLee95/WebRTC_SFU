import express from "express";
import http from "http";
import socketio from "socket.io";
let cors = require("cors");

const app = express();
const httpServer = http.createServer(app);
app.use(cors());

//--------------------------------
// const https = require("https");
// const fs = require("fs");
// const options = {
//   key: fs.readFileSync("../localhost-key.pem"),
//   cert: fs.readFileSync("../localhost.pem"),
// };
// https
//   .createServer(options, function (req, res) {
//     // server code
//   })
//   .listen({ PORT });

//--------------------- webRTC ---------------------
const wrtc = require("wrtc");

const RTC_config = {
  iceServers: [
    // {
    //   urls: 'stun:[STUN_IP]:[PORT]',
    //   'credentials': '[YOR CREDENTIALS]',
    //   'username': '[USERNAME]'
    // },
    {
      urls: "stun:stun.l.google.com:19302",
    },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: [
        "stun:13.125.11.187:3478",
        "turn:13.125.11.187:3478?transport=udp",
      ],
      username: "choongil",
      credential: "Lee",
      // iceCandidatePoolSize: 100,
    },
    {
      urls: ["stun:3.38.151.56", "turn:3.38.151.56:3478?transport=udp"],
      username: "choongil",
      credential: "Lee",
      // iceCandidatePoolSize: 100,
    },
    // {
    //   urls: "turn:13.125.11.187:3478?transport=udp",

    //   username: "choongil",
    //   credential: "Lee",
    //   // iceCandidatePoolSize: 10,
    // },
    // { urls: "stun:stun01.sipphone.com" },
    // { urls: "stun:stun.ekiga.net" },
    // { urls: "stun:stun.fwdnet.net" },
    // { urls: "stun:stun.ideasip.com" },
    // { urls: "stun:stun.iptel.org" },
    // { urls: "stun:stun.rixtelecom.se" },
    // { urls: "stun:stun.schlund.de" },
    // { urls: "stun:stunserver.org" },
    // { urls: "stun:stun.softjoys.com" },
    // { urls: "stun:stun.voiparound.com" },
    // { urls: "stun:stun.voipbuster.com" },
    // { urls: "stun:stun.voipstunt.com" },
    // { urls: "stun:stun.voxgratia.org" },
    // { urls: "stun:stun.xten.com" },
  ],
};
// const RTC_config = {
//   iceServers: [
//     // {
//     //   urls: 'stun:[STUN_IP]:[PORT]',
//     //   'credentials': '[YOR CREDENTIALS]',
//     //   'username': '[USERNAME]'
//     // },
//     {
//       urls: [
//         "stun:stun.l.google.com:19302",
//         "stun:stun2.l.google.com:19302",
//         "stun:stun3.l.google.com:19302",
//         "stun:stun4.l.google.com:19302",
//         "stun:stun01.sipphone.com",
//         "stun:stun.ekiga.net",
//         "stun:stun.fwdnet.net",
//         "stun:stun.ideasip.com",
//         "stun:stun.iptel.org",
//         "stun:stun.rixtelecom.se",
//         "stun:stun.schlund.de",
//         "stun:stunserver.org",
//         "stun:stun.softjoys.com",
//         "stun:stun.voiparound.com",
//         "stun:stun.voipbuster.com",
//         "stun:stun.voipstunt.com",
//         "stun:stun.voxgratia.org",
//         "stun:stun.xten.com",
//       ],
//       iceCandidatePoolSize: 10,
//     },
//   ],
// };

// const pc = new wrtc.RTCPeerConnection(pc_config);
/////////////////////////////////////////////////////////////

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/2", (req, res) => res.render("home"));

app.get("/*", (req, res) => res.redirect("/"));
const handleListen = () => console.log("server start port 3000");
// httpServer.listen(3000, handleListen);

// DB에 존재하는 자료형 roomId를 입력하면
// users, IdToSendingconnection, IdToRecevingConnection을 담은 객체 리턴
let roomToUsers = {};

// user들의 ID 나열
let users = [];

// ID랑 stream 매칭
let IdToStream = {};

// Id가 키값으로 sendingConnection에 매칭(연결에 직접 매칭)
let IdToSendingConnection = {};

// Id가 키값으로 sendingConnection들에 매칭(매칭되는 리스트 존재)
let IdToReceivingConnection = {};

const isIncluded = (array, id) => array.some((item) => item.id === id);

const io = socketio(httpServer);
io.on("connection", (socket) => {
  // Room에 입장한 친구를 room에 넣고 sendingConnection의 offer로 연결 시작
  socket.on("joinRoom", async (data) => {
    try {
      console.log(1);
      socket.to(data.roomId).emit("makeNewPeer", { senderId: data.Id });
      socket.join(data.roomId);

      // 이미 존재하는 방이 아니라면
      let roomInfo;
      if (!roomToUsers.hasOwnProperty(data.roomId)) {
        console.log(123123123);
        roomInfo = {
          users: [data.Id],
          IdToSendingConnection: {},
          IdToReceivingConnection: {},
          IdToStream: {},
        };
        roomToUsers[data.roomId] = roomInfo;
      } else {
        console.log(2);
        roomInfo = roomToUsers[data.roomId];
        roomInfo.users.push(data.Id);
      }
      console.log(2);
      // 기존에 있ㄷ던 사람들한테 연결
      roomInfo.users.forEach(async (Id) => {
        try {
          if (Id === data.Id) {
            return;
          }
          io.to(data.Id).emit("makeNewPeer", { senderId: Id });

          let newReceivingConnection = new wrtc.RTCPeerConnection(RTC_config);

          newReceivingConnection.addEventListener(
            "negotiationneeded",
            async () => {
              try {
                let newReceivingOffer =
                  await newReceivingConnection.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false,
                  });
                await newReceivingConnection.setLocalDescription(
                  newReceivingOffer
                );
                io.to(data.Id).emit("offerForReceiving", {
                  offer: newReceivingOffer,
                  senderId: Id,
                });
              } catch (e) {
                console.log(e);
              }
            }
          );
          // // iceForReceiving 연결하기
          // socket.on("iceForReceiving", async (t) => {
          //   try {
          //     if (
          //       newReceivingConnection.remoteDescription != null &&
          //       t.ice != null
          //     ) {
          //       await newReceivingConnection.addIceCandidate(t.ice);
          //     }
          //   } catch (e) {
          //     console.log(e);
          //   }
          // });

          // 연결을 receiverId에 등록
          if (roomInfo.IdToReceivingConnection[data.Id] === undefined) {
            roomInfo.IdToReceivingConnection[data.Id] = {};
          }
          roomInfo.IdToReceivingConnection[data.Id][Id] =
            newReceivingConnection;

          // 연결에 트랙 연결
          console.log("트랙연결할께요~!~!");
          roomInfo.IdToStream[Id].getTracks().forEach((track) => {
            newReceivingConnection.addTrack(track, roomInfo.IdToStream[Id]);
          });
          // roomInfo.IdToStream[data.Id].forEach((d) => {
          //   newReceivingConnection.addTrack(d.track);
          // });

          // icecandidate 이벤트 리스너 설정
          newReceivingConnection.addEventListener("icecandidate", (d) => {
            console.log("ice for receiving이 오긴 하네요");
            io.to(data.Id).emit("iceForReceiving", {
              ice: d.candidate,
              senderId: Id,
            });
          });
          console.log("offer 보내라고!");

          // offer 생성
          const receivingOffer = await newReceivingConnection.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
          });
          await newReceivingConnection.setLocalDescription(receivingOffer);
          io.to(data.Id).emit("offerForReceiving", {
            offer: receivingOffer,
            senderId: Id,
          });
        } catch (e) {
          console.log(e);
        }
      });

      // sendingConnection 연결 수행
      let newSendingConnection = new wrtc.RTCPeerConnection(RTC_config);

      console.log(3);
      // ---------------- 추가 관리 필요 ---------------------
      // sendingConnection이 연결이 완료되면 발생하는 이벤트 => 다른 애들한테도 보내주기 위한 함수 생성.
      newSendingConnection.addEventListener("track", (connection) => {
        if (!roomInfo.IdToStream.hasOwnProperty(data.Id)) {
          // roomInfo.IdToStream[data.Id].push(connection.streams[0]);
          roomInfo.IdToStream[data.Id] = 1;
          return;
        }
        console.log("sending 연결 완료");
        roomInfo.IdToStream[data.Id] = connection.streams[0];

        roomInfo.users.forEach(async (Id) => {
          try {
            if (Id != data.Id) {
              // let newOffer = makeReceiveConnections(Id, data.Id, roomInfo);
              //--------------------------------------------------------------
              // 연결 생성
              let newReceivingConnection = new wrtc.RTCPeerConnection(
                RTC_config
              );

              newReceivingConnection.addEventListener(
                "negotiationneeded",
                async () => {
                  try {
                    let newReceivingOffer =
                      await newReceivingConnection.createOffer({
                        offerToReceiveAudio: false,
                        offerToReceiveVideo: false,
                      });
                    await newReceivingConnection.setLocalDescription(
                      newReceivingOffer
                    );
                    io.to(Id).emit("offerForReceiving", {
                      offer: newReceivingOffer,
                      senderId: data.Id,
                    });
                  } catch (e) {
                    console.log(e);
                  }
                }
              );

              // // iceForReceiving 연결하기
              // socket.on("iceForReceiving", async (t) => {
              //   try {
              //     if (
              //       newReceivingConnection.remoteDescription != null &&
              //       t.ice != null
              //     ) {
              //       await newReceivingConnection.addIceCandidate(t.ice);
              //     }
              //   } catch (e) {
              //     console.log(e);
              //   }
              // });

              // 연결을 receiverId에 등록
              if (roomInfo.IdToReceivingConnection[Id] === undefined) {
                roomInfo.IdToReceivingConnection[Id] = {};
              }
              roomInfo.IdToReceivingConnection[Id][data.Id] =
                newReceivingConnection;

              // 연결에 트랙 연결
              console.log("트랙연결할께요~!~!");
              roomInfo.IdToStream[data.Id].getTracks().forEach((track) => {
                newReceivingConnection.addTrack(
                  track,
                  roomInfo.IdToStream[data.Id]
                );
              });
              // roomInfo.IdToStream[data.Id].forEach((d) => {
              //   newReceivingConnection.addTrack(d.track);
              // });
              // icecandidate 이벤트 리스너 설정
              newReceivingConnection.onicecandidate = (d) => {
                console.log("ice for candidate가 오긴 하네요");
                // setTimeout(() => {
                //   io.to(Id).emit("iceForReceiving", {
                //     ice: d.candidate,
                //     senderId: data.Id,
                //   });
                // }, 5000);
                io.to(Id).emit("iceForReceiving", {
                  ice: d.candidate,
                  senderId: data.Id,
                });
              };

              // offer 생성
              const receivingOffer = await newReceivingConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
              });
              await newReceivingConnection.setLocalDescription(receivingOffer);
              console.log("여기요~~~~");
              io.to(Id).emit("offerForReceiving", {
                offer: receivingOffer,
                senderId: data.Id,
              });
            }
          } catch (e) {
            console.log(e);
          }
        });
      });
      // console.log(data, 11111111111111111111111);
      console.log(data.sendingOffer);
      await newSendingConnection.setRemoteDescription(data.sendingOffer);
      console.log(4);
      let answer = await newSendingConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      console.log(5);
      await newSendingConnection.setLocalDescription(answer);
      roomInfo.IdToSendingConnection[data.Id] = newSendingConnection;

      // --------------------
      // console.log(roomInfo.IdToSendingConnection[data.Id], 1111111111111);
      io.to(data.Id).emit("welcome", answer);
      // icecandidate 생겨서 이벤트 발생하면 연결에 해당하는 사람에게 ice 보냄
      newSendingConnection.addEventListener("icecandidate", (e) => {
        if (e.candidate != null) {
          io.to(data.Id).emit("iceForSending", {
            senderId: data.id,
            ice: e.candidate,
          });
          console.log("sending ice 보내줬어");
        }
      });
    } catch (error) {
      console.log(error);
    }
  });
  // iceForReceiving 연결하기
  socket.on("iceForReceiving", async (t) => {
    try {
      if (
        roomToUsers[t.roomId].IdToReceivingConnection[t.receiverId] &&
        roomToUsers[t.roomId].IdToReceivingConnection[t.receiverId][
          t.senderId
        ] &&
        roomToUsers[t.roomId].IdToReceivingConnection[t.receiverId][t.senderId]
          .remoteDescription != null &&
        t.ice != null
      ) {
        await roomToUsers[t.roomId].IdToReceivingConnection[t.receiverId][
          t.senderId
        ].addIceCandidate(t.ice);
      }
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("iceForSending", async (data) => {
    try {
      console.log("sending ice 받았어요~");
      if (
        roomToUsers[data.roomId].IdToSendingConnection.hasOwnProperty(data.Id)
      ) {
        console.log(data, 222222222);
        roomToUsers[data.roomId].IdToSendingConnection[data.Id].addIceCandidate(
          data.ice
        );
      }
    } catch (e) {
      console.log(e);
    }
  });
  socket.on("answerForReceiving", async (data) => {
    try {
      // connection 찾기
      roomToUsers[data.roomId].IdToReceivingConnection[data.receiverId][
        data.senderId
      ].setRemoteDescription(data.answer);
    } catch (e) {
      console.log(e);
    }
  });
  // iceForReceiving 연결하기
  // socket.on("iceForReceiving", async (data) => {
  //   try {
  //     if (
  //       roomToUsers[data.roomId].IdToReceivingConnection.hasOwnProperty(
  //         data.receiverId
  //       )
  //     ) {
  //       let i = 0;
  //       let target_list =
  //         roomToUsers[data.roomId].IdToReceivingConnection[data.receiverId];
  //       let len_list = target_list.length;
  //       while (i < len_list) {
  //         if (target_list.senderId === data.senderId) {
  //           console.log("receiving ice 받았어요");
  //           target_list.connection.addIceCandidate(data.ice);
  //           break;
  //         }
  //         i++;
  //       }
  //     }
  //   } catch (e) {
  //     console.log(e);
  //   }
  // });
  // ---------------------------미작업경계------------------------------------
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("quit", (roomName, id) => {
    socket.to(roomName).emit("quit", id);
  });
});

// ------------------receive connection 만들기 -------------------
// async function makeReceiveConnections(receiverId, senderId, roomInfo) {
//   // 연결 생성
//   let newReceivingConnection = new wrtc.RTCPeerConnection(RTC_config);

//   // 연결에 트랙 연결
//   roomInfo.IdToStream[senderId].getTracks().forEach((track) => {
//     newReceivingConnection.addTrack(track, roomInfo.IdToStream[senderId]);
//   });
//   // icecandidate 이벤트 리스너 설정
//   newReceivingConnection.addEventListener("icecandidate", (data) => {
//     socket
//       .to(receiverId)
//       .emit("iceForReceiving", { ice: data.candidate, senderId });
//   });
//   // offer 생성
//   const receivingOffer = await newReceivingConnection.createOffer({
//     offerToReceiveAudio: false,
//     offerToReceiveVideo: false,
//   });
//   newReceivingConnection.setLocalDescription(receivingOffer);
//   // 연결을 receiverId에 등록
//   if (roomInfo.IdToReceivingConnection[receiverId] === undefined) {
//     roomInfo.IdToReceivingConnection[receiverId] = [
//       {
//         senderId,
//         connection: newReceivingConnection,
//       },
//     ];
//   } else {
//     roomInfo.IdToReceivingConnection[receiverId].push({
//       senderId,
//       connection: newReceivingConnection,
//     });
//   }

//   return receivingOffer;
// }
// -------------------------------------------
// function handleIce(data) {
//   console.log("got ice candidate and sent it");
//   socket.emit("ice", data.candidate, roomId, socket.Id);
//   //   console.log(data);
// }

httpServer.listen(3000, handleListen);
