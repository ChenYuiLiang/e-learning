#!/usr/bin/env python3
"""Add knowledge quiz pages to start-unit HTML files."""

import re
import os

BASE = os.path.dirname(os.path.abspath(__file__))

QUIZ_DATA = {
    "start-01-unit-html5-basics.html": [
        {
            "q": "1. 在 HTML5 的行動裝置最佳化中，<code>&lt;meta name=\"viewport\"&gt;</code> 標籤的主要用途是什麼？",
            "opts": [("a", "讓網頁標題顯示在瀏覽器分頁上"), ("b", "控制網頁在行動裝置上的縮放比例與視窗寬度"), ("c", "設定網頁的背景顏色與字體大小")],
            "ans": "b", "explain": "正確！<code>viewport</code> meta 標籤能設定 <code>width=device-width</code> 與 <code>initial-scale=1.0</code>，讓網頁在手機上以正確比例顯示，是行動端開發的必備設定。",
        },
        {
            "q": "2. HTML5 文件的標準骨架結構中，<code>&lt;!DOCTYPE html&gt;</code> 宣告的用途是什麼？",
            "opts": [("a", "告知瀏覽器使用 HTML5 標準模式來解析網頁"), ("b", "引入外部 CSS 樣式表到網頁中"), ("c", "定義網頁的主要內容區域")],
            "ans": "a", "explain": "正確！<code>&lt;!DOCTYPE html&gt;</code> 是 HTML5 的文件類型宣告，確保瀏覽器使用標準模式（Standards Mode）而非怪異模式（Quirks Mode）來渲染頁面。",
        },
        {
            "q": "3. 在 HTML5 語義化標籤中，哪個標籤最適合用來包裹網頁的主導覽選單？",
            "opts": [("a", "<code>&lt;div class=\"menu\"&gt;</code>"), ("b", "<code>&lt;nav&gt;</code>"), ("c", "<code>&lt;header&gt;</code>")],
            "ans": "b", "explain": "正確！<code>&lt;nav&gt;</code> 是 HTML5 專門定義導航區塊的語義化標籤，能讓螢幕閱讀器與搜尋引擎更好地理解頁面結構。",
        },
        {
            "q": "4. 為什麼我們在 <code>&lt;head&gt;</code> 中要設定 <code>&lt;meta charset=\"UTF-8\"&gt;</code>？",
            "opts": [("a", "加速網頁的載入速度與快取效率"), ("b", "確保網頁能正確顯示中文、日文等多國語言字元"), ("c", "防止網頁被其他網站的 iframe 嵌入")],
            "ans": "b", "explain": "正確！UTF-8 是萬國碼編碼格式，能涵蓋全球絕大多數語言的字元。設定 <code>charset=\"UTF-8\"</code> 可避免中文等非英文字元顯示為亂碼。",
        },
    ],
    "start-01-unit-flexbox-layout.html": [
        {
            "q": "1. 在 Flexbox 佈局中，<code>display: flex</code> 應該設定在哪個元素上？",
            "opts": [("a", "需要被排列的子元素上"), ("b", "包裹所有子元素的父容器上"), ("c", "頁面的 <code>&lt;body&gt;</code> 標籤上")],
            "ans": "b", "explain": "正確！<code>display: flex</code> 必須設定在父容器（Flex Container）上，其直接子元素才會成為 Flex Items 並依照彈性盒模型進行排列。",
        },
        {
            "q": "2. Flexbox 的預設主軸方向（Main Axis）是什麼？",
            "opts": [("a", "由上到下（垂直方向）"), ("b", "由左到右（水平方向）"), ("c", "依照 HTML 原始碼的書寫順序")],
            "ans": "b", "explain": "正確！Flexbox 的預設 <code>flex-direction</code> 為 <code>row</code>，主軸方向為水平（由左到右）。若需改為垂直方向，可設定 <code>flex-direction: column</code>。",
        },
        {
            "q": "3. 若要讓 Flex 容器中的子元素在交叉軸（Cross Axis）上垂直置中，應使用哪個屬性？",
            "opts": [("a", "<code>justify-content: center</code>"), ("b", "<code>align-items: center</code>"), ("c", "<code>flex-wrap: wrap</code>")],
            "ans": "b", "explain": "正確！<code>align-items</code> 控制交叉軸上的對齊方式，設為 <code>center</code> 可讓子元素垂直置中。而 <code>justify-content</code> 控制的是主軸方向。",
        },
        {
            "q": "4. 在行動裝置的遙控器介面中，使用 Flexbox 而非固定像素定位的主要優點是什麼？",
            "opts": [("a", "可以讓網頁載入速度更快"), ("b", "能自動適應不同螢幕尺寸，確保按鈕不會跑版或重疊"), ("c", "可以同時支援觸控與滑鼠操作")],
            "ans": "b", "explain": "正確！Flexbox 是響應式佈局的核心工具，能讓 UI 元素根據可用空間自動調整大小與間距，在不同手機螢幕上都維持良好的佈局結構。",
        },
    ],
    "start-01-unit-ui-ux-standards.html": [
        {
            "q": "1. 根據費茲定律（Fitts's Law），在行動裝置介面設計中，「緊急停止」按鈕應遵循什麼原則？",
            "opts": [("a", "按鈕越小越精緻，放在畫面角落避免誤觸"), ("b", "按鈕面積要大、位置要靠近拇指自然觸及區域"), ("c", "按鈕顏色要與背景融為一體以保持美觀")],
            "ans": "b", "explain": "正確！費茲定律指出，目標越大、距離越近，操作速度越快。緊急停止按鈕必須設計得夠大且位於拇指可輕鬆觸及的區域，以確保緊急時能即時操作。",
        },
        {
            "q": "2. 什麼是「認知負荷（Cognitive Load）」在介面設計中的實際意義？",
            "opts": [("a", "使用者的手機處理器在渲染 UI 時消耗的運算資源"), ("b", "使用者在操作介面時，大腦需要處理的資訊量與決策壓力"), ("c", "網頁載入時所消耗的網路流量與頻寬")],
            "ans": "b", "explain": "正確！認知負荷指的是使用者理解與操作介面時大腦的負擔。好的 UX 設計會減少不必要的選項、使用一致的視覺語言，降低使用者的認知負荷。",
        },
        {
            "q": "3. 為什麼按鈕需要提供「按下 → 按住 → 放開」三種視覺狀態回饋？",
            "opts": [("a", "為了增加 CSS 程式碼的複雜度以展示技術能力"), ("b", "讓使用者在每個操作階段都能確認系統已收到指令，建立操控信心"), ("c", "為了減少瀏覽器的重繪次數，提升渲染效能")],
            "ans": "b", "explain": "正確！視覺回饋是 UX 的核心。按鈕的即時狀態變化（顏色、陰影、大小）讓使用者感知到「系統正在回應」，在操控機器人等高風險場景中尤為重要。",
        },
        {
            "q": "4. 在 Apple Human Interface Guidelines 中，建議行動端觸控目標的最小尺寸為多少？",
            "opts": [("a", "24 × 24 像素"), ("b", "44 × 44 像素"), ("c", "64 × 64 像素")],
            "ans": "b", "explain": "正確！Apple HIG 建議觸控目標至少為 44×44 pt，而 Google Material Design 建議 48×48 dp。這確保使用者能準確點擊，減少誤觸機率。",
        },
    ],
    "start-02-unit-typed-arrays.html": [
        {
            "q": "1. 相比 JSON 字串傳輸，使用 <code>Uint8Array</code> 二進制格式的最大優勢是什麼？",
            "opts": [("a", "程式碼更容易閱讀與除錯"), ("b", "傳輸的資料量更小，頻寬效率更高"), ("c", "所有瀏覽器都原生支援二進制格式解析")],
            "ans": "b", "explain": "正確！以搖桿座標為例，JSON 字串需要 17 bytes，而二進制只需 2 bytes，資料量減少約 88%，在低頻寬的 BLE 環境中優勢極為明顯。",
        },
        {
            "q": "2. <code>ArrayBuffer</code> 在 JavaScript 中扮演什麼角色？",
            "opts": [("a", "一個可直接讀寫的陣列，類似普通的 JavaScript Array"), ("b", "一塊固定大小的原始記憶體緩衝區，必須透過 View 才能存取資料"), ("c", "用於將字串轉換為數字的解析工具")],
            "ans": "b", "explain": "正確！<code>ArrayBuffer</code> 是一塊純粹的二進制記憶體空間，本身不提供讀寫方法。必須搭配 <code>DataView</code> 或 TypedArray（如 <code>Uint8Array</code>）才能對資料進行操作。",
        },
        {
            "q": "3. 什麼是「位元組順序（Byte Order / Endianness）」？為什麼在跨裝置通訊時需要特別注意？",
            "opts": [("a", "指的是資料排序演算法的選擇，影響搜尋效率"), ("b", "指多位元組數值在記憶體中的排列方式，不同硬體平台可能採用不同順序"), ("c", "指 JavaScript 陣列元素的索引起始值是 0 還是 1")],
            "ans": "b", "explain": "正確！Big-Endian 將高位位元組放在前面，Little-Endian 則相反。ESP32 使用 Little-Endian，而網路傳輸慣例為 Big-Endian，若不統一會導致數值解讀錯誤。",
        },
        {
            "q": "4. 使用 <code>DataView</code> 相比 <code>Uint8Array</code> 的主要優勢是什麼？",
            "opts": [("a", "DataView 的執行速度更快"), ("b", "DataView 可以指定位元組順序（Endianness），並存取不同型別的數值"), ("c", "DataView 佔用的記憶體更少")],
            "ans": "b", "explain": "正確！<code>DataView</code> 提供 <code>getUint16()</code>、<code>getFloat32()</code> 等方法，且每次呼叫都能指定是否使用 Little-Endian，非常適合解析結構化的二進制封包。",
        },
    ],
    "start-02-unit-ble-async.html": [
        {
            "q": "1. 在 JavaScript 中，為什麼 Web BLE 的 API（如 <code>requestDevice()</code>）需要使用非同步（Async）方式呼叫？",
            "opts": [("a", "因為非同步語法比較新潮，是 JavaScript 的最佳實踐"), ("b", "因為藍牙操作需要等待硬體回應，同步呼叫會導致瀏覽器完全凍結"), ("c", "因為非同步程式碼的執行速度比同步程式碼更快")],
            "ans": "b", "explain": "正確！藍牙掃描、連線、讀寫等操作可能需要數秒鐘等待硬體回應。若使用同步呼叫，主執行緒會被阻塞，導致 UI 完全無法互動。",
        },
        {
            "q": "2. <code>async/await</code> 語法的本質是什麼？",
            "opts": [("a", "一種全新的 JavaScript 執行引擎"), ("b", "Promise 鏈式呼叫的語法糖，讓非同步程式碼看起來像同步流程"), ("c", "一種能讓程式碼在多核心 CPU 上並行執行的技術")],
            "ans": "b", "explain": "正確！<code>async/await</code> 底層仍然是 Promise，但它讓我們用接近「一步一步往下寫」的方式撰寫非同步邏輯，大幅提升程式碼的可讀性與維護性。",
        },
        {
            "q": "3. 在 BLE 連線流程中，若 <code>connect()</code> 失敗，正確的錯誤處理方式是什麼？",
            "opts": [("a", "使用 <code>try...catch</code> 捕捉例外，並在 UI 上顯示友善的錯誤訊息"), ("b", "忽略錯誤並自動重試無限次"), ("c", "使用 <code>alert()</code> 直接彈出錯誤代碼給使用者")],
            "ans": "a", "explain": "正確！使用 <code>try...catch</code> 包裹非同步操作是最佳實踐。捕捉到錯誤後應在介面上顯示清楚的狀態提示，而非讓程式靜默失敗。",
        },
        {
            "q": "4. <code>Promise</code> 物件的三種狀態分別是什麼？",
            "opts": [("a", "Start、Running、End"), ("b", "Pending、Fulfilled、Rejected"), ("c", "Open、Active、Closed")],
            "ans": "b", "explain": "正確！Promise 有三種狀態：<code>Pending</code>（等待中）、<code>Fulfilled</code>（已完成）與 <code>Rejected</code>（已拒絕）。狀態一旦改變就不可逆轉。",
        },
    ],
    "start-02-unit-ble-security.html": [
        {
            "q": "1. Web Bluetooth API 為什麼強制要求網頁必須透過 HTTPS 才能使用？",
            "opts": [("a", "因為 HTTPS 的網頁載入速度比 HTTP 更快"), ("b", "因為藍牙通訊涉及敏感的硬體存取權限，HTTPS 能防止中間人攻擊竊取資料"), ("c", "因為瀏覽器廠商希望推廣 SSL 憑證的銷售")],
            "ans": "b", "explain": "正確！Web BLE 可以操控實體硬體，若透過不安全的 HTTP 連線，攻擊者可能透過中間人攻擊劫持藍牙指令。HTTPS 確保了通訊通道的完整性與保密性。",
        },
        {
            "q": "2. 什麼是「User Gesture 要求」？為什麼 <code>requestDevice()</code> 需要它？",
            "opts": [("a", "需要使用者做出特定手勢才能開啟藍牙功能"), ("b", "必須由使用者的主動操作（如點擊按鈕）觸發，防止網頁在背景偷偷掃描藍牙裝置"), ("c", "需要使用者在手機設定中手動開啟藍牙權限")],
            "ans": "b", "explain": "正確！瀏覽器要求 <code>requestDevice()</code> 必須在使用者互動事件（如 click）的處理函式中呼叫，防止惡意網頁在背景未經授權掃描周遭的藍牙裝置。",
        },
        {
            "q": "3. 在多人教室環境中，如何確保你的程式只連接到自己的 ESP32 裝置？",
            "opts": [("a", "使用 <code>acceptAllDevices: true</code> 掃描所有裝置並手動選擇"), ("b", "使用 <code>filters</code> 設定 <code>namePrefix</code> 或 <code>services</code> UUID 進行精準過濾"), ("c", "關閉其他同學的藍牙裝置以減少干擾")],
            "ans": "b", "explain": "正確！使用 <code>filters</code> 參數能在掃描階段就篩選出目標裝置，避免在多裝置環境中連錯機器。",
        },
        {
            "q": "4. Web BLE 在 iOS Safari 上的主要限制是什麼？",
            "opts": [("a", "iOS Safari 完全不支援 JavaScript"), ("b", "iOS Safari 目前不支援 Web Bluetooth API"), ("c", "iOS Safari 只能連接 Apple 自家的藍牙裝置")],
            "ans": "b", "explain": "正確！截至目前，Apple 的 Safari 瀏覽器（包含 iOS 與 macOS）尚未原生支援 Web Bluetooth API。開發者需使用替代方案（如 WebBLE App 或改用 Android/Chrome）。",
        },
    ],
    "start-03-unit-data-json.html": [
        {
            "q": "1. <code>JSON.stringify()</code> 的作用是什麼？",
            "opts": [("a", "將 JSON 字串解析為 JavaScript 物件"), ("b", "將 JavaScript 物件序列化為 JSON 格式的字串"), ("c", "驗證一段字串是否為合法的 JSON 格式")],
            "ans": "b", "explain": "正確！<code>JSON.stringify()</code> 將物件轉為字串，適合在網路傳輸或儲存時使用。相對地，<code>JSON.parse()</code> 則是將 JSON 字串還原為物件。",
        },
        {
            "q": "2. 在 BLE 通訊的封包設計中，為什麼建議將 Key 縮短（例如將 <code>command</code> 改為 <code>c</code>）？",
            "opts": [("a", "因為短 Key 讓程式碼更難被逆向工程破解"), ("b", "因為 BLE 單次傳輸的封包大小有限（約 20 bytes），縮短 Key 能在有限頻寬中攜帶更多有效資料"), ("c", "因為 JavaScript 解析短 Key 的速度比長 Key 快 10 倍")],
            "ans": "b", "explain": "正確！BLE 的 MTU 預設約 20 bytes，每個字元都很珍貴。使用短 Key 能大幅降低封包的 Overhead，讓有限的空間承載更多控制數據。",
        },
        {
            "q": "3. 以下哪個是合法的 JSON 格式？",
            "opts": [("a", "<code>{ command: 'forward', speed: 100 }</code>"), ("b", "<code>{\"command\": \"forward\", \"speed\": 100}</code>"), ("c", "<code>{ 'command': 'forward', 'speed': 100 }</code>")],
            "ans": "b", "explain": "正確！JSON 標準要求所有的 Key 和字串值必須使用雙引號包裹。單引號或無引號的 Key 在 JavaScript 物件中合法，但不是合法的 JSON。",
        },
        {
            "q": "4. 在通訊協定中加入時間戳記（<code>Date.now()</code>）的主要目的是什麼？",
            "opts": [("a", "讓接收端知道發送端的當地時區"), ("b", "用於偵測封包的新鮮度、排序先後順序，以及丟棄過期的指令"), ("c", "讓 JSON 封包的大小固定統一")],
            "ans": "b", "explain": "正確！時間戳記讓接收端能判斷封包是否過期，也能在多封包同時到達時正確排序，確保機器人執行最新指令。",
        },
    ],
    "start-03-unit-flow-logic.html": [
        {
            "q": "1. 在持續按住控制按鈕時，為什麼要使用 <code>setInterval()</code> 定期發送指令，而非只在 <code>mousedown</code> 時發送一次？",
            "opts": [("a", "因為 <code>setInterval()</code> 的語法比較簡潔"), ("b", "因為機器人需要持續收到指令才會持續動作，單次指令會導致機器人只動一下就停止"), ("c", "因為瀏覽器會自動忽略單次發送的事件")],
            "ans": "b", "explain": "正確！在即時控制系統中，機器人需要持續收到「心跳式」的控制指令來維持動作。若只發送一次，機器人無法區分「持續前進」與「點一下就停」的意圖。",
        },
        {
            "q": "2. 當使用者放開按鈕時（<code>mouseup</code>），正確的資源釋放步驟是什麼？",
            "opts": [("a", "不需要任何處理，瀏覽器會自動停止計時器"), ("b", "呼叫 <code>clearInterval()</code> 停止定時器，並將 ID 變數設為 <code>null</code>"), ("c", "直接重新整理整個網頁")],
            "ans": "b", "explain": "正確！必須使用 <code>clearInterval()</code> 明確停止定時器，並將 ID 設為 <code>null</code>，避免「幽靈定時器」持續在背景執行。",
        },
        {
            "q": "3. 什麼是「Fail-safe（失效安全）」機制？在遙控介面中如何實現？",
            "opts": [("a", "當網頁發生 JavaScript 錯誤時自動隱藏錯誤訊息"), ("b", "當偵測到異常狀態（如視窗失焦、滑鼠離開）時，自動停止所有指令發送並發送停止訊號"), ("c", "在程式碼中加入大量的註解以防止出錯")],
            "ans": "b", "explain": "正確！Fail-safe 確保在非預期情況下，系統能自動觸發安全停止，防止機器人失控持續運動。",
        },
        {
            "q": "4. 為什麼需要監聽 <code>blur</code> 事件來實作安全機制？",
            "opts": [("a", "因為 <code>blur</code> 事件能偵測使用者是否閉上了眼睛"), ("b", "因為當使用者切換到其他視窗或 App 時，<code>mouseup</code> 事件可能不會被觸發，導致定時器持續運行"), ("c", "因為 <code>blur</code> 事件的觸發頻率比 <code>click</code> 更高")],
            "ans": "b", "explain": "正確！當使用者按住按鈕後切換到其他應用程式，<code>mouseup</code> 不會被網頁捕捉到，定時器會持續發送指令。監聽 <code>blur</code> 能在視窗失焦時立即煞車。",
        },
    ],
    "start-03-unit-control-panel.html": [
        {
            "q": "1. 在設計遙控器面板佈局時，為什麼推薦使用 CSS Grid 而非手動設定 <code>margin</code> 與 <code>padding</code>？",
            "opts": [("a", "因為 CSS Grid 的渲染速度比 margin 快"), ("b", "因為 CSS Grid 能以宣告式語法精確控制行列結構，避免手動計算間距導致的跑版問題"), ("c", "因為 margin 和 padding 在行動裝置上不被支援")],
            "ans": "b", "explain": "正確！CSS Grid 讓你用 <code>grid-template-columns</code> 和 <code>grid-template-rows</code> 精準定義每個按鈕的位置與大小，在不同螢幕尺寸下都能維持一致的佈局結構。",
        },
        {
            "q": "2. 在 3×3 的方向控制面板中，「停止」按鈕通常放在哪個位置？為什麼？",
            "opts": [("a", "放在右下角，因為大多數使用者是右撇子"), ("b", "放在正中央（第 2 行第 2 列），因為它是所有方向的原點，且位於拇指最容易觸及的區域"), ("c", "放在最上方，因為停止是最重要的功能")],
            "ans": "b", "explain": "正確！將停止按鈕放在九宮格中央既符合空間邏輯（方向鍵圍繞原點），也符合人體工學（拇指的自然靜止位置）。",
        },
        {
            "q": "3. CSS 的 <code>z-index</code> 屬性在控制面板中的用途是什麼？",
            "opts": [("a", "控制元素的透明度"), ("b", "控制元素在垂直方向的堆疊順序，讓控制層浮在影像層之上"), ("c", "控制元素的旋轉角度")],
            "ans": "b", "explain": "正確！<code>z-index</code> 決定重疊元素的前後順序。在 FPV 遙控介面中，操控按鈕層需要較高的 <code>z-index</code> 以覆蓋在即時影像串流層之上。",
        },
        {
            "q": "4. 為什麼在觸控回饋中，按鈕按下時應該改變顏色或加上陰影？",
            "opts": [("a", "純粹是為了美觀，沒有實際功能意義"), ("b", "提供即時的視覺回饋，讓使用者確認「系統已接收到操作」，增強操控信心"), ("c", "觸發瀏覽器的硬體加速以提升渲染效能")],
            "ans": "b", "explain": "正確！視覺回饋讓使用者在操控機器人時能即時感知到按鈕是否被成功觸發，是安全操控的基礎。",
        },
    ],
    "start-04-unit-touch-basics.html": [
        {
            "q": "1. 在觸控事件的生命週期中，正確的事件觸發順序是什麼？",
            "opts": [("a", "<code>touchmove</code> → <code>touchstart</code> → <code>touchend</code>"), ("b", "<code>touchstart</code> → <code>touchmove</code> → <code>touchend</code>"), ("c", "<code>click</code> → <code>touchstart</code> → <code>touchend</code>")],
            "ans": "b", "explain": "正確！觸控事件的完整生命週期為：手指放上 → <code>touchstart</code>、手指移動 → <code>touchmove</code>（可重複觸發）、手指離開 → <code>touchend</code>。",
        },
        {
            "q": "2. <code>TouchEvent</code> 物件中的 <code>identifier</code> 屬性有什麼用途？",
            "opts": [("a", "標記觸控事件的時間戳記"), ("b", "為每根手指分配獨一無二的追蹤 ID，用於多點觸控時區分不同手指"), ("c", "記錄觸控點的壓力大小")],
            "ans": "b", "explain": "正確！每根手指在觸碰螢幕時會獲得一個 <code>identifier</code>，在整個觸控過程中保持不變，讓我們能在多點觸控場景中獨立追蹤每根手指。",
        },
        {
            "q": "3. 為什麼在遙控器介面中，我們偏好使用 <code>touchstart</code> 而非 <code>click</code> 事件？",
            "opts": [("a", "因為 <code>touchstart</code> 的程式碼語法更簡單"), ("b", "因為 <code>click</code> 在行動裝置上有約 300 毫秒的延遲，<code>touchstart</code> 能實現零延遲回應"), ("c", "因為 <code>click</code> 事件在行動瀏覽器上完全不可用")],
            "ans": "b", "explain": "正確！行動瀏覽器為了判斷是否為「雙擊縮放」，會對 <code>click</code> 事件施加約 300ms 的等待延遲。直接監聽 <code>touchstart</code> 能消除這個延遲。",
        },
        {
            "q": "4. 如何將觸控點的螢幕座標轉換為元素內部的相對座標？",
            "opts": [("a", "直接使用 <code>touch.clientX</code> 和 <code>touch.clientY</code>"), ("b", "用 <code>touch.clientX - element.getBoundingClientRect().left</code> 計算"), ("c", "使用 <code>touch.offsetX</code> 屬性直接取得")],
            "ans": "b", "explain": "正確！<code>clientX/Y</code> 是相對於視窗的座標，需要減去目標元素的 <code>getBoundingClientRect()</code> 位置才能得到元素內部的相對座標。",
        },
    ],
    "start-04-unit-prevent-default.html": [
        {
            "q": "1. 在行動裝置上，呼叫 <code>e.preventDefault()</code> 最主要的目的是什麼？",
            "opts": [("a", "防止 JavaScript 拋出例外錯誤"), ("b", "阻止瀏覽器的預設行為（如觸控捲動、長按選單），確保操控介面不被干擾"), ("c", "提升 CSS 動畫的流暢度")],
            "ans": "b", "explain": "正確！<code>preventDefault()</code> 能阻止瀏覽器對觸控事件的預設處理，讓 Web App 擁有如同原生 App 的操作體驗。",
        },
        {
            "q": "2. 什麼是「Passive Event Listener」？為什麼在需要 <code>preventDefault()</code> 的場景中要設定 <code>{ passive: false }</code>？",
            "opts": [("a", "Passive 模式讓事件監聽器在背景執行，不佔用主執行緒"), ("b", "Passive 模式告知瀏覽器「此監聽器不會呼叫 preventDefault()」以提升捲動效能；若需要阻止預設行為，必須設為 false"), ("c", "Passive 模式是 iOS 專屬的事件處理機制")],
            "ans": "b", "explain": "正確！現代瀏覽器預設將 <code>touchmove</code> 的監聽器設為 passive，呼叫 <code>preventDefault()</code> 會被忽略。必須明確設定 <code>{ passive: false }</code> 才能生效。",
        },
        {
            "q": "3. 以下哪個 CSS 屬性可以消除行動裝置點擊時的藍色半透明高亮效果？",
            "opts": [("a", "<code>-webkit-tap-highlight-color: transparent</code>"), ("b", "<code>pointer-events: none</code>"), ("c", "<code>opacity: 0</code>")],
            "ans": "a", "explain": "正確！<code>-webkit-tap-highlight-color: transparent</code> 能清除行動裝置瀏覽器預設的點擊高亮效果，讓按鈕的視覺回饋完全由自定義 CSS 控制。",
        },
        {
            "q": "4. 在觸控介面中，為什麼建議同時監聽 <code>contextmenu</code> 事件並阻止它？",
            "opts": [("a", "因為 <code>contextmenu</code> 事件會導致記憶體洩漏"), ("b", "因為長按時瀏覽器會彈出右鍵選單（如「複製」、「儲存圖片」），會中斷使用者的連續操控"), ("c", "因為阻止 <code>contextmenu</code> 能加速觸控事件的處理速度")],
            "ans": "b", "explain": "正確！在遙控器介面中，長按方向鍵時不希望看到瀏覽器的右鍵選單。監聯 <code>contextmenu</code> 事件並呼叫 <code>preventDefault()</code> 可以完全阻止這個干擾。",
        },
    ],
    "start-04-unit-long-press.html": [
        {
            "q": "1. 實作「長按持續發送指令」功能時，為什麼在啟動新的 <code>setInterval</code> 之前要先清除舊的定時器？",
            "opts": [("a", "因為 JavaScript 不允許同時存在兩個定時器"), ("b", "防止「幽靈定時器」疊加，避免同一操作產生多個定時器同時發送指令，導致指令頻率失控"), ("c", "因為清除定時器能釋放更多 CPU 資源給渲染引擎")],
            "ans": "b", "explain": "正確！若不先清除舊定時器就啟動新的，多個 <code>setInterval</code> 會疊加運行，造成指令發送頻率倍增，機器人可能出現失控加速等危險行為。",
        },
        {
            "q": "2. 「5 秒自動熔斷」安全機制的核心設計理念是什麼？",
            "opts": [("a", "節省電池電量，定時關閉藍牙連線"), ("b", "設定指令發送的最長持續時間，超時後自動停止，防止按鈕卡住導致機器人失控"), ("c", "讓使用者每 5 秒需要重新點擊一次按鈕以確認意圖")],
            "ans": "b", "explain": "正確！自動熔斷機制確保即使按鈕因為軟體 Bug 或硬體故障而「卡住」，系統也會在預設時間後強制停止指令發送，這是物理安全的最後防線。",
        },
        {
            "q": "3. 為什麼在 <code>clearInterval()</code> 之後，建議將定時器 ID 變數設回 <code>null</code>？",
            "opts": [("a", "因為 <code>null</code> 值能觸發 JavaScript 的垃圾回收機制"), ("b", "因為後續程式碼可以用 <code>if (timerId !== null)</code> 判斷定時器是否正在運行，避免重複清除"), ("c", "因為不設為 null 會導致瀏覽器記憶體洩漏")],
            "ans": "b", "explain": "正確！將 ID 設為 <code>null</code> 是一種狀態標記，讓程式碼能明確知道「目前沒有定時器在運行」，避免邏輯判斷錯誤。",
        },
        {
            "q": "4. 除了 <code>mouseup</code> 和 <code>touchend</code>，還需要監聽哪些事件來確保指令發送能被正確停止？",
            "opts": [("a", "<code>mouseover</code> 和 <code>mouseenter</code>"), ("b", "<code>mouseleave</code>（或 <code>pointerleave</code>）以及 <code>blur</code>（視窗失焦）"), ("c", "<code>scroll</code> 和 <code>resize</code>")],
            "ans": "b", "explain": "正確！使用者的手指可能滑出按鈕區域（<code>mouseleave</code>），或切換到其他 App（觸發 <code>blur</code>）。這些場景都不會觸發 <code>mouseup</code>，必須額外監聽以確保安全停止。",
        },
    ],
    "start-05-unit-canvas-joystick.html": [
        {
            "q": "1. 使用 HTML5 Canvas 繪圖時，為什麼每一幀都需要先呼叫 <code>clearRect()</code>？",
            "opts": [("a", "清除記憶體中的暫存圖片以節省效能"), ("b", "清除上一幀的繪圖內容，避免產生殘影或拖尾效果"), ("c", "重新載入 Canvas 元素的 CSS 樣式")],
            "ans": "b", "explain": "正確！Canvas 的繪圖是累積性的，新的圖形會疊加在舊圖形上。若不先用 <code>clearRect()</code> 清除，搖桿頭移動時會留下一連串殘影。",
        },
        {
            "q": "2. CSS 的 <code>border-radius: 50%</code> 在搖桿介面設計中的作用是什麼？",
            "opts": [("a", "讓元素的邊框變成圓角矩形"), ("b", "將正方形元素變成完美的圓形，用於製作搖桿底盤或按鈕"), ("c", "讓元素的大小自動適應螢幕寬度")],
            "ans": "b", "explain": "正確！當 <code>border-radius</code> 設為 50% 時，正方形元素會變成完美圓形。在搖桿 UI 中，底盤和操控頭都使用此技巧來營造專業的圓形控制器外觀。",
        },
        {
            "q": "3. Canvas 的 <code>save()</code> 和 <code>restore()</code> 方法的用途是什麼？",
            "opts": [("a", "將 Canvas 圖片儲存為 PNG 檔案並還原"), ("b", "保存與恢復繪圖狀態（如座標變換、顏色設定），確保變換操作不會影響其他繪圖"), ("c", "備份與還原整個 Canvas 元素的 HTML 屬性")],
            "ans": "b", "explain": "正確！<code>save()</code> 將目前的繪圖狀態壓入堆疊。<code>restore()</code> 則將狀態彈出恢復，確保 <code>translate()</code>、<code>rotate()</code> 等操作不會累積影響後續繪圖。",
        },
        {
            "q": "4. 如何取得滑鼠或手指在 Canvas 畫布內部的精確座標？",
            "opts": [("a", "直接使用事件物件的 <code>pageX</code> 和 <code>pageY</code>"), ("b", "使用 <code>canvas.getBoundingClientRect()</code> 取得畫布位置，再用 <code>clientX - rect.left</code> 計算相對座標"), ("c", "使用 Canvas Context 的 <code>getCoordinates()</code> 方法")],
            "ans": "b", "explain": "正確！<code>getBoundingClientRect()</code> 回傳畫布在頁面上的位置與尺寸。將滑鼠的視窗座標減去畫布的左上角座標，就能得到準確的畫布內部座標。",
        },
    ],
    "start-05-unit-joystick-math.html": [
        {
            "q": "1. 在搖桿數學中，如何計算操控頭到圓心的距離？",
            "opts": [("a", "使用 <code>Math.abs(dx) + Math.abs(dy)</code> 計算曼哈頓距離"), ("b", "使用勾股定理 <code>Math.sqrt(dx*dx + dy*dy)</code> 計算歐幾里得距離"), ("c", "使用 <code>Math.max(Math.abs(dx), Math.abs(dy))</code> 計算切比雪夫距離")],
            "ans": "b", "explain": "正確！歐幾里得距離（勾股定理）能精確計算二維平面上兩點之間的直線距離。在搖桿中，<code>dx</code> 和 <code>dy</code> 分別為操控頭到圓心的水平與垂直偏移量。",
        },
        {
            "q": "2. 「圓形限位（Clamping）」的作用是什麼？當操控頭被拖出底盤範圍時，系統應如何處理？",
            "opts": [("a", "直接忽略超出範圍的觸控事件"), ("b", "將操控頭的位置限制在底盤半徑內，使用比例縮放公式 <code>(R/d) * dx</code> 將座標投影回圓周上"), ("c", "讓操控頭自由移動，不設任何限制")],
            "ans": "b", "explain": "正確！當手指超出底盤範圍時，操控頭應被「鉗制」在圓周邊界上。透過 <code>(R/d)</code> 比例縮放，操控頭會沿著手指方向停在圓周上，既保留方向資訊又限制最大推力。",
        },
        {
            "q": "3. <code>Math.atan2(dy, dx)</code> 相比 <code>Math.atan(dy/dx)</code> 的主要優勢是什麼？",
            "opts": [("a", "<code>atan2</code> 的計算速度更快"), ("b", "<code>atan2</code> 能正確區分四個象限（360度），且不會因為 dx 為 0 而產生除零錯誤"), ("c", "<code>atan2</code> 回傳的單位是角度而非弧度")],
            "ans": "b", "explain": "正確！<code>Math.atan()</code> 只能回傳 -90° 到 90° 的範圍，無法區分第二、三象限。<code>Math.atan2(dy, dx)</code> 能回傳完整的 -π 到 π 範圍，且自動處理 dx=0 的邊界情況。",
        },
        {
            "q": "4. 搖桿的「推力百分比（Power）」是如何歸一化到 0~100% 的？",
            "opts": [("a", "直接使用觸控點的螢幕座標除以螢幕寬度"), ("b", "將操控頭到圓心的距離除以底盤半徑，再用 <code>Math.min()</code> 限制最大值為 1.0"), ("c", "使用 CSS 的 <code>transform: scale()</code> 自動計算")],
            "ans": "b", "explain": "正確！推力計算公式為 <code>Power = Math.min(distance / R, 1.0)</code>。距離越遠推力越大，但透過 <code>Math.min()</code> 確保不會超過 100%。",
        },
    ],
    "start-05-unit-touch-vs-mouse.html": [
        {
            "q": "1. 為什麼在行動裝置上，<code>click</code> 事件會比 <code>touchstart</code> 慢約 300 毫秒？",
            "opts": [("a", "因為 <code>click</code> 事件的程式碼比 <code>touchstart</code> 更複雜"), ("b", "因為瀏覽器需要等待 300ms 來判斷使用者是否想執行「雙擊縮放」"), ("c", "因為行動裝置的處理器速度較慢")],
            "ans": "b", "explain": "正確！行動瀏覽器的 300ms 延遲源自雙擊縮放（Double-tap to Zoom）的判定邏輯。瀏覽器需要等待確認使用者不是在雙擊後，才會觸發 <code>click</code> 事件。",
        },
        {
            "q": "2. 什麼是「幽靈點擊（Ghost Click）」問題？",
            "opts": [("a", "使用者沒有觸碰螢幕，但瀏覽器自動觸發了一個隨機的點擊事件"), ("b", "在處理完 <code>touchend</code> 後約 300ms，瀏覽器會再額外觸發一個 <code>click</code> 事件，導致操作被執行兩次"), ("c", "當網頁載入過慢時，使用者的點擊被延遲處理的現象")],
            "ans": "b", "explain": "正確！當你在 <code>touchstart</code> 中處理了操作後，瀏覽器仍會在 300ms 後產生一個 <code>click</code> 事件。若兩者都綁定了處理函式，操作會被重複執行。",
        },
        {
            "q": "3. 要讓一個控制元件同時支援觸控和滑鼠操作，最佳的實作策略是什麼？",
            "opts": [("a", "只監聽 <code>click</code> 事件，因為它同時支援觸控和滑鼠"), ("b", "分別監聽 Touch 和 Mouse 事件，並使用旗標或 <code>preventDefault()</code> 防止重複觸發"), ("c", "偵測裝置類型，觸控裝置只綁定 Touch 事件，桌機只綁定 Mouse 事件")],
            "ans": "b", "explain": "正確！最穩健的做法是同時監聽兩套事件系統，並透過在 <code>touchstart</code> 中呼叫 <code>preventDefault()</code> 來阻止後續的 Mouse 事件產生。",
        },
        {
            "q": "4. 封裝一個 <code>getPosition(e)</code> 萬用座標提取函式的目的是什麼？",
            "opts": [("a", "減少程式碼的總行數以提升執行速度"), ("b", "統一處理觸控與滑鼠的座標提取邏輯，讓業務程式碼不需關心輸入來源"), ("c", "將座標從像素轉換為百分比以適應不同解析度")],
            "ans": "b", "explain": "正確！觸控事件的座標存在 <code>e.touches[0].clientX</code>，滑鼠事件則在 <code>e.clientX</code>。封裝為統一函式後，上層控制邏輯只需呼叫一個函式即可取得座標。",
        },
    ],
}


def make_quiz_html(page_id, questions, prev_id, total_pages):
    q_blocks = []
    for i, q in enumerate(questions, 1):
        opts = "\n".join(
            f'                        <label class="quiz-option"><input type="radio" name="q{i}" value="{v}"> {t}</label>'
            for v, t in q["opts"]
        )
        q_blocks.append(f"""
                    <div class="quiz-question">
                        <p>{q["q"]}</p>
{opts}
                        <div class="quiz-feedback" id="q{i}-feedback"></div>
                    </div>""")

    return f"""
        <!-- ══════════ PAGE {page_id}: QUIZ ══════════ -->
        <div class="ms-unit-page" id="page-{page_id}">
            <div class="unit-content">
                <div class="unit-status-bar">
                    <div class="unit-completed-badge" id="badge-{page_id}" style="display:none"><i class="fas fa-check"></i> 已完成</div>
                    <div></div>
                    <div class="unit-time-badge"><i class="far fa-clock"></i>&nbsp; 4 分鐘</div>
                </div>

                <h1>知識測驗</h1>
                <p>為每個問題選出最佳答案，確認你對本模組的理解。</p>

                <div id="quiz-form">
{"".join(q_blocks)}

                    <div class="quiz-submit">
                        <button class="ms-btn" onclick="submitQuiz()">提交答案</button>
                        <button class="ms-btn-ghost" onclick="resetQuiz()" id="quiz-reset-btn" style="margin-left:8px; display:none;">重新作答</button>
                    </div>
                    <div id="quiz-score" style="display:none; margin-top:16px; padding:16px; background:#f3f2f1; border-radius:4px; font-size:14px;"></div>
                </div>
            </div>
            <div class="unit-nav">
                <button class="nav-btn-prev" onclick="goToUnit({prev_id})">‹ &nbsp;上一個單元</button>
                <span class="unit-page-indicator">{page_id} / {total_pages}</span>
                <button class="nav-btn-next" onclick="markDone({page_id}); goToUnit({page_id + 1})">下一個單元 &nbsp;›</button>
            </div>
        </div>

"""


def make_quiz_js(questions):
    ans = ", ".join(f"q{i}: '{q['ans']}'" for i, q in enumerate(questions, 1))
    exps = []
    for i, q in enumerate(questions, 1):
        e = q["explain"].replace("'", "\\'")
        exps.append(f"        q{i}: {{ {q['ans']}: '{e}' }}")
    return f"""
    const QUIZ_ANSWERS = {{ {ans} }};
    const QUIZ_EXPLANATIONS = {{
{chr(44).join(exps) + ','}
    }};"""


QUIZ_FUNCS = r"""
    /* ─── QUIZ ─── */
    function submitQuiz() {
        let correct = 0;
        const total = Object.keys(QUIZ_ANSWERS).length;
        let allAnswered = true;

        for (const [qid, answer] of Object.entries(QUIZ_ANSWERS)) {
            const selected = document.querySelector(`input[name="${qid}"]:checked`);
            if (!selected) { allAnswered = false; continue; }
            const val = selected.value;
            const feedbackEl = document.getElementById(`${qid}-feedback`);
            document.querySelectorAll(`input[name="${qid}"]`).forEach(opt => {
                opt.disabled = true;
                if (opt.value === answer) opt.parentElement.classList.add('correct');
                if (opt.checked && opt.value !== answer) opt.parentElement.classList.add('wrong');
            });
            if (val === answer) {
                correct++;
                feedbackEl.className = 'quiz-feedback correct';
                feedbackEl.textContent = '✓ ' + QUIZ_EXPLANATIONS[qid][answer];
            } else {
                feedbackEl.className = 'quiz-feedback wrong';
                feedbackEl.textContent = '✗ 不正確。' + QUIZ_EXPLANATIONS[qid][answer];
            }
        }

        if (!allAnswered) { alert('請回答所有問題後再提交。'); return; }

        const scoreEl = document.getElementById('quiz-score');
        const pct = Math.round(correct / total * 100);
        scoreEl.style.display = 'block';
        scoreEl.innerHTML = `<span style="font-size:20px;">${pct >= 75 ? '🎉' : '📖'}</span>
            <strong style="margin-left:8px;">你答對了 ${correct} / ${total} 題（${pct}%）</strong>
            <div style="margin-top:6px; color:#605e5c;">${pct >= 75 ? '通過！繼續前往下一個單元。' : '建議回顧相關單元後再試一次。'}</div>`;

        document.querySelector('.quiz-submit .ms-btn').disabled = true;
        document.getElementById('quiz-reset-btn').style.display = 'inline-block';
    }

    function resetQuiz() {
        document.querySelectorAll('.quiz-option').forEach(el => el.classList.remove('correct','wrong'));
        document.querySelectorAll('input[type=radio]').forEach(el => { el.checked = false; el.disabled = false; });
        document.querySelectorAll('.quiz-feedback').forEach(el => { el.className = 'quiz-feedback'; el.textContent = ''; });
        document.getElementById('quiz-score').style.display = 'none';
        document.querySelector('.quiz-submit .ms-btn').disabled = false;
        document.getElementById('quiz-reset-btn').style.display = 'none';
    }

"""

QUIZ_CSS = """
        /* Quiz */
        .quiz-question { margin-bottom: 32px; }
        .quiz-question p { font-size: 15px; font-weight: 500; margin-bottom: 14px; }
        .quiz-option {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px 14px; border: 1px solid #e1dfdd; border-radius: 4px;
            margin-bottom: 8px; cursor: pointer; transition: background .1s, border-color .1s; font-size: 14px;
        }
        .quiz-option:hover { background: #f3f2f1; border-color: #c8c6c4; }
        .quiz-option input[type=radio] { margin-top: 2px; accent-color: var(--ms-blue); flex-shrink: 0; }
        .quiz-option.correct { background: #dff6dd; border-color: var(--ms-green); }
        .quiz-option.wrong { background: #fde7e9; border-color: var(--ms-red); }
        .quiz-feedback { display: none; margin-top: 8px; padding: 10px 14px; border-radius: 4px; font-size: 13px; font-weight: 500; }
        .quiz-feedback.correct { background: #dff6dd; color: #107c10; display: block; }
        .quiz-feedback.wrong { background: #fde7e9; color: #d13438; display: block; }
"""


def process_file(filename, questions):
    filepath = os.path.join(BASE, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Determine summary page id from UNITS array
    ids = [int(x) for x in re.findall(r'\{\s*id:\s*(\d+)', content[:content.find('];', content.find('const UNITS')) + 2] if 'const UNITS' in content else content)]
    summary_id = max(ids)
    quiz_id = summary_id       # Quiz takes the old summary's slot
    new_summary_id = summary_id + 1
    new_total = new_summary_id  # page indicator denominator

    print(f"  summary={summary_id} -> quiz={quiz_id}, new_summary={new_summary_id}")

    # ── Step 0: Add quiz CSS if missing ──
    if '.quiz-question' not in content:
        content = content.replace('</style>', QUIZ_CSS + '    </style>', 1)

    # ── Step 1: Rename summary page (before inserting quiz) ──
    # 1a. Rename the page div id
    content = content.replace(f'id="page-{summary_id}"', f'id="page-{new_summary_id}"', 1)
    # 1b. Rename badge id
    content = content.replace(f'id="badge-{summary_id}"', f'id="badge-{new_summary_id}"', 1)

    # 1c. Update summary's prev button: goToUnit(summary_id-1) -> goToUnit(quiz_id)
    # Find the summary section and update its nav
    summ_pos = content.find(f'id="page-{new_summary_id}"')
    if summ_pos >= 0:
        # Find the unit-nav within the summary section
        nav_start = content.find('class="unit-nav"', summ_pos)
        if nav_start >= 0:
            nav_end = content.find('</div>', nav_start + 100) + 6
            nav_section = content[nav_start:nav_end]
            # Update prev button
            nav_section = nav_section.replace(f'goToUnit({summary_id - 1})', f'goToUnit({quiz_id})')
            # Update markDone
            nav_section = nav_section.replace(f'markDone({summary_id})', f'markDone({new_summary_id})')
            content = content[:nav_start] + nav_section + content[nav_end:]

    # ── Step 2: Insert quiz page HTML before (renamed) summary page ──
    # Find the summary page position (now renamed to new_summary_id)
    summ_div_pos = content.find(f'id="page-{new_summary_id}"')
    if summ_div_pos < 0:
        print(f"  ERROR: Cannot find summary page div")
        return

    # Walk backwards to find the start of this div tag or its comment
    insert_at = content.rfind('<', 0, summ_div_pos)
    # Check if there's a comment line above
    line_start = content.rfind('\n', 0, insert_at)
    if line_start >= 0:
        prev_line = content[line_start:insert_at].strip()
        if prev_line.startswith('<!--'):
            insert_at = line_start + 1

    quiz_html = make_quiz_html(quiz_id, questions, quiz_id - 1, new_total)
    content = content[:insert_at] + quiz_html + content[insert_at:]

    # ── Step 3: Update all page indicators ──
    old_total = summary_id  # was "X / {summary_id}"
    content = re.sub(
        rf'(<span class="unit-page-indicator">)(\d+) / {old_total}(</span>)',
        lambda m: f'{m.group(1)}{m.group(2)} / {new_total}{m.group(3)}',
        content
    )

    # ── Step 4: Update UNITS array ──
    # Find the summary entry and insert quiz before it, also rename summary id
    summ_entry = re.search(
        r"^(\s*)\{\s*id:\s*" + str(summary_id) + r",\s*label:\s*'摘要與資源'.*$",
        content, re.MULTILINE
    )
    if summ_entry:
        indent = summ_entry.group(1)
        old_line = summ_entry.group(0)
        new_line = old_line.replace(f'id: {summary_id},', f'id: {new_summary_id},')
        quiz_line = f"{indent}{{ id: {quiz_id}, label: '知識測驗',              time: '4 分鐘',  type: 'quiz'  }},"
        content = content[:summ_entry.start()] + quiz_line + "\n" + new_line + content[summ_entry.end():]
    else:
        print(f"  WARNING: Could not find summary UNITS entry")

    # ── Step 5: Add quiz badge to sidebar ──
    if "u.type === 'quiz'" not in content:
        quiz_badge = """u.type === 'quiz' ? ' <span style="font-size:10px;background:#fff4ce;color:#8a6914;padding:1px 5px;border-radius:2px;">測驗</span>'"""

        # Single-line pattern: ... 'LAB</span>' : '';
        m = re.search(r"(const badge = u\.type === 'lab' \? '.*?LAB<\/span>') : '';", content)
        if m:
            old = m.group(0)
            # Get indentation for alignment
            line_start = content.rfind('\n', 0, m.start()) + 1
            col = m.start() - line_start
            pad = ' ' * (col + len('const badge = '))
            new = m.group(1) + "\n" + pad + ": " + quiz_badge + "\n" + pad + ": '';"
            content = content.replace(old, new, 1)
        else:
            # Multi-line pattern: ... 'LAB</span>'\n                        : '';
            m2 = re.search(r"(const badge = u\.type === 'lab' \? '.*?LAB<\/span>')\s*\n(\s*): '';", content)
            if m2:
                old = m2.group(0)
                indent = m2.group(2)
                new = m2.group(1) + "\n" + indent + ": " + quiz_badge + "\n" + indent + ": '';"
                content = content.replace(old, new, 1)

    # ── Step 6: Add QUIZ_ANSWERS/EXPLANATIONS after UNITS ──
    if 'QUIZ_ANSWERS' not in content:
        units_start = content.find('const UNITS')
        units_end = content.find('];', units_start)
        if units_end >= 0:
            pos = units_end + 2
            content = content[:pos] + "\n" + make_quiz_js(questions) + "\n" + content[pos:]

    # ── Step 7: Add submitQuiz/resetQuiz functions ──
    if 'function submitQuiz' not in content:
        # Find the START comment or init() call
        m = re.search(r'/\*\s*\S+\s*START\s*\S+\s*\*/', content)
        if m:
            pos = m.start()
        else:
            m2 = re.search(r'^\s*init\(\);', content, re.MULTILINE)
            if m2:
                pos = m2.start()
            else:
                # Last resort: insert before the closing </script>
                pos = content.rfind('</script>')
        if pos >= 0:
            content = content[:pos] + QUIZ_FUNCS + content[pos:]

    # ── Step 8: Update unit counts ──
    old_count = summary_id + 1
    new_count = new_summary_id + 1

    # Sidebar meta "X 個單元"
    content = content.replace(f'{old_count} 個單元', f'{new_count} 個單元')

    # Progress text "0 / X 已完成"
    content = content.replace(f'0 / {old_count - 1} 已完成', f'0 / {new_count - 1} 已完成')

    # Module meta tags
    content = re.sub(
        rf'(<span class="ms-tag">){old_count} 個單元(</span>)',
        rf'\g<1>{new_count} 個單元\2',
        content
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✓ Done: {filename}")


if __name__ == "__main__":
    for fn, qs in QUIZ_DATA.items():
        print(f"\n{fn}")
        try:
            process_file(fn, qs)
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback; traceback.print_exc()
