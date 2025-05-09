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
  const nameInput = document.getElementById("name-input");
  const roomInput = document.getElementById("room-input");
  const joinBtn = document.getElementById("join-btn");
  const videoArea = document.getElementById("video-area");
  const videos = document.getElementById("videos");
  const shareBtn = document.getElementById("share-screen-btn");
  const chatInput = document.getElementById("chat-input");
  const sendChatBtn = document.getElementById("send-chat-btn");
  const chatBox = document.getElementById("chat-box");
  
  let localStream;
  const peers = {};
  let userName = "";
  let isMicOn = true;
  let isCamOn = true;
  let remoteStreamExists = false;
  
  function createVideoContainer(name, stream = null, id = null) {
    if (id && document.getElementById(id)) return;
    const container = document.createElement("div");
    container.className = "video-container";
    if (id) container.id = id;
  
    if (stream) {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = name === userName;
      container.appendChild(video);
    } else {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = name.charAt(0).toUpperCase();
      container.appendChild(avatar);
    }
  
    const label = document.createElement("div");
    label.className = "name-label";
    label.textContent = name;
    container.appendChild(label);
  
    videos.appendChild(container);
  }
  
  function sendSignal(room, type, data) {
    db.ref(`${room}/signals`).push({ type, data, senderName: userName });
  }
  
  function addChat(message) {
    const p = document.createElement("p");
    p.textContent = message;
    chatBox.appendChild(p);
  }
  
  joinBtn.onclick = async () => {
    const room = roomInput.value.trim();
    userName = nameInput.value.trim();
    if (!room || !userName) return alert("名前とルーム名を入力してください");
  
    joinBtn.disabled = true;
    roomInput.disabled = true;
    nameInput.disabled = true;
    videoArea.classList.remove("hidden");
  
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      createVideoContainer(userName, localStream, "local-video");
    } catch {
      localStream = null;
      createVideoContainer(userName, null, "local-video");
    }
  
    const pc = new RTCPeerConnection();
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
  
    pc.onicecandidate = event => {
      if (event.candidate) {
        sendSignal(room, "candidate", { candidate: event.candidate });
      }
    };
  
    pc.ontrack = event => {
      if (!remoteStreamExists) {
        const remoteName = remoteUserNames[room] || "匿名";
        createVideoContainer(remoteName, event.streams[0], "remote-video");
        remoteStreamExists = true;
      }
    };
  
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(room, "offer", { sdp: offer });
  
    const remoteUserNames = {};
  
    db.ref(`${room}/signals`).on("child_added", async snapshot => {
      const { type, data, senderName } = snapshot.val();
      if (!data || senderName === userName) return;
  
      remoteUserNames[room] = senderName;
  
      if (type === "offer" && !peers[data.sdp?.sdp]) {
        const newPC = new RTCPeerConnection();
        if (localStream) {
          localStream.getTracks().forEach(track => newPC.addTrack(track, localStream));
        }
  
        newPC.ontrack = event => {
          if (!remoteStreamExists) {
            createVideoContainer(senderName || "匿名", event.streams[0], "remote-video");
            remoteStreamExists = true;
          }
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
  
    db.ref(`${room}/chat`).on("child_added", snap => {
      addChat(snap.val());
    });
  
    const micBtn = document.createElement("button");
    micBtn.textContent = "🎤 ミュート";
    micBtn.onclick = () => {
      isMicOn = !isMicOn;
      if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
      micBtn.textContent = isMicOn ? "🎤 ミュート" : "🔇 ミュート解除";
    };
    videoArea.querySelector(".controls").appendChild(micBtn);
  
    const camBtn = document.createElement("button");
    camBtn.textContent = "📷 カメラOFF";
    camBtn.onclick = () => {
      isCamOn = !isCamOn;
      if (localStream) localStream.getVideoTracks().forEach(track => track.enabled = isCamOn);
      camBtn.textContent = isCamOn ? "📷 カメラOFF" : "🙈 カメラON";
    };
    videoArea.querySelector(".controls").appendChild(camBtn);
  };
  
  shareBtn.onclick = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    Object.values(peers).forEach(peer => {
      const sender = peer.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    });
  };
  
  sendChatBtn.onclick = () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    const room = roomInput.value.trim();
    db.ref(`${room}/chat`).push(`${userName}: ${msg}`);
    chatInput.value = "";
  };
  