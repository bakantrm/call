document.getElementById("join-btn").addEventListener("click", () => {
    const room = document.getElementById("room").value.trim();
    if (!room) return alert("ルーム名を入力してください");
  
    const domain = "meet.jit.si";
    const options = {
      roomName: room,
      parentNode: document.getElementById("jitsi-container"),
      width: "100%",
      height: "100%",
      userInfo: {
        displayName: "ゲスト"
      }
    };
  
    // 既にJitsiが読み込まれている場合は削除
    document.getElementById("jitsi-container").innerHTML = "";
  
    new JitsiMeetExternalAPI(domain, options);
  });
  