/**
 * 本地模擬器種子資料腳本
 * 用途：將課程元資料寫入本地 Firestore 模擬器
 * 執行：cd functions && node scripts/seed-emulator.js
 */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ projectId: 'e-learning-942f7' });
const db = getFirestore(app);

// metadata_lessons 種子資料
// courseId 需與各頁面的 data-course-id 一致
// 渲染所需欄位：courseId, title, price, category, courseUnits, orderWeight,
//   isPhysical, lessonLabel, icon, tagText, duration, coreContent, classroomUrl, videoId
const courses = [
  // ─── prepare ───
  {
    id: 'prepare-01-identity',
    courseId: 'master-identity-free',
    title: '開發者身分 (Developer Identity)',
    lessonLabel: '準備課程 01', icon: '🆔', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-01-developer-identity.html'],
    coreContent: ['GitHub 帳號建立', '個人 Profile 設定', 'SSH Key 設定'],
    orderWeight: 1, isPhysical: false,
  },
  {
    id: 'prepare-02-vscode-online',
    courseId: 'master-online-free',
    title: 'VS Code Online',
    lessonLabel: '準備課程 02', icon: '🌐', tagText: '免費', duration: '20 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-02-vscode-online.html'],
    coreContent: ['GitHub Codespaces 啟用', '線上編輯器操作', '即開即用開發環境'],
    orderWeight: 2, isPhysical: false,
  },
  {
    id: 'prepare-03-vscode-setup',
    courseId: 'master-vscode-free',
    title: '開發環境 (VS Code Setup)',
    lessonLabel: '準備課程 03', icon: '💻', tagText: '免費', duration: '40 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-03-vscode-setup.html'],
    coreContent: ['VS Code 安裝與設定', '常用擴充套件', 'Terminal 基本操作'],
    orderWeight: 3, isPhysical: false,
  },
  {
    id: 'prepare-04-agent-mode',
    courseId: 'prepare-04.html',
    title: 'AI Agent 模式實務',
    lessonLabel: '準備課程 04', icon: '🤖', tagText: '免費', duration: '35 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-04-agent-mode.html'],
    coreContent: ['Cursor Agent Mode', 'AI 輔助程式開發', '提示工程基礎'],
    orderWeight: 4, isPhysical: false,
  },
  {
    id: 'prepare-05-vibe-coding',
    courseId: 'prepare-05.html',
    title: 'Vibe Coding 實戰',
    lessonLabel: '準備課程 05', icon: '🎵', tagText: '免費', duration: '45 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-05-vibe-coding.html'],
    coreContent: ['Vibe Coding 方法論', '快速原型開發', 'AI 驅動開發流程'],
    orderWeight: 5, isPhysical: false,
  },
  {
    id: 'prepare-06-web-agents',
    courseId: 'prepare-06.html',
    title: '網頁版 AI 代理人實務',
    lessonLabel: '準備課程 06', icon: '🌍', tagText: '免費', duration: '30 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-06-web-agents.html'],
    coreContent: ['ChatGPT / Claude 實務', '網頁版 AI 工具比較', '提示工程進階技巧'],
    orderWeight: 6, isPhysical: false,
  },
  {
    id: 'prepare-07-github-classroom',
    courseId: 'github-classroom-free',
    title: 'GitHub Classroom & Vibe Coding 實務',
    lessonLabel: '準備課程 07', icon: '📚', tagText: '免費', duration: '25 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-07-github-classroom.html'],
    coreContent: ['GitHub Classroom 加入流程', '作業繳交方式', '自動評分系統'],
    orderWeight: 7, isPhysical: false,
  },
  {
    id: 'prepare-08-09-wifi-motor',
    courseId: 'cvhofqxc',
    title: 'WiFi 組態 & 馬達 Ramping',
    lessonLabel: '準備課程 08-09', icon: '📡', tagText: '免費', duration: '50 分鐘',
    price: 0, category: 'prepare',
    courseUnits: ['prepare-08-motor-ramping.html', 'prepare-09-wifi-setup.html'],
    coreContent: ['ESP32 WiFi 連線設定', '馬達 Ramping 控制', '硬體初始化流程'],
    orderWeight: 8, isPhysical: false,
  },

  // ─── started (入門課程：Web App 遙控器設計與 Web BLE 整合) ───
  {
    id: 'start-01-web-app',
    courseId: 'start-01-master-web-app.html',
    title: 'Web App 基礎開發',
    lessonLabel: '入門 01', icon: '📱', tagText: '入門', duration: '2 小時',
    price: 990, category: 'start',
    courseUnits: ['start-01-unit-html5-basics.html', 'start-01-unit-flexbox-layout.html', 'start-01-unit-ui-ux-standards.html'],
    coreContent: ['HTML5 基礎結構', 'Flexbox 版面佈局', 'UI/UX 設計標準'],
    classroomUrl: '/courses/start-01-master-web-app.html',
    orderWeight: 10, isPhysical: false,
  },
  {
    id: 'start-02-web-ble',
    courseId: 'start-02-master-web-ble.html',
    title: 'Web BLE 藍牙整合',
    lessonLabel: '入門 02', icon: '📶', tagText: '入門', duration: '2.5 小時',
    price: 990, category: 'start',
    courseUnits: ['start-02-unit-ble-async.html', 'start-02-unit-ble-security.html', 'start-02-unit-typed-arrays.html'],
    coreContent: ['BLE 非同步連線', 'BLE 安全機制', 'TypedArray 資料處理'],
    classroomUrl: '/courses/start-02-master-web-ble.html',
    orderWeight: 11, isPhysical: false,
  },
  {
    id: 'start-03-remote-control',
    courseId: 'start-03-master-remote-control.html',
    title: '遙控器介面實作',
    lessonLabel: '入門 03', icon: '🎮', tagText: '入門', duration: '2 小時',
    price: 990, category: 'start',
    courseUnits: ['start-03-unit-control-panel.html', 'start-03-unit-data-json.html', 'start-03-unit-flow-logic.html'],
    coreContent: ['控制面板設計', 'JSON 資料交換', '流程邏輯設計'],
    classroomUrl: '/courses/start-03-master-remote-control.html',
    orderWeight: 12, isPhysical: false,
  },
  {
    id: 'start-04-touch-events',
    courseId: 'start-04-master-touch-events.html',
    title: '觸控事件處理',
    lessonLabel: '入門 04', icon: '👆', tagText: '入門', duration: '2 小時',
    price: 990, category: 'start',
    courseUnits: ['start-04-unit-touch-basics.html', 'start-04-unit-prevent-default.html', 'start-04-unit-long-press.html'],
    coreContent: ['觸控基礎事件', 'preventDefault 應用', '長按事件實作'],
    classroomUrl: '/courses/start-04-master-touch-events.html',
    orderWeight: 13, isPhysical: false,
  },
  {
    id: 'start-05-joystick-lab',
    courseId: 'start-05-master-joystick-lab.html',
    title: '搖桿實驗室',
    lessonLabel: '入門 05', icon: '🕹️', tagText: '入門', duration: '2.5 小時',
    price: 990, category: 'start',
    courseUnits: ['start-05-unit-canvas-joystick.html', 'start-05-unit-joystick-math.html', 'start-05-unit-touch-vs-mouse.html'],
    coreContent: ['Canvas 搖桿繪製', '搖桿數學運算', '觸控與滑鼠相容'],
    classroomUrl: '/courses/start-05-master-joystick-lab.html',
    orderWeight: 14, isPhysical: false,
  },

  // ─── basic (基礎課程：馬達控制、通訊與 OTA) ───
  {
    id: 'basic-01-environment',
    courseId: 'basic-01-master-environment.html',
    title: '開發環境建置',
    lessonLabel: '基礎 01', icon: '🔧', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-01-unit-drivers-ports.html', 'basic-01-unit-esp32-architecture.html', 'basic-01-unit-platformio-setup.html'],
    coreContent: ['驅動與連接埠', 'ESP32 架構概覽', 'PlatformIO 設定'],
    classroomUrl: '/courses/basic-01-master-environment.html',
    orderWeight: 20, isPhysical: false,
  },
  {
    id: 'basic-02-ota-architecture',
    courseId: 'basic-02-master-ota-architecture.html',
    title: 'OTA 更新架構',
    lessonLabel: '基礎 02', icon: '🔄', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-02-unit-ota-principles.html', 'basic-02-unit-ota-security.html', 'basic-02-unit-partition-table.html'],
    coreContent: ['OTA 更新原理', 'OTA 安全機制', '分區表設計'],
    classroomUrl: '/courses/basic-02-master-ota-architecture.html',
    orderWeight: 21, isPhysical: false,
  },
  {
    id: 'basic-03-io-mapping',
    courseId: 'basic-03-master-io-mapping.html',
    title: 'IO 腳位對應',
    lessonLabel: '基礎 03', icon: '📌', tagText: '基礎', duration: '1.5 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-03-unit-pinout.html', 'basic-03-unit-adc-resolution.html', 'basic-03-unit-pullup-debounce.html'],
    coreContent: ['腳位配置圖', 'ADC 解析度', '上拉電阻與防彈跳'],
    classroomUrl: '/courses/basic-03-master-io-mapping.html',
    orderWeight: 22, isPhysical: false,
  },
  {
    id: 'basic-04-pwm-control',
    courseId: 'basic-04-master-pwm-control.html',
    title: 'PWM 馬達控制',
    lessonLabel: '基礎 04', icon: '⚙️', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-04-unit-pwm-basics.html', 'basic-04-unit-ledc-syntax.html', 'basic-04-unit-h-bridge.html'],
    coreContent: ['PWM 基礎原理', 'LEDC 語法', 'H 橋電路驅動'],
    classroomUrl: '/courses/basic-04-master-pwm-control.html',
    orderWeight: 23, isPhysical: false,
  },
  {
    id: 'basic-05-ble-gatt',
    courseId: 'basic-05-master-ble-gatt.html',
    title: 'BLE GATT 協定',
    lessonLabel: '基礎 05', icon: '📡', tagText: '基礎', duration: '2.5 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-05-unit-advertising-connection.html', 'basic-05-unit-ble-properties.html', 'basic-05-unit-gatt-structure.html'],
    coreContent: ['廣播與連線', 'BLE 特性值', 'GATT 資料結構'],
    classroomUrl: '/courses/basic-05-master-ble-gatt.html',
    orderWeight: 24, isPhysical: false,
  },
  {
    id: 'basic-06-http-web',
    courseId: 'basic-06-master-http-web.html',
    title: 'HTTP 與 Web 通訊',
    lessonLabel: '基礎 06', icon: '🌐', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-06-unit-http-request.html', 'basic-06-unit-fetch-api.html', 'basic-06-unit-cors-security.html'],
    coreContent: ['HTTP 請求', 'Fetch API', 'CORS 安全機制'],
    classroomUrl: '/courses/basic-06-master-http-web.html',
    orderWeight: 25, isPhysical: false,
  },
  {
    id: 'basic-07-wifi-modes',
    courseId: 'basic-07-master-wifi-modes.html',
    title: 'WiFi 模式與 WebServer',
    lessonLabel: '基礎 07', icon: '📶', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-07-unit-wifi-ap-sta.html', 'basic-07-unit-http-lifecycle.html', 'basic-07-unit-async-webserver.html'],
    coreContent: ['WiFi AP/STA 模式', 'HTTP 生命週期', '非同步 WebServer'],
    classroomUrl: '/courses/basic-07-master-wifi-modes.html',
    orderWeight: 26, isPhysical: false,
  },
  {
    id: 'basic-08-joystick-math',
    courseId: 'basic-08-master-joystick-math.html',
    title: '搖桿數學模型',
    lessonLabel: '基礎 08', icon: '🕹️', tagText: '基礎', duration: '2.5 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-08-unit-joystick-mapping.html', 'basic-08-unit-response-curves.html', 'basic-08-unit-unicycle-model.html'],
    coreContent: ['搖桿映射', '響應曲線', '單輪車模型'],
    classroomUrl: '/courses/basic-08-master-joystick-math.html',
    orderWeight: 27, isPhysical: false,
  },
  {
    id: 'basic-09-multitasking',
    courseId: 'basic-09-master-multitasking.html',
    title: '多工處理',
    lessonLabel: '基礎 09', icon: '⏱️', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-09-unit-millis.html', 'basic-09-unit-hardware-timer.html', 'basic-09-unit-sampling-rate.html'],
    coreContent: ['millis() 計時', '硬體計時器', '取樣率設計'],
    classroomUrl: '/courses/basic-09-master-multitasking.html',
    orderWeight: 28, isPhysical: false,
  },
  {
    id: 'basic-10-fsm',
    courseId: 'basic-10-master-fsm.html',
    title: '有限狀態機',
    lessonLabel: '基礎 10', icon: '🔀', tagText: '基礎', duration: '2 小時',
    price: 990, category: 'basic',
    courseUnits: ['basic-10-unit-fsm.html', 'basic-10-unit-state-consistency.html', 'basic-10-unit-ui-design.html'],
    coreContent: ['FSM 設計模式', '狀態一致性', 'UI 狀態設計'],
    classroomUrl: '/courses/basic-10-master-fsm.html',
    orderWeight: 29, isPhysical: false,
  },

  // ─── advanced (進階課程：影像處理、辨識與 AI) ───
  {
    id: 'adv-01-s3-cam',
    courseId: 'adv-01-master-s3-cam.html',
    title: 'ESP32-S3 攝影機',
    lessonLabel: '進階 01', icon: '📷', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-01-unit-s3-interfaces.html', 'adv-01-unit-mjpeg-stream.html', 'adv-01-unit-jpeg-quality.html'],
    coreContent: ['S3 介面配置', 'MJPEG 串流', 'JPEG 品質調校'],
    classroomUrl: '/courses/adv-01-master-s3-cam.html',
    orderWeight: 30, isPhysical: false,
  },
  {
    id: 'adv-02-video',
    courseId: 'adv-02-master-video.html',
    title: '影像串流技術',
    lessonLabel: '進階 02', icon: '🎬', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-02-unit-video-streaming.html', 'adv-02-unit-canvas-image.html', 'adv-02-unit-bandwidth-fps.html'],
    coreContent: ['影像串流實作', 'Canvas 影像處理', '頻寬與 FPS 優化'],
    classroomUrl: '/courses/adv-02-master-video.html',
    orderWeight: 31, isPhysical: false,
  },
  {
    id: 'adv-03-ble-advanced',
    courseId: 'adv-03-master-ble-advanced.html',
    title: 'BLE 進階通訊',
    lessonLabel: '進階 03', icon: '📡', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-03-unit-ble-notify.html', 'adv-03-unit-ble-mtu.html', 'adv-03-unit-json-serialization.html'],
    coreContent: ['BLE Notify 機制', 'MTU 協商', 'JSON 序列化'],
    classroomUrl: '/courses/adv-03-master-ble-advanced.html',
    orderWeight: 32, isPhysical: false,
  },
  {
    id: 'adv-04-sensors',
    courseId: 'adv-04-master-sensors.html',
    title: '感測器整合',
    lessonLabel: '進階 04', icon: '🔬', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-04-unit-i2c-spi.html', 'adv-04-unit-json-rest.html', 'adv-04-unit-filter-algorithms.html'],
    coreContent: ['I2C/SPI 通訊', 'JSON REST API', '濾波演算法'],
    classroomUrl: '/courses/adv-04-master-sensors.html',
    orderWeight: 33, isPhysical: false,
  },
  {
    id: 'adv-05-cv',
    courseId: 'adv-05-master-cv.html',
    title: '電腦視覺基礎',
    lessonLabel: '進階 05', icon: '👁️', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-05-unit-centroid-error.html', 'adv-05-unit-closed-loop.html', 'adv-05-unit-feature-extraction.html'],
    coreContent: ['重心誤差計算', '閉迴路控制', '特徵提取'],
    classroomUrl: '/courses/adv-05-master-cv.html',
    orderWeight: 34, isPhysical: false,
  },
  {
    id: 'adv-06-cv-advanced',
    courseId: 'adv-06-master-cv-advanced.html',
    title: '電腦視覺進階',
    lessonLabel: '進階 06', icon: '🔍', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-06-unit-hsv-math.html', 'adv-06-unit-threshold-filter.html', 'adv-06-unit-centroid-algorithm.html', 'adv-06-unit-look-ahead.html'],
    coreContent: ['HSV 色彩數學', '閾值濾波', '重心演算法', '前瞻追蹤'],
    classroomUrl: '/courses/adv-06-master-cv-advanced.html',
    orderWeight: 35, isPhysical: false,
  },
  {
    id: 'adv-07-ui-framework',
    courseId: 'adv-07-master-ui-framework.html',
    title: 'UI 框架設計',
    lessonLabel: '進階 07', icon: '🖥️', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-07-unit-ui-framework.html', 'adv-07-unit-chart-canvas.html', 'adv-07-unit-json-parsing.html', 'adv-07-unit-event-polling.html'],
    coreContent: ['UI 框架架構', 'Chart Canvas 圖表', 'JSON 解析', '事件輪詢'],
    classroomUrl: '/courses/adv-07-master-ui-framework.html',
    orderWeight: 36, isPhysical: false,
  },
  {
    id: 'adv-08-image-processing',
    courseId: 'adv-08-master-image-processing.html',
    title: '影像處理實務',
    lessonLabel: '進階 08', icon: '🖼️', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-08-unit-color-spaces.html', 'adv-08-unit-mobilenet-ssd.html', 'adv-08-unit-p-control.html', 'adv-08-unit-error-calculation.html'],
    coreContent: ['色彩空間', 'MobileNet-SSD 模型', 'P 控制', '誤差計算'],
    classroomUrl: '/courses/adv-08-master-image-processing.html',
    orderWeight: 37, isPhysical: false,
  },
  {
    id: 'adv-09-ai-recognition',
    courseId: 'adv-09-master-ai-recognition.html',
    title: 'AI 辨識應用',
    lessonLabel: '進階 09', icon: '🧠', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-09-unit-teachable-machine.html', 'adv-09-unit-cnn-audio.html', 'adv-09-unit-webspeech-api.html', 'adv-09-unit-flow-control.html'],
    coreContent: ['Teachable Machine', 'CNN 音訊辨識', 'Web Speech API', '流程控制'],
    classroomUrl: '/courses/adv-09-master-ai-recognition.html',
    orderWeight: 38, isPhysical: false,
  },
  {
    id: 'adv-10-diff-drive',
    courseId: 'adv-10-master-diff-drive.html',
    title: '差速驅動控制',
    lessonLabel: '進階 10', icon: '🚗', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-10-unit-icc-geometry.html', 'adv-10-unit-pwm-limits.html', 'adv-10-unit-api-design.html'],
    coreContent: ['ICC 幾何模型', 'PWM 限制', 'API 設計'],
    classroomUrl: '/courses/adv-10-master-diff-drive.html',
    orderWeight: 39, isPhysical: false,
  },
  {
    id: 'adv-11-photoelectric',
    courseId: 'adv-11-master-photoelectric.html',
    title: '光電感測器',
    lessonLabel: '進階 11', icon: '💡', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-11-unit-sensor-principles.html', 'adv-11-unit-hardware-interrupts.html', 'adv-11-unit-speed-algorithms.html'],
    coreContent: ['感測器原理', '硬體中斷', '測速演算法'],
    classroomUrl: '/courses/adv-11-master-photoelectric.html',
    orderWeight: 40, isPhysical: false,
  },
  {
    id: 'adv-12-pid',
    courseId: 'adv-12-master-pid.html',
    title: 'PID 控制',
    lessonLabel: '進階 12', icon: '📊', tagText: '進階', duration: '3.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-12-unit-pid-math.html', 'adv-12-unit-pid-control.html', 'adv-12-unit-code-logic.html'],
    coreContent: ['PID 數學推導', 'PID 控制實作', '程式邏輯設計'],
    classroomUrl: '/courses/adv-12-master-pid.html',
    orderWeight: 41, isPhysical: false,
  },
  {
    id: 'adv-13-robustness',
    courseId: 'adv-13-master-robustness.html',
    title: '系統穩健性',
    lessonLabel: '進階 13', icon: '🛡️', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-13-unit-robustness.html', 'adv-13-unit-system-perf.html', 'adv-13-unit-technical-narrative.html'],
    coreContent: ['穩健性設計', '系統效能分析', '技術敘事'],
    classroomUrl: '/courses/adv-13-master-robustness.html',
    orderWeight: 42, isPhysical: false,
  },
  {
    id: 'adv-14-debugging-art',
    courseId: 'adv-14-master-debugging-art.html',
    title: '除錯的藝術',
    lessonLabel: '進階 14', icon: '🐛', tagText: '進階', duration: '2.5 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-14-unit-debugging-art.html', 'adv-14-unit-kpi-definition.html', 'adv-14-unit-refactoring.html'],
    coreContent: ['除錯技巧', 'KPI 定義', '重構方法論'],
    classroomUrl: '/courses/adv-14-master-debugging-art.html',
    orderWeight: 43, isPhysical: false,
  },
  {
    id: 'adv-15-architecture',
    courseId: 'adv-15-master-architecture.html',
    title: '系統架構設計',
    lessonLabel: '進階 15', icon: '🏗️', tagText: '進階', duration: '3 小時',
    price: 1490, category: 'advanced',
    courseUnits: ['adv-15-unit-data-flow.html', 'adv-15-unit-ble-async.html', 'adv-15-unit-image-dma.html', 'adv-15-unit-pid-simulation.html'],
    coreContent: ['資料流設計', 'BLE 非同步架構', '影像 DMA', 'PID 模擬'],
    classroomUrl: '/courses/adv-15-master-architecture.html',
    orderWeight: 44, isPhysical: false,
  },
];

const TEST_USER_UID = 'ZONzbNOyljRgSA11qKgnT4nJFRnv';
const TEST_USER_EMAIL = 'chen.yuiliang@gmail.com';

async function seed() {
  console.log('🌱 開始寫入種子資料到本地 Firestore 模擬器...\n');

  for (const course of courses) {
    const { id, ...data } = course;
    await db.collection('metadata_lessons').doc(id).set(data);
    console.log(`  ✅ ${id} (courseId: ${data.courseId})`);
  }

  // Seed user document
  await db.collection('users').doc(TEST_USER_UID).set({
    email: TEST_USER_EMAIL,
    role: 'user',
    createdAt: admin.firestore.Timestamp.now(),
  }, { merge: true });
  console.log(`\n  👤 使用者 ${TEST_USER_EMAIL} (uid: ${TEST_USER_UID})`);

  // Seed orders for basic + advanced courses
  const paidCourses = courses.filter(c => c.category === 'basic' || c.category === 'advanced');
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const items = {};
  for (const c of paidCourses) {
    items[c.courseId] = { title: c.title, price: c.price };
  }

  await db.collection('orders').doc('seed-order-all-paid').set({
    uid: TEST_USER_UID,
    email: TEST_USER_EMAIL,
    status: 'SUCCESS',
    items,
    expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
    createdAt: admin.firestore.Timestamp.now(),
    paidAt: admin.firestore.Timestamp.now(),
  });
  console.log(`  🧾 訂單 seed-order-all-paid (${paidCourses.length} 門課程，到期 ${expiryDate.toLocaleDateString('zh-TW')})`);

  console.log(`\n✨ 完成！共寫入 ${courses.length} 筆課程資料`);
  console.log('📌 可在 http://127.0.0.1:4000/firestore 查看資料');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 種子資料寫入失敗：', err);
  process.exit(1);
});
