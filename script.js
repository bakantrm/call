// === Firebase設定 ===
const firebaseConfig = {
    apiKey: "AIzaSyAYth57B2z7yre2AttQjjCrKHX16ygpgQY",
    authDomain: "tuuwatuuwa.firebaseapp.com",
    databaseURL: "https://tuuwatuuwa-default-rtdb.firebaseio.com",
    projectId: "tuuwatuuwa",
    storageBucket: "tuuwatuuwa.firebasestorage.app",
    messagingSenderId: "700749255092",
    appId: "1:700749255092:web:c928633b3ecdd144f4a2e1"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  
  // === DOM取得 ===
  const roomInput = document.getElementById("room-input");
  const joinBtn = document.getElementById("join-btn");
  const videoArea = document.getElementById("video-area");
  const videos = document.getElementById("videos");
  const shareBtn = document.getElementById("share-screen-btn");
  const chatInput = document.getElementById("chat-input");
  const sendChatBtn = document.getElementById("send-chat-btn");
  const chatBox = document.getElementById("chat-box");
  
  // === WebRTC ===
  let localStream;
  const peers = {};
  
  async function startCamera() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const myVideo = document.createElement("video");
    myVideo.srcObject = localStream;
    myVideo.autoplay = true;
    myVideo.muted = true;
    videos.appendChild(myVideo);
  }
  
  function sendSignal(room, type, data) {
    db.ref(`${room}/signals`).push({ type, data });
  }
  
  function addChat(message) {
    const p = document.createElement("p");
    p.textContent = message;
    chatBox.appendChild(p);
  }
  
  // === ルーム参加 ===
  joinBtn.onclick = async () => {
    const room = roomInput.value.trim();
    if (!room) return alert("ルーム名を入力してください");
  
    joinBtn.disabled = true;
    roomInput.disabled = true;
    videoArea.classList.remove("hidden");
    await startCamera();
  
    const pc = new RTCPeerConnection();
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  
    pc.onicecandidate = event => {
      if (event.candidate) {
        sendSignal(room, "candidate", { candidate: event.candidate });
      }
    };
  
    pc.ontrack = event => {
      const remoteVideo = document.createElement("video");
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.autoplay = true;
      videos.appendChild(remoteVideo);
    };
  
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(room, "offer", { sdp: offer });
  
    db.ref(`${room}/signals`).on("child_added", async snapshot => {
      const { type, data } = snapshot.val();
      if (!data) return;
  
      if (type === "offer" && !peers[data.sdp?.sdp]) {
        const newPC = new RTCPeerConnection();
        localStream.getTracks().forEach(track => newPC.addTrack(track, localStream));
  
        newPC.ontrack = event => {
          const remoteVideo = document.createElement("video");
          remoteVideo.srcObject = event.streams[0];
          remoteVideo.autoplay = true;
          videos.appendChild(remoteVideo);
        };
  
        newPC.onicecandidate = e => {
          if (e.candidate) {
            sendSignal(room, "candidate", { candidate: e.candidate });
          }
        };
  
        await newPC.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await newPC.createAnswer();
        await newPC.setLocalDescription(answer);
        sendSignal(room, "answer", { sdp: answer });
  
        peers[data.sdp.sdp] = newPC;
      } else if (type === "answer" && data?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (type === "candidate" && data?.candidate) {
        const candidate = new RTCIceCandidate(data.candidate);
        try {
          pc.addIceCandidate(candidate);
          Object.values(peers).forEach(p => p.addIceCandidate(candidate));
        } catch (e) {
          console.warn("ICE candidate error", e);
        }
      }
    });
  
    // チャット受信
    db.ref(`${room}/chat`).on("child_added", snap => {
      addChat(snap.val());
    });
  };
  
  // === 画面共有 ===
  shareBtn.onclick = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    Object.values(peers).forEach(peer => {
      const sender = peer.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    });
  };
  
  // === チャット送信 ===
  sendChatBtn.onclick = () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    const room = roomInput.value.trim();
    db.ref(`${room}/chat`).push(msg);
    chatInput.value = "";
  };
  