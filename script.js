const myVideo = document.getElementById("my-video");
const partnerVideo = document.getElementById("partner-video");
const callBtn = document.getElementById("call-btn");
const partnerIdInput = document.getElementById("partner-id");
const myIdSpan = document.getElementById("my-id");

const peer = new Peer(); // 自動でID発行してくれる

peer.on("open", id => {
  myIdSpan.textContent = id;
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  myVideo.srcObject = stream;

  callBtn.onclick = () => {
    const call = peer.call(partnerIdInput.value, stream);
    call.on("stream", partnerStream => {
      partnerVideo.srcObject = partnerStream;
    });
  };

  peer.on("call", call => {
    call.answer(stream);
    call.on("stream", partnerStream => {
      partnerVideo.srcObject = partnerStream;
    });
  });
}).catch(err => {
  alert("カメラとマイクの許可が必要です: " + err.message);
});
