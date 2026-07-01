// ポップアップを開いた時に自動で実行
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('status').innerText = '処理中...';
  
  chrome.runtime.sendMessage({ action: "registerDevice" }, (response) => {
    if (chrome.runtime.lastError) {
      document.getElementById('status').innerText = 'エラー: ' + chrome.runtime.lastError.message;
      return;
    }
    
    if (response && response.status === "success") {
      document.getElementById('status').innerText = '登録・更新成功！';
    } else {
      document.getElementById('status').innerText = 'エラー: ' + (response?.message || '不明なエラー');
    }
  });
});
