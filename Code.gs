// --- スプレッドシート設定 ---
const SPREADSHEET_ID = "1PJnE_FpS34-3J9DuutFrlRswtKbaeTHmnxJsJ5L2QZ8";

function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheets()[0]; // 最初のシートを取得
}

function keepMyGakujoAlive() {
  const url = "https://gakujo.shizuoka.ac.jp/lcu-web/SC_01002B00_00/scheduleInformation";
  
  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // データなし
  
  // 2行目から最終行までのデータを取得 (Date, Cookie, DeviceID)
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const rowsToDelete = [];
  
  // 各デバイスIDごとに最新のCookieを使用してセッション維持を実行
  dataRange.forEach((row, index) => {
    const cookie = row[1];
    const deviceId = row[2];
    
    const options = {
      "method": "get",
      "headers": {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      },
      "followRedirects": false,
      "muteHttpExceptions": true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      
      if (code === 200) {
        const content = response.getContentText();
        try {
          const json = JSON.parse(content);
          if (Array.isArray(json) && json.length === 0) {
            console.warn(`Warning: Device ${deviceId} - セッション切れ。`);
            rowsToDelete.push(index + 2); // 削除対象行を記録
          } else {
            console.log(`Success: Device ${deviceId} - セッションを延長しました。`);
          }
        } catch (e) {
          console.warn(`Warning: Device ${deviceId} - JSONパースエラー、またはセッション切れの可能性。`);
          // 必要ならここも削除対象にする
        }
      } else if (code === 302) {
        console.warn(`Warning: Device ${deviceId} - ログアウトされた可能性があります。`);
        rowsToDelete.push(index + 2); // 削除対象行を記録
      } else {
        console.error(`Error: Device ${deviceId} - ステータスコード ${code}`);
      }
    } catch (e) {
      console.error(`Critical Error: Device ${deviceId} - リクエスト失敗: ${e}`);
    }
  });
  
  // 削除対象行を降順にソートして削除（インデックスずれ防止）
  rowsToDelete.sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const cookie = data.cookie;
  const requestedDeviceId = data.deviceId; // クライアントからのID

  const sheet = getTargetSheet();

  // 既存のデータ範囲を取得
  const lastRow = sheet.getLastRow();
  let deviceId = requestedDeviceId || "";
  let dataRange = [];

  if (lastRow > 1) {
    dataRange = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    // IDがあればそれで見つける、なければCookieで見つける
    let existingEntry = null;
    if (deviceId) {
      existingEntry = dataRange.find(row => row[2] === deviceId);
    }

    if (!existingEntry) {
      existingEntry = dataRange.find(row => row[1] === cookie);
      if (existingEntry) deviceId = existingEntry[2];
    }
  }

  if (!deviceId) {
    deviceId = Utilities.getUuid();
    sheet.appendRow([new Date(), cookie, deviceId]);
  } else {
    // 既存データがある場合はCookieを更新
    const rowIdx = dataRange.findIndex(row => row[2] === deviceId);
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx + 2, 2).setValue(cookie);
    } else {
      // IDはあるのにシートにない場合（初回の整合性確保）
      sheet.appendRow([new Date(), cookie, deviceId]);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', deviceId: deviceId }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  ScriptApp.newTrigger('keepMyGakujoAlive')
    .timeBased()
    .everyMinutes(30)
    .create();
    
  console.log("トリガーを設定しました：30分おきに keepMyGakujoAlive を実行");
}
