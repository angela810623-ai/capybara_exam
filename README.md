# 卡皮巴拉乘法大冒險

適用於 PC 與 iPad 的純前端九九乘法遊戲。第一版包含主地圖、NPC 教學、3×3 洞口、80 秒倒數、五滴血、十題過關、本機進度保存與完整互動音效。

## 本機預覽

在此資料夾啟動任何靜態 HTTP 伺服器，例如：

```powershell
python -m http.server 4173
```

然後開啟 `http://localhost:4173/`。

## GitHub Pages

專案沒有建置步驟，可以直接將儲存庫根目錄部署到 GitHub Pages。

## 美術來源

背景與卡皮巴拉角色由 OpenAI 內建 ImageGen 依「柔軟黏土玩具」方向產生；題目、答案與介面文字由 HTML/CSS 繪製。

## 音效來源

槌子揮動、柔和槌擊、卡皮巴拉冒出與叫聲、答對／答錯、按鈕及過關歡呼取自効果音ラボ。詳見 [`sound/SOURCES.md`](sound/SOURCES.md)。
