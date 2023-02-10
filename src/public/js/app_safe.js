// alert("hi");

const id = 2;

const socket = io();

const myFace = document.getElementById("myFace");

let myStream;
let mute = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras");
const quitBtn = document.getElementById("quit");

const welcome = document.getElementById("welcome");
const call = document.getElementById("call");

const peersVideo = document.getElementById("peersFace1");

call.hidden = true;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((devices) => devices.kind === "videoinput");
    // 지금 진행중인 비디오 트랙에 대한 정보를 확인할 수 있는 함수
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      cameraSelect.appendChild(option);
    });
  } catch (e) {}
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    // 유저의 유저미디어의 stream을 주는 api
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    // console.log(deviceId);
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

// 모든걸 시작하는 함수
// getMedia();

function handleMuteBtn() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!mute) {
    muteBtn.innerText = "Unmute";
    mute = true;
  } else {
    muteBtn.innerText = "Mute";
    mute = false;
  }
}
function handleCameraBtn() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "camera OFF";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "camera ON";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(cameraSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

function handleQuit() {
  socket.emit("quit", roomName, id);
  window.location.reload();
}

quitBtn.addEventListener("click", handleQuit);
muteBtn.addEventListener("click", handleMuteBtn);
cameraBtn.addEventListener("click", handleCameraBtn);
cameraSelect.addEventListener("input", handleCameraChange);

// welcome form(join a room)
const welcomeForm = welcome.querySelector("form");

// 방에 들어오면 실행되는 함수 -> 여기에 연결 요청이 필요하다
async function startMedia() {
  welcome.hidden = true;
  call.hidden = false;
  // 미디어를 셋팅하고 peer to peer 연결을 시작해야 하므로 promise함수가 섞인 getMedia()를 await으로 기다린다.
  await getMedia();
  makeconection();
}

// 아래와 같은 방법으로 소캣에 대한 응답이 완료되었을 때 실행되는 함수를 넣어준다.
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await startMedia();
  socket.emit("joinRoom", input.value, socket.id);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// socket code

// 누군가 들어오면 원래 있던 구성원들 브라우저에서 실행되는 함수 1
socket.on("welcome", async () => {
  const offer = await myPeerConnection.createOffer();
  await myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
  console.log(offer);
  console.log("I sent offer");
});
// 누군가 들어오면 원래 있던 구성원들 브라우저에서 실행되는 함수 2
socket.on("answer", (answer) => {
  console.log("received answer");
  myPeerConnection.setRemoteDescription(answer);
});

// 새로 들어온 구성원이 오퍼를 받아 실행되는 함수
socket.on("offer", async (offer) => {
  console.log("received offer");
  // 아직 myPeerConnection이 존재하지 않을 수 도 있다
  await myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName, socket.id);
  console.log("sent answer");
});

// 다른 구성원의 ice candidate를 소캣을 통해 받고 자신의 연결에 추가하는 모습
socket.on("ice", (ice) => {
  console.log("received ice");
  myPeerConnection.addIceCandidate(ice);
});

socket.on("quit", (id) => {
  peersVideo.srcObject = null;
});

socket.on("joinRoom", () => {
  console.log(1111);
});

// RTC 코드

// 실재 연결을 만드는 함수
function makeconection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          // 구글이 제공하는 stun 서버
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("track", handleAddStream);
  // 스트림 내에 모든 트랙들을 접근하는 함수를 이용하여 myPeercon
  myStream.getTracks().forEach((track) => {
    myPeerConnection.addTrack(track, myStream);
  });
}

// ice candidate의 생성을 확인하고 서버에 소캣을 통해 candidate를 보내주는 함수
function handleIce(data) {
  console.log("got ice candidate and sent it");
  socket.emit("ice", data.candidate, roomName);
  //   console.log(data);
}

// peer의 data stream을 받아서 비디오의 srcObject에 넣어주는 모습
function handleAddStream(data) {
  console.log(data);
  peersVideo.srcObject = data.streams[0];
  console.log("got an event from my peer");
}
