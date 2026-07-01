// background.js - Manifest V3 background service worker

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyZTiu95k58vLMgQWFfL_X9qsDjAI6aMrpchwA3pmfNuPp_ZDQ12x2_z_INmGc-sX0n/exec";
const GAKUJO_URL = "https://gakujo.shizuoka.ac.jp/lcu-web/SC_01002B00_00/scheduleInformation";

// セッションチェックとCookie登録
async function verifyAndRegisterCookie(sendResponse) {
  try {
    // 1. Gakujoのセッションを確認
    const response = await fetch(GAKUJO_URL, { method: 'GET' });
    
    if (response.redirected || response.status !== 200) {
      notifyLogin();
      if (sendResponse) sendResponse({ status: "error", message: "ログインしてください" });
      return;
    }
    
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json) && json.length === 0) {
        notifyLogin();
        if (sendResponse) sendResponse({ status: "error", message: "セッション切れ" });
        return;
      }
    } catch (e) {
      notifyLogin();
      if (sendResponse) sendResponse({ status: "error", message: "ログインが必要です" });
      return;
    }

    // 2. セッション有効ならCookie登録
    chrome.cookies.getAll({ domain: "gakujo.shizuoka.ac.jp" }, (cookies) => {
      if (cookies.length === 0) {
        if (sendResponse) sendResponse({ status: "error", message: "Cookie取得失敗" });
        return;
      }
      
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // ローカルストレージからIDを取得
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['deviceId'], (result) => {
          const deviceId = result.deviceId || "";
          
          fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie: cookieString, deviceId: deviceId })
          })
          .then(r => r.text())
          .then(text => {
            console.log("GASからのレスポンス内容:", text);
            const data = JSON.parse(text);
            
            // IDを保存
            chrome.storage.local.set({ deviceId: data.deviceId });
            
            if (sendResponse) sendResponse({ status: "success", deviceId: data.deviceId });
            console.log("Cookie更新成功");
          })
          .catch(error => {
            console.error("Fetch error:", error);
            if (sendResponse) sendResponse({ status: "error", message: "通信エラー: " + error.message });
          });
        });
      } else {
        console.error("chrome.storage or chrome.storage.local is not defined");
        if (sendResponse) sendResponse({ status: "error", message: "ストレージ利用不可" });
      }
    });

  } catch (error) {
    console.error("Verification error:", error);
    if (sendResponse) sendResponse({ status: "error", message: error.message });
  }
}

// ユーザーにログインを促す通知
function notifyLogin() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.jpeg',
    title: '学務情報システム ログインのお願い',
    message: 'セッションが切れています。学務情報システムにログインしてください。',
    priority: 2
  });
}

// ポップアップからのメッセージ受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "registerDevice") {
    verifyAndRegisterCookie(sendResponse);
    return true;
  }
});

// 定期実行アラーム
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("autoRegisterCookie", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoRegisterCookie") {
    verifyAndRegisterCookie();
  }
});
