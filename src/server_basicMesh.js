import express from "express";
import http from "http";
import socketIO from "socket.io";

const app = express();

////////////////////////////////////////////////////////
const wrtc = require("wrtc");

const pc_config = {
  iceServers: [
    // {
    //   urls: 'stun:[STUN_IP]:[PORT]',
    //   'credentials': '[YOR CREDENTIALS]',
    //   'username': '[USERNAME]'
    // },
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const pc = new wrtc.RTCPeerConnection(pc_config);
/////////////////////////////////////////////////////////////

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/2", (req, res) => res.render("home"));

app.get("/*", (req, res) => res.redirect("/"));
const handleListen = () => console.log("server start port 3000");
// httpServer.listen(3000, handleListen);

let rooms = {};

const httpServer = http.createServer(app);
const io = socketIO(httpServer);
io.on("connection", (socket) => {
  socket.on("joinRoom", (roomName, id) => {
    socket.join(roomName);
    if (typeof rooms[roomName] === "undefined") {
      rooms[roomName] = [id];
    } else {
      rooms[roomName].push(id);
    }
    console.log(id);
    // 어떻게 여기서 실행되는데 클라이언트에 반영되는거지?
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName, Id) => {
    console.log(Id);
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("quit", (roomName, id) => {
    socket.to(roomName).emit("quit", id);
  });
});
httpServer.listen(3000, handleListen);
