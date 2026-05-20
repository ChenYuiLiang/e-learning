const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const functionsV1 = require("firebase-functions/v1");

// Load .env explicitly if not in production/deploy environment or as backup
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * [V12.0.9] HELPER: Compare two unit IDs with fallback for .html suffix
 */
function unitIdsMatch(idA, idB) {
    if (!idA || !idB) return false;
    const cleanA = idA.toString().replace('.html', '').toLowerCase();
    const cleanB = idB.toString().replace('.html', '').toLowerCase();
    return cleanA === cleanB;
}
const {
    sendWelcomeEmail, sendPaymentSuccessEmail, sendTrialExpiringEmail, sendCourseExpiringEmail,
    sendAssignmentNotification, sendTutorAuthorizationEmail, sendGradingNotification,
    sendStudentLinkedToTutorEmail, sendTutorLinkedToStudentEmail, sendAdminAssignmentReminder,
    sendAdminNewApplicationEmail, sendApplicationResultEmail,
    sendAutogradeResultToStudent, sendAutogradeResultToTutor, sendOrderShippedEmail,
    sendTutorRecommendationCandidateEmail, sendAutogradeFailureAlertEmail
} = require('./emailService');

admin.initializeApp({
    projectId: "e-learning-942f7"
});
const db = admin.firestore();

function normalizeLegacyId(value) {
    return value;
}

// ==========================================
// Firebase Functions V2 全域設定
// ==========================================
setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    minInstances: 0,
    memory: 256,
    concurrency: 80 // V2 feature: multiple requests per instance
});


// ==========================================
// 從 .env 讀取環境變數
// ==========================================
// 這些變數會自動從 functions/.env 檔案中讀取
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const ECPAY_API_URL = process.env.ECPAY_API_URL;
const ECPAY_LOGISTICS_MAP_URL = process.env.ECPAY_LOGISTICS_MAP_URL;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const GITHUB_CLASSROOM_ORG = process.env.GITHUB_CLASSROOM_ORG || "vibe-coding-classroom";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";

const REGION = "asia-east1";
// 為了避免專案 ID 寫死，我們也可以動態抓取，或者您保留原本寫死的字串
const PROJECT_ID = JSON.parse(process.env.FIREBASE_CONFIG).projectId || "e-learning-942f7";

// 簡單檢查：確保環境變數有設定，避免部署後才發現是空的
if (!MERCHANT_ID || !HASH_KEY || !HASH_IV || !ECPAY_API_URL) {
    console.error("錯誤：未讀取到綠界設定，請檢查 functions/.env 檔案！");
}

// ==========================================
// 工具函式：計算 CheckMacValue (保持不變)
// ==========================================
function generateCheckMacValue(params, hashKey, hashIV, encType = 'sha256') {
    const filteredParams = {};
    Object.keys(params).forEach(key => {
        if (key !== 'CheckMacValue' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            filteredParams[key] = params[key];
        }
    });

    const sortedKeys = Object.keys(filteredParams).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    let rawString = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
    rawString = `HashKey=${hashKey}&${rawString}&HashIV=${hashIV}`;

    let encodedString = encodeURIComponent(rawString).toLowerCase();
    encodedString = encodedString
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%20/g, '+');

    return crypto.createHash(encType).update(encodedString).digest('hex').toUpperCase();
}

function getCurrentTime() {
    const now = new Date();
    const offset = 8; // UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));
    return `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
}

async function githubApiRequest(pathname, options = {}) {
    if (!GITHUB_ORG_ADMIN_TOKEN) {
        throw new Error("GITHUB_ORG_ADMIN_TOKEN is missing");
    }
    const url = `https://api.github.com${pathname}`;
    const headers = {
        "Authorization": `Bearer ${GITHUB_ORG_ADMIN_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
    };
    const resp = await fetch(url, { ...options, headers });
    let body = null;
    try {
        body = await resp.json();
    } catch (_) {
        body = null;
    }
    return { ok: resp.ok, status: resp.status, body };
}

async function upsertGithubActionsVariable({ owner, repo, name, value }) {
    if (!owner || !repo || !name) return { ok: false, reason: "missing_params" };
    if (!GITHUB_ORG_ADMIN_TOKEN) return { ok: false, reason: "missing_token" };

    const body = { name, value: String(value ?? "") };
    const resp = await githubApiRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/variables/${encodeURIComponent(name)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: body.value })
        }
    );
    if (resp.ok) return { ok: true, action: "updated" };
    if (resp.status === 404) {
        const createResp = await githubApiRequest(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/variables`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );
        if (createResp.ok) return { ok: true, action: "created" };
        return { ok: false, status: createResp.status, body: createResp.body };
    }
    return { ok: false, status: resp.status, body: resp.body };
}

async function resolveGithubLoginFromFirebaseUid(firebaseUid) {
    const userRecord = await admin.auth().getUser(firebaseUid);
    const provider = (userRecord.providerData || []).find(p => p.providerId === "github.com");
    if (!provider || !provider.uid) {
        return { githubProviderUid: null, githubLogin: null };
    }

    const providerUid = String(provider.uid);
    const userResp = await githubApiRequest(`/user/${encodeURIComponent(providerUid)}`);
    if (!userResp.ok || !userResp.body || !userResp.body.login) {
        return { githubProviderUid: providerUid, githubLogin: null };
    }
    return { githubProviderUid: providerUid, githubLogin: String(userResp.body.login) };
}

async function ensureGithubOrgMembership({ firebaseUid, org = GITHUB_CLASSROOM_ORG }) {
    const { githubProviderUid, githubLogin } = await resolveGithubLoginFromFirebaseUid(firebaseUid);
    if (!githubProviderUid || !githubLogin) {
        return { ok: false, state: "missing_github_identity", githubLogin: null, inviteSent: false, org };
    }

    const membershipResp = await githubApiRequest(`/orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(githubLogin)}`);
    if (membershipResp.ok && membershipResp.body) {
        const state = String(membershipResp.body.state || "").toLowerCase();
        if (state === "active") {
            return { ok: true, state: "active", githubLogin, inviteSent: false, org };
        }
        if (state === "pending") {
            return { ok: false, state: "pending", githubLogin, inviteSent: false, org };
        }
    }

    // If not found / not active, attempt to invite
    let inviteSent = false;
    let inviteId = null;
    const inviteResp = await githubApiRequest(`/orgs/${encodeURIComponent(org)}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitee_id: Number(githubProviderUid), role: "direct_member" })
    });
    if (inviteResp.ok && inviteResp.body) {
        inviteSent = true;
        inviteId = inviteResp.body.id || null;
    }

    return {
        ok: false,
        state: inviteSent ? "invited" : "not_member",
        githubLogin,
        inviteSent,
        inviteId,
        org
    };
}

function extractHiddenSectionContent(html, sectionId) {
    if (!html || !sectionId) return "";

    const openTagRegex = new RegExp(`<section\\b[^>]*\\bid=["']${sectionId}["'][^>]*>`, 'i');
    const openMatch = openTagRegex.exec(html);
    if (!openMatch) return "";

    const sectionStart = openMatch.index;
    const tagContentStart = sectionStart + openMatch[0].length;
    
    let depth = 1;
    const sectionTagRegex = /<\/?section\b[^>]*>/gi;
    sectionTagRegex.lastIndex = tagContentStart; 

    let match;
    while ((match = sectionTagRegex.exec(html)) !== null) {
        const tag = match[0];
        if (!tag.startsWith('</')) {
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                return html.slice(tagContentStart, match.index).trim();
            }
        }
    }

    return "";
}

// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log("收到 initiatePayment 請求 (.env mode)");

        const requestData = req.body.data || req.body || {};
        const {
            amount,
            returnUrl,
            cartDetails,
            logistics,
            referralLink = '',
            referredTutorEmail = '',
            promoCode = '',
            referralTutor = ''
        } = requestData;

        // 簡易 Token 驗證
        let uid = "GUEST";
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                uid = decodedToken.uid;
            } catch (e) {
                console.warn("Token 驗證略過:", e.message);
            }
        }

        const finalAmount = parseInt(amount, 10) || 100;
        const orderNumber = `VIBE${Date.now()}`;
        const tradeDate = getCurrentTime();

        const lessons = await getLessons();
        const normalizedItems = normalizeOrderItems(
            cartDetails || {},
            referralLink || promoCode,
            referredTutorEmail || referralTutor,
            lessons
        );

        // Guardrail: physical-product orders must include complete logistics info.
        const physicalUnitIds = new Set(lessons.filter(l => l.isPhysical === true).map(l => l.id));
        const hasPhysicalItem = Object.keys(normalizedItems || {}).some(id => {
            const canonicalId = normalizeLegacyId(id);
            const itemData = normalizedItems[id] || {};
            if (itemData.isPhysical === true) return true;
            return physicalUnitIds.has(canonicalId) || physicalUnitIds.has(id);
        });

        if (hasPhysicalItem) {
            const logisticsPayload = (logistics && typeof logistics === 'object') ? logistics : {};
            const receiverName = String(logisticsPayload.receiverName || logisticsPayload.ReceiverName || '').trim();
            const receiverPhone = String(logisticsPayload.receiverPhone || logisticsPayload.ReceiverCellPhone || logisticsPayload.ReceiverPhone || '').trim();
            const shippingAddress = String(logisticsPayload.storeAddress || logisticsPayload.CVSAddress || logisticsPayload.ReceiverAddress || '').trim();
            const storeId = String(logisticsPayload.storeId || logisticsPayload.CVSStoreID || '').trim();

            if (!receiverName || !receiverPhone || (!shippingAddress && !storeId)) {
                return res.status(400).json({
                    error: {
                        message: "實體商品訂單缺少完整物流資訊（收件人、電話、門市/地址）。"
                    }
                });
            }
        }

        // 建立訂單內容記錄 (Firestore)
        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: uid,
            amount: finalAmount,
            status: "PENDING",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            items: normalizedItems,
            logistics: logistics || null,
            orderNumber: orderNumber
        });

        // ServerUrl (Webhook)
        const serverUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentNotify`;
        // ClientUrl (前端)
        const clientUrl = returnUrl || "https://vibe-coding.tw";

        const appliedReferralLinks = Object.values(normalizedItems).map(item => item?.referralLink).filter(Boolean);
        console.log(`建立訂單: ${orderNumber} (Referral Links: ${appliedReferralLinks.join(', ') || 'None'})`);

        let itemNameStr = 'Vibe Coding 線上課程';
        if (normalizedItems && Object.keys(normalizedItems).length > 0) {
            const names = [];
            Object.values(normalizedItems).forEach(item => {
                const cleanName = (item.name || '未知課程').replace(/[#&]/g, ' ');
                names.push(`${cleanName} x ${item.quantity || 1}`);
            });
            itemNameStr = names.join('#');
            if (itemNameStr.length > 190) itemNameStr = itemNameStr.substring(0, 190) + '...';
        }

        const ecpayParams = {
            MerchantID: MERCHANT_ID,
            MerchantTradeNo: orderNumber,
            MerchantTradeDate: tradeDate,
            PaymentType: 'aio',
            TotalAmount: finalAmount,
            TradeDesc: 'VibeCodingCourse',
            ItemName: itemNameStr,
            ReturnURL: serverUrl,
            OrderResultURL: clientUrl,
            ClientBackURL: clientUrl,
            ChoosePayment: 'ALL',
            EncryptType: '1',
            ChoosePayment: 'ALL',
            EncryptType: '1',
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        await admin.firestore().collection("orders").doc(orderNumber).set({
            gateway: "ECPAY",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).json({ result: { paymentParams: ecpayParams, apiUrl: ECPAY_API_URL } });

    } catch (error) {
        console.error("嚴重錯誤:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// ==========================================
// 1.5. 取得物流地圖參數 (getLogisticsMapParams)
// ==========================================
exports.getLogisticsMapParams = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log("收到 getLogisticsMapParams 請求");

        const requestData = req.body.data || req.body || {};
        const { logisticsSubType, isCollection } = requestData;

        if (!logisticsSubType) {
            return res.status(400).json({ error: { message: "缺少 logisticsSubType" } });
        }

        const params = {
            MerchantID: MERCHANT_ID,
            LogisticsType: 'CVS',
            LogisticsSubType: logisticsSubType,
            IsCollection: isCollection || 'N',
            ServerReplyURL: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/mapReply`
        };

        params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV, 'md5');

        console.log(`產生地圖參數 for ${logisticsSubType}:`, params);

        res.status(200).json({ result: { params, apiUrl: ECPAY_LOGISTICS_MAP_URL || 'https://logistics.ecpay.com.tw/Express/map' } });

    } catch (error) {
        console.error("產生地圖參數失敗:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// ==========================================
// 2. 接收通知 (paymentNotify)
// ==========================================
exports.paymentNotify = onRequest(async (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET') {
        return res.status(200).send('1|OK');
    }

    try {
        const data = req.body;

        // 額外檢查：驗證綠界傳回來的 CheckMacValue 確保安全 (建議加上，但不加也通)
        // 若要加強安全性，可在此處呼叫 generateCheckMacValue(data, HASH_KEY, HASH_IV) 並比對

        if (!data) return res.status(200).send('1|OK');

        if (data.RtnCode === '1') {
            const orderId = data.MerchantTradeNo;
            const isSimulated = data.SimulatePaid === '1';

            // Calculate Expiry Date (1 Year from now)
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                expiryDate: admin.firestore.Timestamp.fromDate(expiryDate), // [NEW] Store expiry date
                ecpayTradeNo: data.TradeNo || "",
                paymentDate: data.PaymentDate || "",
                isSimulated: isSimulated,
                rtnMsg: data.RtnMsg || ""
            });
            console.log(`訂單 ${orderId} 更新成功`);

            // Ensure referred tutor is backfilled from the referral link index.
            try {
                const db = admin.firestore();
                const oDoc = await db.collection("orders").doc(orderId).get();
                const oData = oDoc.data();
                const oItems = oData.items || {};
                
                let updatedItems = false;
                for (const [key, val] of Object.entries(oItems)) {
                    const itemReferralLink = val.referralLink || val.promoCode || null;
                    if (itemReferralLink && !val.referredTutorEmail) {
                        const linkId = Buffer.from(normalizeGitHubUrl(itemReferralLink)).toString('base64');
                        const lDoc = await db.collection('referral_links').doc(linkId).get();
                        if (lDoc.exists) {
                            oItems[key].referredTutorEmail = lDoc.data().tutorEmail;
                            oItems[key].referredTutorName = lDoc.data().tutorName || lDoc.data().tutorEmail;
                            updatedItems = true;
                        }
                    }
                }
                if (updatedItems) {
                    await db.collection("orders").doc(orderId).update({ items: oItems });
                    console.log(`[paymentNotify] ✅ Backfilled referred tutor for order ${orderId}`);
                }
            } catch (backfillErr) {
                console.error("[paymentNotify] Backfill failed:", backfillErr);
            }

            // [NEW] Send Payment Success Email + auto tutor assignment from promo code
            try {
                // Fetch order details to get email and items
                const db = admin.firestore();
                const orderDoc = await db.collection("orders").doc(orderId).get();
                if (orderDoc.exists) {
                    const orderData = orderDoc.data();
                    const lessons = await getLessons();
                    const physicalUnitIds = new Set(lessons.filter(l => l.isPhysical === true).map(l => l.id));
                    const orderItems = orderData.items || {};
                    const hasPhysicalItem = Object.keys(orderItems).some(id => {
                        const canonicalId = normalizeLegacyId(id);
                        const itemData = orderItems[id] || {};
                        if (itemData.isPhysical === true) return true;
                        return physicalUnitIds.has(canonicalId) || physicalUnitIds.has(id);
                    });
                    const logisticsData = orderData.logistics || {};
                    const hasReceiverName = !!String(logisticsData.receiverName || logisticsData.ReceiverName || '').trim();
                    const hasReceiverPhone = !!String(logisticsData.receiverPhone || logisticsData.ReceiverCellPhone || logisticsData.ReceiverPhone || '').trim();
                    const hasShippingAddress = !!String(logisticsData.storeAddress || logisticsData.CVSAddress || logisticsData.ReceiverAddress || '').trim();
                    const hasStoreId = !!String(logisticsData.storeId || logisticsData.CVSStoreID || '').trim();
                    const logisticsMissing = hasPhysicalItem && (!hasReceiverName || !hasReceiverPhone || (!hasShippingAddress && !hasStoreId));

                    if (hasPhysicalItem) {
                        await db.collection("orders").doc(orderId).update({ logisticsMissing });
                    }

                    let userEmail = "";
                    if (orderData.uid === "GUEST") {
                        // Handling guest checkout if applicable, though typically we have UID
                        // If we stored email in orderData, use it. Otherwise, tough luck?
                        // Assuming we can get email from Auth if UID exists
                    } else {
                        const userRecord = await admin.auth().getUser(orderData.uid);
                        userEmail = userRecord.email;
                    }

                    // If we have an email, send it
                    if (userEmail) {
                        const items = orderItems;
                        const itemDesc = Object.values(items).map(i => `${i.name} x${i.quantity || 1}`).join(', ');
                        const hasPhysical = hasPhysicalItem;
                        
                        await sendPaymentSuccessEmail(userEmail, orderId, orderData.amount, itemDesc, hasPhysical);
                    }

                    if (orderData.uid && orderData.uid !== 'GUEST') {
                        const referralAssignments = extractReferralAssignmentsFromOrder(orderData.items || {}, lessons);

                        for (const assignment of referralAssignments) {
                            const linkId = Buffer.from(normalizeGitHubUrl(assignment.referralLink)).toString('base64');
                            const referralDoc = await db.collection('referral_links').doc(linkId).get();
                            if (!referralDoc.exists) continue;

                            const referralData = referralDoc.data();
                            const targetUnitId = resolveCanonicalUnitId(referralData.unitId, lessons);

                            if (targetUnitId && assignment.purchasedUnits.includes(targetUnitId) && referralData.tutorEmail) {
                                // [V16.0] Cascade Assignment: Assign ALL purchased units to this tutor if the link matches any of them
                                for (const unitId of assignment.purchasedUnits) {
                                    await upsertStudentUnitAssignment(
                                        db,
                                        orderData.uid,
                                        unitId,
                                        referralData.tutorEmail,
                                        'paymentNotify',
                                        true
                                    );
                                }
                                console.log(`[paymentNotify] Cascade-assigned ${orderData.uid} -> ${referralData.tutorEmail} for ${assignment.purchasedUnits.length} units (triggered by ${targetUnitId})`);
                            } else {
                                console.warn(`[paymentNotify] Referral link ${assignment.referralLink} did not match purchased units for order ${orderId}`);
                            }
                        }
                    }
                }
            } catch (emailErr) {
                console.error("Failed to process payment follow-up:", emailErr);
            }
        }

        return res.status(200).send('1|OK');

    } catch (error) {
        console.error("通知處理失敗:", error);
        return res.status(200).send('1|OK');
    }
});

// ==========================================
// 3. 權限與課程資訊 (Lessons & Auth)
// ==========================================

// Cache for lessons data
let cachedLessons = null;
let lastFetchTime = 0;

async function getLessons() {
    const now = Date.now();
    // Cache for 5 minutes (DISABLED FOR DEBUG)
    /*
    if (cachedLessons && (now - lastFetchTime < 300000)) {
        return cachedLessons;
    }
    */
    console.log("[getLessons] Cache disabled, fetching fresh data...");

    try {
        if (typeof db === 'undefined') {
            console.error("Critical: Global 'db' is undefined inside getLessons!");
            return [];
        }

        // 1. Fetch from Firestore 'metadata_lessons'
        console.log("Fetching lessons from Firestore 'metadata_lessons' (sorted by orderWeight)...");
        const lessonsSnap = await db.collection('metadata_lessons').orderBy("orderWeight", "asc").get();
        console.log(`Firestore snapshot size: ${lessonsSnap.size}`);

        if (!lessonsSnap.empty) {
            cachedLessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort manually while we still have orderWeight
            cachedLessons.sort((a,b) => (a.orderWeight || 0) - (b.orderWeight || 0));

            // Clean up internal fields AFTER sort
            cachedLessons = cachedLessons.map(d => {
                delete d.updatedAt;
                delete d.orderWeight;
                return d;
            });
            
            lastFetchTime = Date.now();
            console.log(`[getLessons] Successfully loaded ${cachedLessons.length} lessons.`);
            return cachedLessons;
        } else {
            console.warn("[getLessons] Firestore 'metadata_lessons' collection is EMPTY!");
        }
    } catch (err) {
        console.error("[getLessons] Critical error:", err);
    }

    return cachedLessons || [];
}

function resolveCanonicalUnitId(unitId, lessons = []) {
    if (!unitId) return unitId;

    // [V14.12] NORMALIZATION: Strip extension and handle 'start-' prefix
    const cleanId = unitId.replace(/\.html$/, '').replace(/^start-/, '');

    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        if (courseUnits.includes(unitId)) return unitId; // Match original
        
        const matchedUnit = courseUnits.find(courseUnit => {
            const shortCourseUnit = courseUnit.replace(/\.html$/, '').replace(/^start-/, '');
            return shortCourseUnit === cleanId;
        });

        if (matchedUnit) return matchedUnit;
    }

    return unitId;
}

/**
 * Normalizes a unitId for Firestore storage keys (strips .html, keep start- etc).
 */
function normalizeForFirestore(unitId) {
    if (!unitId) return unitId;
    return unitId.replace(/\.html$/, '');
}

/**
 * Robustly extracts tutor configuration for a given unitId from the tutorConfigs map.
 * Handles both flat keys and Firestore's automatic nesting of dot-containing keys (e.g. .html).
 */
function getEffectiveTutorConfig(unitId, tutorConfigs = {}) {
    if (!unitId) return null;
    
    // 1. Precise Match (Original)
    if (tutorConfigs[unitId] && tutorConfigs[unitId].authorized) return tutorConfigs[unitId];

    // 2. Normalized Match (No .html)
    const normalized = unitId.replace(/\.html$/, '');
    const config = tutorConfigs[normalized];

    // 3. Nested HTML Match (Firestore's dot-in-key behavior: unit.html -> { unit: { html: { ... } } })
    if (config && !config.authorized && config.html) {
        return config.html;
    }

    return config || null;
}

function findParentCourseIdByUnit(unitId, lessons = []) {
    if (!unitId) return null;

    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const lesson = lessons.find(l => Array.isArray(l.courseUnits) && l.courseUnits.includes(canonicalUnitId));
    return lesson?.courseId || null;
}

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    const normalizeCourseFile = (value = '') => {
        if (!value) return '';
        const filePart = String(value).split('/').pop().split('?')[0];
        return filePart;
    };
    const normalizedPageId = normalizeCourseFile(pageId);
    const normalizedFileName = normalizeCourseFile(fileName);
    const normalizedPageIdNoHtml = normalizedPageId.replace(/\.html$/i, '');
    const normalizedFileNameNoHtml = normalizedFileName.replace(/\.html$/i, '');

    return lessons.find(l => {
        const lessonCourseId = String(l.courseId || '');
        const lessonCourseIdNoHtml = lessonCourseId.replace(/\.html$/i, '');
        const units = Array.isArray(l.courseUnits) ? l.courseUnits : [];
        const unitMatch = units.some(unit => {
            const normalizedUnit = normalizeCourseFile(String(unit || ''));
            return unitIdsMatch(normalizedUnit, normalizedFileName) ||
                unitIdsMatch(normalizedUnit, normalizedFileNameNoHtml) ||
                unitIdsMatch(normalizedUnit, normalizedPageId) ||
                unitIdsMatch(normalizedUnit, normalizedPageIdNoHtml);
        });

        const classroomUnitMatch = !!(l.classroomUrl && (
            unitIdsMatch(normalizeCourseFile(l.classroomUrl), normalizedFileName) ||
            unitIdsMatch(normalizeCourseFile(l.classroomUrl), normalizedFileNameNoHtml) ||
            unitIdsMatch(normalizeCourseFile(l.classroomUrl), normalizedPageId) ||
            unitIdsMatch(normalizeCourseFile(l.classroomUrl), normalizedPageIdNoHtml)
        ));

        return unitIdsMatch(lessonCourseId, pageId) ||
            unitIdsMatch(lessonCourseId, normalizedPageId) ||
            unitIdsMatch(lessonCourseIdNoHtml, normalizedPageIdNoHtml) ||
            unitMatch ||
            classroomUnitMatch;
    }) || null;
}

function collectPurchasedUnitIds(items = {}, lessons = []) {
    const purchasedUnits = new Set();

    Object.keys(items || {}).forEach(itemKey => {
        const lesson = lessons.find(l => l.courseId === itemKey);
        if (lesson) {
            (lesson.courseUnits || []).forEach(unitId => purchasedUnits.add(resolveCanonicalUnitId(unitId, lessons)));
            return;
        }

        const canonicalUnitId = resolveCanonicalUnitId(itemKey, lessons);
        if (canonicalUnitId) purchasedUnits.add(canonicalUnitId);
    });

    return Array.from(purchasedUnits);
}

function findMatchingOrderItemIdForReferral(items = {}, referralTargetId = '', lessons = []) {
    if (!referralTargetId) return null;

    if (items[referralTargetId]) return referralTargetId;

    const canonicalReferralUnitId = resolveCanonicalUnitId(referralTargetId, lessons);
    if (items[canonicalReferralUnitId]) return canonicalReferralUnitId;

    const parentCourseId = findParentCourseIdByUnit(canonicalReferralUnitId, lessons);
    if (parentCourseId && items[parentCourseId]) return parentCourseId;

    return Object.keys(items || {}).find(itemKey => {
        if (itemKey === referralTargetId || itemKey === canonicalReferralUnitId) return true;
        const lesson = lessons.find(l => l.courseId === itemKey);
        return !!(lesson && Array.isArray(lesson.courseUnits) && lesson.courseUnits.includes(canonicalReferralUnitId));
    }) || null;
}

function normalizeOrderItems(cartDetails = {}, referralLink = '', referredTutorEmail = '', lessons = []) {
    const items = JSON.parse(JSON.stringify(cartDetails || {}));
    const normalizedReferralLink = referralLink && referralLink.trim()
        ? String(referralLink).trim()
        : null;
    const normalizedReferredTutorEmail = referredTutorEmail && referredTutorEmail.trim()
        ? String(referredTutorEmail).trim()
        : 'info@vibe-coding.tw';

    Object.entries(items).forEach(([itemKey, itemValue]) => {
        if (!itemValue || typeof itemValue !== 'object') items[itemKey] = {};
        const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
        const itemReferredTutorEmail = itemValue?.referredTutorEmail || itemValue?.referralTutor || 'info@vibe-coding.tw';
        const itemReferredTutorName = itemValue?.referredTutorName || itemValue?.referralTutorName || null;

        items[itemKey].referralLink = itemReferralLink ? String(itemReferralLink).trim() : null;
        items[itemKey].referredTutorEmail = itemReferredTutorEmail ? String(itemReferredTutorEmail).trim() : 'info@vibe-coding.tw';
        items[itemKey].referredTutorName = itemReferredTutorName ? String(itemReferredTutorName).trim() : null;
    });

    if (normalizedReferralLink) {
        const targetItemId = findMatchingOrderItemIdForReferral(items, normalizedReferralLink, lessons);
        if (targetItemId && items[targetItemId]) {
            items[targetItemId].referralLink = normalizedReferralLink;
            items[targetItemId].referredTutorEmail = normalizedReferredTutorEmail;
        }
    }

    return items;
}

function extractReferralAssignmentsFromOrder(orderItems = {}, lessons = []) {
    const assignments = [];

    Object.entries(orderItems || {}).forEach(([itemKey, itemValue]) => {
        const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
        const itemTutor = itemValue?.referredTutorEmail || itemValue?.referralTutor || null;
        if (!itemReferralLink) return;

        const lesson = lessons.find(l => l.courseId === itemKey);
        const purchasedUnits = lesson
            ? (lesson.courseUnits || []).map(unitId => resolveCanonicalUnitId(unitId, lessons))
            : [resolveCanonicalUnitId(itemKey, lessons)];

        assignments.push({
            itemKey,
            referralLink: String(itemReferralLink).trim(),
            referredTutorEmail: itemTutor ? String(itemTutor).trim() : null,
            purchasedUnits
        });
    });

    return assignments;
}

function hasActiveOrderForCourse(ordersSnapshot, courseId) {
    let hasCourse = false;
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    ordersSnapshot.forEach(doc => {
        const data = doc.data();
        const items = data.items || {};
        if (!items[courseId]) return;

        if (data.expiryDate?.toDate) {
            const expiry = data.expiryDate.toDate().getTime();
            if (now < expiry) hasCourse = true;
            return;
        }

        let orderDate = null;
        if (data.paymentDate) {
            orderDate = new Date(data.paymentDate).getTime();
        } else if (data.createdAt?.toDate) {
            orderDate = data.createdAt.toDate().getTime();
        }

        if (orderDate && (now - orderDate < ONE_YEAR_MS)) {
            hasCourse = true;
        }
    });

    return hasCourse;
}

function resolveClassroomUrlForTutor(urlConfig, tutorEmail) {
    if (!urlConfig) return null;
    if (typeof urlConfig === 'string') return urlConfig;
    if (typeof urlConfig !== 'object') return null;
    if (tutorEmail && typeof urlConfig[tutorEmail] === 'string') return urlConfig[tutorEmail];
    if (typeof urlConfig.default === 'string') return urlConfig.default;
    return Object.values(urlConfig).find(value => typeof value === 'string' && value.trim()) || null;
}

function hasQualifiedTutorStatus(userData = {}, unitId = '') {
    const tutorConfigs = userData.tutorConfigs || {};
    if (unitId) {
        return !!(tutorConfigs[unitId] && tutorConfigs[unitId].authorized === true);
    }
    return Object.values(tutorConfigs).some(config => config && config.authorized === true);
}

/**
 * Checks if a tutor is fully certified for all units in a specific course.
 * @param {object} userData - User document data
 * @param {string} courseId - The course to check
 * @param {Array} lessons - Lessons metadata
 * @returns {boolean}
 */
function isTutorFullyQualifiedForCourse(userData = {}, courseId = '', lessons = []) {
    const tutorConfigs = userData.tutorConfigs || {};
    const lesson = lessons.find(l => l.courseId === courseId);
    if (!lesson || !Array.isArray(lesson.courseUnits)) return false;

    // A tutor is fully qualified for a course ONLY if EVERY unit in that course is authorized in their config
    return lesson.courseUnits.every(unitId => {
        const canonical = resolveCanonicalUnitId(unitId, lessons);
        const config = getEffectiveTutorConfig(canonical, tutorConfigs);
        return !!(config && config.authorized === true);
    });
}

/**
 * Normalizes a GitHub Classroom URL for consistent matching.
 */
function normalizeGitHubUrl(url = '') {
    if (!url) return '';
    try {
        let clean = url.trim().toLowerCase();
        // Remove trailing slashes
        clean = clean.replace(/\/+$/, '');
        // Ensure it has protocol for URL parsing if needed, but here we just need a string match
        return clean;
    } catch (e) {
        return url.trim().toLowerCase();
    }
}

function fallbackNameFromEmail(email, defaultName = "使用者") {
    if (!email || typeof email !== "string") return defaultName;
    const localPart = email.split("@")[0] || "";
    return localPart.trim() || defaultName;
}

function generatePromotionCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid 0/O and 1/I ambiguity
    let out = '';
    for (let i = 0; i < length; i += 1) {
        const idx = crypto.randomInt(0, chars.length);
        out += chars[idx];
    }
    return out;
}

async function ensureTutorPromotionCode(db, userRef, userData = {}, uid = '', email = '') {
    const existing = String(userData.promotionCode || '').trim().toUpperCase();
    if (existing) return existing;

    let finalCode = '';
    let tries = 0;

    while (tries < 20) {
        finalCode = generatePromotionCode(6);
        const dup = await db.collection('users')
            .where('promotionCode', '==', finalCode)
            .limit(1)
            .get();
        if (dup.empty || (dup.docs[0] && dup.docs[0].id === uid)) break;
        tries += 1;
    }

    if (!finalCode) {
        throw new Error('Failed to generate promotion code');
    }

    await userRef.set({
        promotionCode: finalCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return finalCode;
}

function resolveNameFromUserData(userData = {}, email = "", authDisplayName = "") {
    return userData.name || userData.displayName || authDisplayName || fallbackNameFromEmail(email);
}

async function resolveUserDisplayName(db, uid, email = "", authDisplayName = "") {
    try {
        if (!uid) return resolveNameFromUserData({}, email, authDisplayName);
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        return resolveNameFromUserData(userData, email, authDisplayName);
    } catch (e) {
        console.warn(`[NameResolver] Failed to resolve user name for uid=${uid}:`, e.message);
        return resolveNameFromUserData({}, email, authDisplayName);
    }
}

/**
 * [V15.9] SYNC HELPER: Maintains the referral_links index for O(1) lookups during checkout.
 */
async function syncReferralLink(db, url, tutorEmail, tutorName, unitId) {
    if (!url) return;
    const normalized = normalizeGitHubUrl(url);
    if (!normalized) return;
    
    // Key: Base64 of normalized URL to avoid issues with slashes in document IDs
    const linkId = Buffer.from(normalized).toString('base64');
    await db.collection('referral_links').doc(linkId).set({
        url: normalized,
        tutorEmail,
        tutorName: tutorName || tutorEmail,
        unitId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[ReferralSync] ✅ Indexed ${normalized} -> ${tutorEmail}`);
}

async function upsertStudentUnitAssignment(db, studentUid, unitId, tutorEmail, assignedByUid = 'system', notify = true) {
    const userRef = db.collection('users').doc(studentUid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const previousTutor = userData.unitAssignments?.[unitId] || null;

    await userRef.set({
        unitAssignments: {
            [unitId]: tutorEmail || null
        },
        lastAssignmentUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastAssignedBy: assignedByUid
    }, { merge: true });

    if (notify && tutorEmail && previousTutor !== tutorEmail) {
        const studentName = resolveNameFromUserData(userData, userData.email, "");
        const studentEmail = userData.email;

        if (studentEmail) {
            await sendStudentLinkedToTutorEmail(studentEmail, studentName, unitId, tutorEmail);
        }
        await sendTutorLinkedToStudentEmail(tutorEmail, studentName, unitId);
    }

    return { previousTutor, changed: previousTutor !== (tutorEmail || null) };
}

async function resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const normalizedCourseId = normalizeLegacyId(courseId || '');
    const normalizedUnitId = normalizeLegacyId(unitId || '');
    // 1. Fetch User Data and Security Role
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAdminRole = userData.role === 'admin';
    const resolvedUnitFromInput = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const assignedTutorEmail = userData.unitAssignments?.[resolvedUnitFromInput] || null;

    // 2. Resolve Canonical Context
    let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
    const effectiveCourseId = course ? course.courseId : (normalizedCourseId || findParentCourseIdByUnit(canonicalUnitId, lessons));
    // Course-level checks (e.g. started/basic/advanced cards) may only pass courseId.
    // In that case, infer a representative unit from metadata so access is not falsely denied.
    if (!canonicalUnitId && course && Array.isArray(course.courseUnits) && course.courseUnits.length > 0) {
        canonicalUnitId = resolveCanonicalUnitId(course.courseUnits[0], lessons);
    }
    const isPhysicalProduct = !!(course && course.isPhysical === true);

    // [V13.6] Special Physical Product Enforcement
    // Rule: Hardware sales ALWAYS prioritize purchase flow. No bypasses for ANYONE.
    if (isPhysicalProduct) {
        console.log(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
        // Skip all bypasses and jump directly to Order Check (below)
    } else {
        // [V13.0.22] Master Bypass (Tutor Mode Simulation)
        // If an authorized admin toggles simulation ON, grant immediate access to DIGITAL units.
        if (tutorMode && isAdminRole) {
            console.log(`[resolveAccess] SUCCESS: Admin Simulation Bypass for ${uid}`);
            return { 
                authorized: true, 
                simulated: true, 
                accessMode: 'admin_simulated',
                canonicalUnitId: canonicalUnitId,
                effectiveCourseId: effectiveCourseId,
                assignedTutorEmail: assignedTutorEmail
            };
        }

        // [V15.7] Enforce simulation: If Admin Simulation is OFF, skip teacher/tutor-related privileges.
        // This ensures Admins can test the student paywall experience accurately.
        const shouldSkipTutorBypass = isAdminRole && !tutorMode;

        if (!shouldSkipTutorBypass) {
            // Status-based Authorization: Fully Qualified Tutors for the Course
            if (effectiveCourseId && isTutorFullyQualifiedForCourse(userData, effectiveCourseId, lessons)) {
                console.log(`[resolveAccess] SUCCESS: Fully Qualified Tutor Bypass for ${uid} on ${effectiveCourseId}`);
                return { 
                    authorized: true, 
                    accessMode: 'fully_qualified_tutor', 
                    canonicalUnitId, 
                    effectiveCourseId, 
                    assignedTutorEmail, 
                    course 
                };
            }

            // Status-based Authorization: Qualified Tutors for their units (Digital Only)
            const effectiveTutorCfg = getEffectiveTutorConfig(canonicalUnitId, userData.tutorConfigs || {});
            const isQualifiedTutorForThisUnit = !!(effectiveTutorCfg && effectiveTutorCfg.authorized === true);
            if (isQualifiedTutorForThisUnit) {
                return { authorized: true, accessMode: 'qualified_tutor', canonicalUnitId, effectiveCourseId, assignedTutorEmail, course };
            }
        }

        // FREE COURSE (NT$ 0) (Digital Only)
        const lessonPrice = course ? course.price : (lessons.find(l => l.courseId === effectiveCourseId)?.price || 9999);
        const isFreeCourse = !!(course && parseInt(lessonPrice) === 0);
        if (isFreeCourse) {
            return { authorized: true, accessMode: 'free_course', canonicalUnitId, effectiveCourseId, assignedTutorEmail, course };
        }

        // Trial Course (Started category, within 30 days) (Digital Only)
        const now = Date.now();
        const userRecord = await admin.auth().getUser(uid);
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const isTrialCourse = !!(course && course.category === 'started' && ((now - new Date(userRecord.metadata.creationTime).getTime()) < THIRTY_DAYS_MS));
        if (isTrialCourse) {
            return { authorized: true, accessMode: 'trial_course', canonicalUnitId, effectiveCourseId, assignedTutorEmail, course };
        }
    }

    if (!effectiveCourseId) {
        console.warn(`[resolveAccess] FAIL: Missing context for UID:${uid} Page:${courseId} Unit:${unitId}`);
        return { authorized: false, reason: 'missing-context', canonicalUnitId, effectiveCourseId };
    }

    const ordersSnapshot = await db.collection('orders')
        .where('uid', '==', uid)
        .where('status', '==', 'SUCCESS')
        .get();

    const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourse(ordersSnapshot, effectiveCourseId);
    if (!hasPaidCourse) {
        return {
            authorized: false,
            reason: 'payment-required',
            accessMode: 'payment_required',
            canonicalUnitId,
            effectiveCourseId,
            assignedTutorEmail: null,
            course
        };
    }

    return {
        authorized: true,
        accessMode: 'paid_student',
        canonicalUnitId,
        effectiveCourseId,
        assignedTutorEmail,
        requiresTutorAssignment: !isPhysicalProduct,
        course
    };
}

// [NEW] API to expose lessons to frontend
exports.getLessonsMetadata = onCall(async (request) => {
    console.log("[getLessonsMetadata] Starting onCall request...");
    const lessons = await getLessons();
    console.log(`[getLessonsMetadata] Returning ${lessons.length} lessons to caller.`);
    return { lessons: lessons };
});


// [V12.4.7] ONCALL WRAPPER: For frontend's httpsCallable('checkPaymentAuthorization')
exports.checkPaymentAuthorization = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) return { authorized: false };

    try {
        const { pageId, fileName, tutorMode } = data;
        const lessons = await getLessons();
        const db = admin.firestore();

        // [V12.4.9] Robust Authorization Check using central logic
        const access = await resolveStudentAssignmentAccess(
            db, 
            auth.uid, 
            pageId, 
            fileName, 
            lessons, 
            tutorMode === true
        );

        if (access.authorized) {
            // [V13.0.8] Generate token for serveCourse
            const expiry = Date.now() + 30 * 60 * 1000; // 30 mins
            const scopePart = fileName || pageId || "UNDEFINED";
            const raw = `${pageId || "UNDEFINED"}|${scopePart}|${expiry}`;
            const signature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');
            const token = `${raw}|${signature}`;

            return { 
                authorized: true,
                token: token
            };
        }

        return { 
            authorized: false,
            reason: access.reason || null
        };
    } catch (e) {
        console.error("Auth check failed:", e);
        return { authorized: false, error: e.message };
    }
});

// 4. 安全檔案服務 (serveCourse)
// ==========================================
exports.serveCourse = onRequest(async (req, res) => {
    const normalizeCourseFile = (value = '') => {
        if (!value) return value;
        const filePart = String(value).split('/').pop().split('?')[0];
        return filePart;
    };

    // 1. Parsing Path (e.g. /courses/ble-connection-master.html)
    const urlPath = req.path; // /courses/foo.html
    // [FIXED v11.3.8] More robust fileName extraction (strips leading slashes)
    const fileName = urlPath.split('/').filter(Boolean).pop();

    // 2. Security Check (Token)
    const token = req.query.token;

    console.log(`[serveCourse] Path: ${urlPath}, FileName: ${fileName}, Token Provided: ${!!token}`);

    if (!token) {
        console.warn(`[serveCourse] Access Denied: No token. Query:`, req.query);
        return res.status(403).send("Access Denied: No token provided.");
    }

    try {
        // Token Format: pageId|scopePart|expiry|signature
        const parts = token.split('|');
        if (parts.length !== 4) {
            return res.status(403).send("Access Denied: Invalid token format.");
        }

        const [pageId, scopePart, expiryStr, signature] = parts;
        const expiry = parseInt(expiryStr);

        // A. Validate Signature
        const raw = `${pageId}|${scopePart}|${expiry}`;
        const expectedSignature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');

        if (signature !== expectedSignature) {
            return res.status(403).send("Access Denied: Invalid signature.");
        }

        // C. Normalize target filename
        let normalizedFileName = normalizeCourseFile(fileName);
        if (fileName.match(/^0[1-5]-/) && !fileName.includes('-master-')) {
            const asIsPath = path.join(__dirname, 'private_courses', fileName);
            if (!fs.existsSync(asIsPath)) {
                normalizedFileName = 'start-' + fileName;
                console.log(`[serveCourse] Early Normalization (Conditional): ${fileName} -> ${normalizedFileName}`);
            }
        }

        const normalizedScopePart = normalizeCourseFile(scopePart);

        // B. Validate Expiry
        if (Date.now() > expiry) {
            return res.status(403).send("Access Denied: Token expired.");
        }

        // C. Validate File Scope Dynamic Logic [REFACTORED v11.3.14]
        let isAuthorizedScope = (
            scopePart === fileName ||
            normalizedScopePart === normalizedFileName ||
            normalizeCourseFile(scopePart) === normalizeCourseFile(fileName)
        );
        let debugInfo = "None";
        let lessons = [];

        if (!isAuthorizedScope) {
            try {
                // Use the centralized getLessons helper [FIXED v11.3.14]
                lessons = await getLessons();

                // Find the course by pageId/courseId or scopePart
                const normalizedPageId = normalizeCourseFile(pageId || '');
                const course = lessons.find(l =>
                    l.courseId === pageId ||
                    l.courseId === normalizedPageId ||
                    l.courseId === normalizedScopePart ||
                    normalizeCourseFile(l.classroomUrl || '') === normalizedScopePart
                );

                if (course) {
                    const masterFile = normalizeCourseFile(course.classroomUrl || "");
                    const normalizedUnits = (course.courseUnits || []).map(u => normalizeCourseFile(u));
                    const isMasterMatch = (normalizeCourseFile(normalizedFileName) === masterFile);
                    let isUnitMatch = normalizedUnits.includes(normalizeCourseFile(normalizedFileName));
                    
                    debugInfo = `CourseFound: ${course.courseId}, isMasterMatch: ${isMasterMatch}, isUnitMatch: ${isUnitMatch}, masterFile: ${masterFile}`;

                    if (isMasterMatch || isUnitMatch) {
                        isAuthorizedScope = true;
                        console.log(`[serveCourse] ${normalizedFileName} authorized via dynamic course-scope: ${scopePart}`);
                    }
                } else {
                    debugInfo = `CourseNotFound for Scope: ${scopePart}. LessonsCount: ${lessons.length}`;
                }
            } catch (jsonErr) {
                console.error("[serveCourse] JSON Scope check failed:", jsonErr);
                debugInfo = `JSON Error: ${jsonErr.message}`;
            }
        }

        if (!isAuthorizedScope) {
            const normalizedPageId = normalizeCourseFile(pageId || '');
            const manualFallback = lessons.find(l =>
                l.courseId === pageId ||
                l.courseId === normalizedPageId ||
                l.courseUnits &&
                (l.courseUnits.includes(normalizedScopePart) || l.courseUnits.includes(scopePart))
            );
            console.error(`Access Denied Debug: Scope=${scopePart} (normalized=${normalizedScopePart}), File=${normalizedFileName}, Debug=${debugInfo}`);
            
            // [MODIFIED v11.3.14] Fallback: If scopePart is a fileName and lesson contains it, allow.
            if (manualFallback) {
                const fallbackMaster = normalizeCourseFile(manualFallback.classroomUrl || '');
                const normalizedUnits = (manualFallback.courseUnits || []).map(u => normalizeCourseFile(u));
                const isMasterMatch = (fallbackMaster === normalizeCourseFile(normalizedFileName));
                let isUnitMatch = normalizedUnits.includes(normalizeCourseFile(normalizedFileName));
                
                if (isMasterMatch || isUnitMatch) {
                    isAuthorizedScope = true;
                    console.log(`[serveCourse] ${normalizedFileName} authorized via manual fallback for scope ${scopePart}`);
                }
            }
        }

        if (!isAuthorizedScope) {
            return res.status(403).send(`Access Denied: Token valid for ${scopePart}, but requested ${normalizedFileName}.`);
        }

        // 3. Serve File
        const finalServeName = normalizedFileName; 
        let filePath = path.join(__dirname, 'private_courses', finalServeName);

        // [NEW v11.3.9] Legacy Name Fallback (01- to 00-)
        if (!fs.existsSync(filePath)) {
            let altFileName;
            if (fileName.startsWith('start-')) altFileName = fileName.replace('start-', '');
            else if (fileName.match(/^0[1-5]-/)) altFileName = 'start-' + fileName;

            if (altFileName) {
                const altPath = path.join(__dirname, 'private_courses', altFileName);
                if (fs.existsSync(altPath)) {
                    console.log(`[serveCourse] Legacy Fallback: ${fileName} -> ${altFileName}`);
                    filePath = altPath;
                }
            }
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found.");
        }

        // [NEW v11.3.15] Inject Firebase SDK & Bootstrapper for Auto-Tracking
        let content = fs.readFileSync(filePath, 'utf8');
        const firebaseConfig = {
            apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
            authDomain: "e-learning-942f7.firebaseapp.com",
            projectId: "e-learning-942f7",
            storageBucket: "e-learning-942f7.firebasestorage.app",
            messagingSenderId: "878397058574",
            appId: "1:878397058574:web:28aaa07a291ee3baab165f"
        };

        const bootstrapper = `
        <!-- [Firebase Auto-Inject v1.0] -->
        <script type="module">
            import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
            import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
            
            const config = ${JSON.stringify(firebaseConfig)};
            const app = initializeApp(config);
            
            // Expose to window for course-shared.js compatibility
            window.vibeApp = app;
            window.getFunctions = getFunctions;
            window.httpsCallable = httpsCallable;
            window.resizeIframe = (obj) => { if(obj && obj.contentWindow) obj.style.height = obj.contentWindow.document.documentElement.scrollHeight + 'px'; };
            console.log("[Firebase] SDK Injected & Initialized");
        </script>
        `;

        // Insert before </body> or at the end
        if (content.includes('</body>')) {
            content = content.replace('</body>', `${bootstrapper}</body>`);
        } else {
            content += bootstrapper;
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(content);

    } catch (e) {
        console.error(e);
        res.status(403).send("Access Denied: Token error.");
    }
});

const getRole = async (uid) => {
    try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
            const role = userDoc.data().role;
            return role === 'admin' ? 'admin' : 'user';
        }
    } catch (e) {
        console.error("[Role] Error in getRole:", e);
    }
    return 'user'; // Default to user
};

// ==========================================
// 5. 設定用戶角色 (setUserRole - Admin Only)
// ==========================================
exports.setUserRole = onCall(async (request) => {
    const { data, auth } = request;
    // 1. Check Authentication
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const adminUid = auth.uid;
    const adminRole = await getRole(adminUid);

    // 2. Check Authorization (Must be Admin)
    // NOTE: For bootstrapping, you might need to temporarily bypass this or set the first admin in Firestore Console.
    if (adminRole !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can set roles.');
    }

    const { email, role } = data;

    if (!['user', 'admin'].includes(role)) {
        throw new HttpsError('invalid-argument', 'Invalid role.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            email: email,
            role: role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { success: true, message: `User ${email} is now a ${role}.` };
    } catch (error) {
        throw new HttpsError('not-found', `User with email ${email} not found.`);
    }
});

// ==========================================
// 6. 記錄學習活動 (logActivity)
// ==========================================
exports.logActivity = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        // Allow anonymous logging? Probably not for specific student tracking.
        // But for now, let's require auth.
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = auth.uid;
    const { courseId, action, duration, metadata } = data;

    if (!courseId || !action) {
        throw new HttpsError('invalid-argument', 'Missing courseId or action.');
    }

    // [NEW] Disable Page View Logging
    if (action === 'PAGE_VIEW') {
        return { success: true, message: "Page view logging disabled" };
    }

    try {
        await admin.firestore().collection('activity_logs').add({
            uid: uid,
            courseId: courseId,
            action: action, // 'PAGE_VIEW', 'VIDEO', 'DOC'
            duration: duration || 0, // seconds
            metadata: metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Activity Log Error:", error);
        throw new HttpsError('internal', 'Failed to log activity.');
    }
});

// ==========================================
// 7. 導師設定管理 (saveTutorConfigs / getTutorConfigs)
// ==========================================
const saveTutorConfigsHandler = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = auth.uid;
    const email = auth.token.email;
    const role = await getRole(uid);
    const { courseId, configs } = data;
    if (!courseId || !configs) {
        throw new HttpsError('invalid-argument', 'Missing courseId or configs.');
    }

    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const unitIds = Object.keys(configs.githubClassroomUrls || {});
    const canManageAllUnits = role === 'admin';
    const canManageRequestedUnits = unitIds.every(unitId => hasQualifiedTutorStatus(userData, unitId));

    if (!canManageAllUnits && !canManageRequestedUnits) {
        throw new HttpsError('permission-denied', 'Only admins or qualified tutors for these units can save configs.');
    }

        // [V12.0.9] ULTIMATE MIGRATION: Stop writing to the deprecated course_configs collection.
        // We now only save configurations (authorized tutors, metadata, URLs) to individual user documents.
        // The dashboard synthesizes this data on read.

        // [NEW v12.0.9] If caller is admin, ensure they have their own tutorConfigs entry for the target units
        if (role === 'admin') {
            console.log(`[saveTutorConfigs] Admin ${email} saving configs to users collection...`);
        }

        try {
            // --- PHASE 1: Propagate githubClassroomUrls and Authorizations to User Documents ---
            if (configs.githubClassroomUrls) {
            console.log(`[saveTutorConfigs] Syncing GitHub Classroom URLs to user documents for ${courseId}...`);
            const db = admin.firestore();
            
            for (const [unitId, tutorsMap] of Object.entries(configs.githubClassroomUrls)) {
                for (const [tEmail, url] of Object.entries(tutorsMap)) {
                    try {
                        const userRecord = await admin.auth().getUserByEmail(tEmail);
                        const tutorUid = userRecord.uid;
                        
                        // 使用 FieldPath 或嵌套物件更新以避開點號問題，但在 set({merge: true}) 中直接傳遞對象是合規的
                        await db.collection('users').doc(tutorUid).set({
                            tutorConfigs: {
                                [unitId]: {
                                    githubClassroomUrl: url,
                                    authorized: true,
                                    email: tEmail,
                                    updatedAt: new Date().toISOString()
                                }
                            }
                        }, { merge: true });
                        
                        // [V15.9] ARCHITECTURE SYNC: Update the global referral index for fast lookup
                        await syncReferralLink(db, url, tEmail, (uData.name || tEmail), unitId);

                        console.log(`[saveTutorConfigs] ✅ Synced ${unitId} for ${tEmail}`);
                    } catch (err) {
                        console.warn(`[saveTutorConfigs] Failed to sync ${tEmail} for ${unitId}: ${err.message}`);
                    }
                }
            }
        }

        return { success: true, message: 'Configs saved and synced to user documents.' };
    } catch (e) {
        console.error("Save Config Error:", e);
        throw new HttpsError('internal', e.message);
    }
});

const getTutorConfigsHandler = onCall(async (request) => {
    const { data } = request;
    const { courseId } = data;
    try {
        const db = admin.firestore();
        
        // [V12.0.6] Ultimate Reliability: Fetch all users and filter in memory to avoid dot-ambiguity issues in Firestore queries.
        if (courseId) {
            const tutorsSnap = await db.collection('users').get();
            
            const authorizedTutors = [];
            const tutorDetails = {};
            const githubClassroomUrls = { [courseId]: {} };

            tutorsSnap.forEach(tDoc => {
                const tData = tDoc.data();
                const tutorConfigs = tData.tutorConfigs || {};
                
                // Directly match the key string (immune to dots)
                const config = tutorConfigs[courseId];
                if (config && config.authorized === true) {
                    authorizedTutors.push(config.email);
                    tutorDetails[config.email] = config;
                    if (config.githubClassroomUrl) {
                        githubClassroomUrls[courseId][config.email] = config.githubClassroomUrl;
                    }
                }
            });

            return { 
                [courseId]: {
                    authorizedTutors,
                    tutorDetails,
                    githubClassroomUrls
                } 
            };
        } else {
            // Bulk fetch for all units (Heavy, but matches legacy behavior)
            const allConfigs = {};
            const usersSnap = await db.collection('users').get();
            
            usersSnap.forEach(uDoc => {
                const uData = uDoc.data();
                const tutorConfigs = uData.tutorConfigs || {};
                for (const [uId, config] of Object.entries(tutorConfigs)) {
                    if (!config.authorized) continue;
                    if (!allConfigs[uId]) {
                        allConfigs[uId] = { authorizedTutors: [], tutorDetails: {}, githubClassroomUrls: { [uId]: {} } };
                    }
                    allConfigs[uId].authorizedTutors.push(config.email);
                    allConfigs[uId].tutorDetails[config.email] = config;
                    if (config.githubClassroomUrl) {
                        allConfigs[uId].githubClassroomUrls[uId][config.email] = config.githubClassroomUrl;
                    }
                }
            });
            return allConfigs;
        }
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

exports.saveTutorConfigs = saveTutorConfigsHandler;
exports.getTutorConfigs = getTutorConfigsHandler;

exports.resolveAssignmentAccess = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const { unitId, courseId, tutorMode, assignmentId } = data || {};
    if (!unitId) throw new HttpsError('invalid-argument', '缺少單元 ID');

    const db = admin.firestore();
    const lessons = await getLessons();
    const access = await resolveStudentAssignmentAccess(db, auth.uid, courseId, unitId, lessons, tutorMode === true);
    if (!access.authorized) return { authorized: false, reason: access.reason || 'forbidden', accessMode: access.accessMode || null };

    const { canonicalUnitId, effectiveCourseId, assignedTutorEmail, requiresTutorAssignment, accessMode } = access;

    if (requiresTutorAssignment && !assignedTutorEmail) {
        return {
            authorized: true,
            accessMode,
            classroomUrl: null,
            assignedTutorEmail: null,
            canonicalUnitId,
            courseId: effectiveCourseId,
            requiresTutorAssignment: true
        };
    }

    // [V12.0.4] Fetch Tutor-specific classroom URL from the Tutor's User document
    let classroomUrl = null;
    if (assignedTutorEmail) {
        try {
            const tutorRecord = await admin.auth().getUserByEmail(assignedTutorEmail);
            const tutorDoc = await db.collection('users').doc(tutorRecord.uid).get();
            const tutorData = tutorDoc.exists ? tutorDoc.data() : {};
            const unitConfig = (tutorData.tutorConfigs || {})[canonicalUnitId] || {};
            classroomUrl = unitConfig.githubClassroomUrl || null;
            
            // Fallback to course-level if not unit-level (optional, depending on structure)
            if (!classroomUrl && effectiveCourseId) {
                const courseConfig = (tutorData.tutorConfigs || {})[effectiveCourseId] || {};
                classroomUrl = courseConfig.githubClassroomUrl || null;
            }
        } catch (tutorErr) {
            console.warn(`[resolveAssignmentAccess] Failed to fetch tutor ${assignedTutorEmail} config:`, tutorErr.message);
        }
    }

    // Secondary Fallback: Check metadata_lessons (lessons) for default URLs
    if (!classroomUrl) {
        const course = lessons.find(l => l.courseId === effectiveCourseId);
        if (course?.githubClassroomUrls?.[canonicalUnitId]) {
            classroomUrl = resolveClassroomUrlForTutor(course.githubClassroomUrls[canonicalUnitId], assignedTutorEmail);
        }
    }

    // [V17.0.1] Personalized Repository Check: If student already started, prioritize their personal repo
    let personalRepoUrl = null;
    let assignmentDetails = null;
    if (assignmentId) {
        try {
            const assignmentDoc = await db.collection('assignments').doc(`${auth.uid}_${assignmentId}`).get();
            if (assignmentDoc.exists) {
                const aData = assignmentDoc.data();
                const existingUrl = aData.assignmentUrl || aData.url;
                // Only prioritize if it's a real GitHub repo (not a classroom invitation link with /a/)
                if (existingUrl && existingUrl.includes('github.com/') && !existingUrl.includes('classroom.github.com/a/')) {
                    personalRepoUrl = existingUrl;
                    console.log(`[resolveAssignmentAccess] Found personal repo for student: ${personalRepoUrl}`);
                }
                assignmentDetails = {
                    learningState: aData.learningState || 'in_progress',
                    latestBlocker: aData.latestBlocker || null,
                    hintLevelUsed: aData.hintLevelUsed !== undefined ? aData.hintLevelUsed : null,
                    nextAction: aData.nextAction || null,
                    attemptSummary: aData.attemptSummary || null,
                    grade: aData.grade !== undefined ? aData.grade : null,
                    tutorFeedback: aData.tutorFeedback || null
                };
            }
        } catch (e) {
            console.warn("[resolveAssignmentAccess] Failed to lookup personal repo:", e.message);
        }
    }

    return {
        authorized: true,
        accessMode,
        classroomUrl: personalRepoUrl || classroomUrl || null,
        assignedTutorEmail: assignedTutorEmail || null,
        canonicalUnitId,
        courseId: effectiveCourseId,
        requiresTutorAssignment,
        assignmentDetails
    };
});

exports.precheckGithubClassroomAccess = onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    if (!GITHUB_ORG_ADMIN_TOKEN) {
        return {
            success: false,
            precheckEnabled: false,
            state: "disabled",
            message: "GitHub precheck is not configured."
        };
    }

    const classroomUrl = String(data?.classroomUrl || "").trim();
    const isClassroom = /classroom\.github\.com\/a\//i.test(classroomUrl);
    if (!isClassroom) {
        return {
            success: true,
            precheckEnabled: true,
            state: "skipped",
            message: "Not a GitHub Classroom invite URL."
        };
    }

    try {
        const result = await ensureGithubOrgMembership({ firebaseUid: auth.uid, org: GITHUB_CLASSROOM_ORG });
        return {
            success: result.ok === true,
            precheckEnabled: true,
            state: result.state,
            org: result.org,
            githubLogin: result.githubLogin || null,
            inviteSent: result.inviteSent === true,
            inviteId: result.inviteId || null,
            settingsUrl: "https://github.com/settings/organizations"
        };
    } catch (error) {
        console.error("[precheckGithubClassroomAccess] failed:", error);
        return {
            success: false,
            precheckEnabled: true,
            state: "error",
            message: error.message || "precheck failed",
            settingsUrl: "https://github.com/settings/organizations"
        };
    }
});

// 7.3 授權課程老師 (Admin Only)
exports.authorizeTutorForCourse = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', '僅限管理員');

    const { courseId, tutorEmail, action, parentCourseId } = data; // action: 'add' or 'remove'
    if (!courseId || !tutorEmail) throw new HttpsError('invalid-argument', '缺少必要參數');

    try {
        const db = admin.firestore();
        // [V13.0.22] All authorization data is now strictly user-centric. 
        // No longer using centralized course_configs collection.

        if (action === 'add') {
            // ... [ADD Logic remains same focus on unit-level] ...
            let tutorName = fallbackNameFromEmail(tutorEmail);
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const userDoc = await db.collection('users').doc(userRecord.uid).get();
                tutorName = resolveNameFromUserData(userDoc.exists ? (userDoc.data() || {}) : {}, tutorEmail, userRecord.displayName || "");
            } catch (err) {
                console.log(`[Role] Metadata skip: ${err.message}`);
            }

            const tutorData = { email: tutorEmail, name: tutorName, qualifiedAt: new Date().toISOString() };

            // [V12.0.2] Removed legacy writes. All logic now syncs to User Document (below).

            // [NEW v12.0.0] Synchronize with User Document
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                await db.collection('users').doc(tutorUid).set({
                    tutorConfigs: {
                        [courseId]: {
                            authorized: true,
                            email: tutorEmail,
                            name: tutorName,
                            qualifiedAt: new Date().toISOString()
                        }
                    }
                }, { merge: true });
                console.log(`[Role] Successfully synched auth for ${tutorEmail} into user doc.`);
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc for ${tutorEmail}: ${authSyncErr.message}`);
            }

            // [V12.0.2] Removed writes to legacy course_configs.
            // parentDocRef logic is now handled during propagate-on-save in user documents.

            // [V15.2] Unit-Specific Assignment Link & Email Notification
            try {
                const lessons = await getLessons();
                const unitMetadata = lessons.find(l => l.courseId === courseId || (l.courseUnits && l.courseUnits.includes(courseId)));
                const unitName = unitMetadata ? (unitMetadata.title || unitMetadata.courseName || courseId) : courseId;

                // Fetch the recently updated assignmentUrl from tutor's config
                const tutorUserRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = tutorUserRecord.uid;
                const tutorDoc = await db.collection('users').doc(tutorUid).get();
                const tutorData = tutorDoc.exists ? tutorDoc.data() : {};
                const assignmentUrl = tutorData.tutorConfigs?.[courseId]?.assignmentUrl || null;

                await sendTutorAuthorizationEmail(tutorEmail, unitName, courseId, assignmentUrl);
                console.log(`[Auth] Authorization link ${assignmentUrl || 'None'} sent to ${tutorEmail} for ${courseId}`);
            } catch (authExtraErr) {
                console.error("[Auth] Failed to generate promo code or send email:", authExtraErr);
            }

            // [MODIFIED] Do NOT set role: 'tutor' in users collection.
            // Authorization is strictly handled at the course_configs unit level.

        } else if (action === 'remove') {
            // [V12.0.2] Removed legacy writes. All logic now syncs to User Document (below).

            // [NEW v12.0.0] Synchronize with User Document (Remove Authorization)
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                await db.collection('users').doc(tutorUid).set({
                    tutorConfigs: {
                        [courseId]: {
                            authorized: false,
                            updatedAt: new Date().toISOString()
                        }
                    }
                }, { merge: true });
                console.log(`[Role] Successfully removed auth for ${tutorEmail} from user doc.`);
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc removal for ${tutorEmail}: ${authSyncErr.message}`);
            }

            return { success: true };
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// 7.4 一次性遷移：此功能已於 2026-03-27 執行完畢並移除。

// ==========================================
// 7.1. 申請合格教師 (applyForTutorRole)
exports.applyForTutorRole = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { unitId } = data;
    if (!unitId) throw new HttpsError('invalid-argument', 'Missing unitId');

    const uid = auth.uid;
    const email = auth.token.email;
    const db = admin.firestore();
    const lessons = await getLessons();
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);

    // 1. Update User Document (Internal Applications & Auto-Checking)
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Check if user is already authorized
    const tutorConfigs = userData.tutorConfigs || {};
    if (tutorConfigs[canonicalUnitId] && tutorConfigs[canonicalUnitId].authorized) {
        throw new HttpsError('already-exists', 'You are already a qualified tutor for this unit.');
    }

    // Check for existing pending application in the user's own document
    const applications = userData.tutorApplications || [];
    const hasPending = applications.some(app => app.unitId === canonicalUnitId && app.status === 'pending');
    if (hasPending) {
        throw new HttpsError('already-exists', 'You have a pending application for this unit.');
    }

    // Create application object
    const application = {
        userId: uid,
        userEmail: email,
        unitId: canonicalUnitId,
        status: 'pending',
        source: 'self_application',
        appliedAt: new Date().toISOString()
    };

    // [Single Source of Truth] write to tutor_applications
    const newAppRef = await db.collection('tutor_applications').add({
        ...application,
        appliedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update User Document
    await userRef.set({
        tutorApplications: admin.firestore.FieldValue.arrayUnion({
            ...application,
            applicationId: newAppRef.id
        }),
        hasPendingApplication: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Notify Admin via Email
    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, email, canonicalUnitId);

    return { success: true, applicationId: newAppRef.id };
});

// [DEBUG TOOL] 偵錯專用：查看目前教師屬性結構
exports.debugTutorAuth = onRequest(async (req, res) => {
    const email = req.query.email || 'rover.k.chen@gmail.com';
    const db = admin.firestore();
    try {
        const usersSnap = await db.collection('users').where('email', '==', email).get();
        if (usersSnap.empty) return res.status(404).send("User document not found.");
        const data = usersSnap.docs[0].data();
        return res.status(200).json({ 
            email: email,
            tutorConfigs: data.tutorConfigs || {},
            fullDoc: data
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

exports.recommendTutorForUnit = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);

    const { assignmentId } = data;
    if (!assignmentId) throw new HttpsError('invalid-argument', 'Missing assignmentId');

    const db = admin.firestore();
    const lessons = await getLessons();
    const assignmentRef = db.collection('assignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();
    if (!assignmentDoc.exists) throw new HttpsError('not-found', 'Assignment not found');

    const assignment = assignmentDoc.data();
    const candidateUid = assignment.userId;
    const candidateEmail = assignment.userEmail;
    const canonicalUnitId = resolveCanonicalUnitId(assignment.unitId, lessons);
    if (!candidateUid || !candidateEmail || !canonicalUnitId) {
        throw new HttpsError('failed-precondition', 'Assignment metadata is incomplete.');
    }
    const autoGradeScore = Number(assignment.autoGrade?.score);
    const recommendationThreshold = 100;
    if (!Number.isFinite(autoGradeScore)) {
        throw new HttpsError('failed-precondition', 'Assignment must have a valid auto-grade score before recommendation.');
    }
    if (autoGradeScore < recommendationThreshold) {
        throw new HttpsError('failed-precondition', `Auto-grade score must be >= ${recommendationThreshold} before recommendation.`);
    }

    // Check permissions of the requester in their own user document
    const requesterDoc = await db.collection('users').doc(auth.uid).get();
    const requesterData = requesterDoc.exists ? requesterDoc.data() : {};
    const requesterTutorConfigs = requesterData.tutorConfigs || {};
    const isAuthorizedForThisUnit = !!(getEffectiveTutorConfig(canonicalUnitId, requesterTutorConfigs)?.authorized);

    if (requesterRole !== 'admin' && !isAuthorizedForThisUnit) {
        throw new HttpsError('permission-denied', 'Only the qualified tutor for this unit can recommend students.');
    }
    if (requesterRole !== 'admin' && assignment.assignedTutorEmail !== auth.token.email) {
        throw new HttpsError('permission-denied', 'Only the assigned tutor can recommend this student.');
    }

    // Check if candidate is already qualified
    const candidateDoc = await db.collection('users').doc(candidateUid).get();
    const candidateData = candidateDoc.exists ? candidateDoc.data() : {};
    const candidateTutorConfigs = candidateData.tutorConfigs || {};
    if (getEffectiveTutorConfig(canonicalUnitId, candidateTutorConfigs)?.authorized) {
        throw new HttpsError('already-exists', 'Student is already a qualified tutor for this unit.');
    }

    const existingPending = await db.collection('tutor_applications')
        .where('userId', '==', candidateUid)
        .where('unitId', '==', canonicalUnitId)
        .where('status', 'in', ['pending', 'awaiting_candidate_link'])
        .limit(1)
        .get();

    if (!existingPending.empty) {
        const existingStatus = (existingPending.docs[0].data() || {}).status;
        if (existingStatus === 'awaiting_candidate_link') {
            throw new HttpsError('already-exists', 'Student already has a pending recommendation waiting for classroom invite link.');
        }
        throw new HttpsError('already-exists', 'Student already has a pending application for this unit.');
    }

    const application = {
        userId: candidateUid,
        userEmail: candidateEmail,
        unitId: canonicalUnitId,
        status: 'awaiting_candidate_link',
        source: 'tutor_recommendation',
        recommendedByUid: auth.uid,
        recommendedByEmail: auth.token.email || '',
        recommendedFromAssignmentId: assignmentId,
        recommendedAt: admin.firestore.FieldValue.serverTimestamp(),
        candidateClassroomInviteUrl: '',
        candidateLinkSubmittedAt: null,
        appliedAt: null
    };

    const newAppRef = await db.collection('tutor_applications').add(application);
    await sendTutorRecommendationCandidateEmail(candidateEmail, canonicalUnitId, auth.token.email || '', newAppRef.id);

    return { success: true, applicationId: newAppRef.id, status: 'awaiting_candidate_link' };
});

exports.submitTutorRecommendationInviteLink = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { applicationId, classroomInviteUrl } = data;
    if (!applicationId || !classroomInviteUrl) {
        throw new HttpsError('invalid-argument', 'Missing applicationId or classroomInviteUrl');
    }

    const normalizedInvite = normalizeGitHubUrl(String(classroomInviteUrl).trim());
    if (!normalizedInvite.includes('classroom.github.com/a/')) {
        throw new HttpsError('invalid-argument', 'Classroom invite link must be a valid GitHub Classroom invitation URL.');
    }

    const db = admin.firestore();
    const appRef = db.collection('tutor_applications').doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError('not-found', 'Application not found.');

    const appData = appSnap.data() || {};
    if (appData.userId !== auth.uid) {
        throw new HttpsError('permission-denied', 'You can only submit your own application link.');
    }
    if (appData.source !== 'tutor_recommendation') {
        throw new HttpsError('failed-precondition', 'This action is only valid for tutor recommendations.');
    }
    if (appData.status !== 'awaiting_candidate_link') {
        throw new HttpsError('failed-precondition', 'This application is not waiting for candidate invite link.');
    }

    await appRef.update({
        candidateClassroomInviteUrl: normalizedInvite,
        candidateLinkSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, appData.userEmail || auth.token.email || '', appData.unitId || '');

    return { success: true, status: 'pending' };
});

// 7.2. 決策合格教師申請 (decideTutorApplication)
exports.decideTutorApplication = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', 'Only admins can resolve applications.');

    const { applicationId, status, adminMessage } = data; // status: 'approved' or 'rejected'
    if (!applicationId || !['approved', 'rejected'].includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid parameters');
    }

    const db = admin.firestore();
    const appRef = db.collection('tutor_applications').doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError('not-found', 'Pending application not found.');

    const appData = appSnap.data() || {};
    if (appData.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Application is already resolved.');
    }
    const { userEmail, unitId, userId } = appData;
    const targetUserRef = db.collection('users').doc(userId);
    const targetUserDoc = await targetUserRef.get();
    const userData = targetUserDoc.exists ? (targetUserDoc.data() || {}) : {};

    const lessons = await getLessons();
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const parentCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons);

    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status === 'approved') {
        const tutorName = resolveNameFromUserData(userData, userEmail, "");

        const tutorData = { 
            authorized: true,
            email: userEmail, 
            name: tutorName, 
            qualifiedAt: new Date().toISOString(),
            githubClassroomUrl: "authorized" // Initial placeholder
        };

        updateData[new admin.firestore.FieldPath('tutorConfigs', canonicalUnitId)] = tutorData;

        // No code generation: the tutor's GitHub Classroom assignment link is now the only referral medium.
    }

    await appRef.update({
        status,
        adminMessage: adminMessage || "",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: auth.uid
    });

    // Keep user snapshot in sync for legacy UI compatibility
    const userApplications = Array.isArray(userData.tutorApplications) ? [...userData.tutorApplications] : [];
    const legacyIndex = userApplications.findIndex(a => a.applicationId === applicationId);
    if (legacyIndex >= 0) {
        userApplications[legacyIndex].status = status;
        userApplications[legacyIndex].adminMessage = adminMessage || "";
        userApplications[legacyIndex].resolvedAt = new Date().toISOString();
    } else {
        userApplications.push({
            applicationId,
            userId,
            userEmail,
            unitId: canonicalUnitId,
            status,
            adminMessage: adminMessage || "",
            source: appData.source || 'unknown',
            appliedAt: appData.appliedAt || new Date().toISOString(),
            resolvedAt: new Date().toISOString()
        });
    }

    const stillHasPendingSnap = await db.collection('tutor_applications')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    await targetUserRef.set({
        ...updateData,
        tutorApplications: userApplications,
        hasPendingApplication: !stillHasPendingSnap.empty
    }, { merge: true });

    // Notify User via Email
    await sendApplicationResultEmail(userEmail, canonicalUnitId, status, adminMessage);

    return { success: true };
});

// 8. 獲取儀表板數據 (getDashboardData)
// ==========================================
exports.getDashboardData = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    console.log(`[getDashboardData] Start - UID: ${auth?.uid}, data: ${JSON.stringify(data)}`);
    
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = auth.uid;
    const email = auth.token.email;
    const requesterRole = await getRole(uid);
    console.log(`[getDashboardData] Requester UID: ${uid}, Email: ${email}, Role: ${requesterRole}`);
    const db = admin.firestore();
    const lessons = await getLessons();
    const physicalUnitIds = new Set(lessons.filter(l => l.isPhysical === true).map(l => l.id));
    
    // [V12.1.2] SECURITY RULE: Global dashboard (no unitId) is ADMIN ONLY.
    if (!data.unitId && !data.courseId && requesterRole !== 'admin') {
        console.warn(`[getDashboardData] BLOCKED: Non-admin user ${email} attempted global view.`);
        throw new HttpsError('permission-denied', 'You must specify a unitId or courseId to view your dashboard.');
    }
    
    const canonicalCourseId = (value) => String(value || '');

    try {
        // 0. Fetch Course Authorization Data
        const authorizedCourseIds = [];
        const courseGuideIndex = {};
        const unitTutorConfigs = {};
        const unitToDocId = {}; // [LEGACY] Map unit filename -> Firestore docId
        // [Single Source] Fetch Tutor Application Status for THIS user from tutor_applications
        const myApplicationsMapping = {};
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        try {
            const myAppsSnapshot = await db.collection('tutor_applications')
                .where('userId', '==', uid)
                .orderBy('appliedAt', 'desc')
                .limit(100)
                .get();
            myAppsSnapshot.forEach(doc => {
                const app = doc.data() || {};
                if (!app.unitId) return;
                if (!myApplicationsMapping[app.unitId]) {
                    myApplicationsMapping[app.unitId] = {
                        status: app.status,
                        appliedAt: app.appliedAt,
                        applicationId: doc.id
                    };
                }
            });
        } catch (appErr) {
            console.warn("[getDashboardData] Failed to fetch user applications from tutor_applications:", appErr.message);
        }

        // [NEW v12.0.1] Tutor Authorization Summary for Frontend
        // We can just return the tutorConfigs directly if needed, or map it.
        const myTutorConfigs = userData.tutorConfigs || {};

        // [NEW] Fetch Global Tutor Terms
        let tutorTerms = "";
        try {
            const termsDoc = await db.collection('metadata_settings').doc('tutor_terms').get();
            tutorTerms = termsDoc.exists ? (termsDoc.data().content || "") : "尚未設定合格教師權利義務細則。";
        } catch (e) {
            console.warn("[getDashboardData] Failed to fetch tutor terms:", e);
        }

        // (Admin Only) Fetch all PENDING applications from tutor_applications
        let allPendingApplications = [];
        if (requesterRole === 'admin' && data.tutorMode !== false) {
            const pendingAppsSnapshot = await db.collection('tutor_applications')
                .where('status', '==', 'pending')
                .get();

            pendingAppsSnapshot.forEach(doc => {
                const app = doc.data() || {};
                allPendingApplications.push({
                    id: doc.id,
                    applicationId: doc.id,
                    ...app
                });
            });

            // Sort in-memory
            allPendingApplications.sort((a, b) => {
                const timeA = a.appliedAt?.toMillis ? a.appliedAt.toMillis() : (new Date(a.appliedAt || 0).getTime() || 0);
                const timeB = b.appliedAt?.toMillis ? b.appliedAt.toMillis() : (new Date(b.appliedAt || 0).getTime() || 0);
                return timeB - timeA;
            });
        }

        // Build a guide index from all users' tutorConfigs. This is not the deprecated course_configs collection.
        const usersSnapshot = await db.collection('users').get();
        const synthesizedConfigs = {};

        usersSnapshot.forEach(doc => {
            const uData = doc.data();
            const email = uData.email;
            const tutorConfigs = uData.tutorConfigs || {};

            for (let [unitId, config] of Object.entries(tutorConfigs)) {
                // [FIX] Un-nest if dot-in-key caused nested mapping (e.g. .html)
                if (config && !config.authorized && config.html && config.html.authorized) {
                    config = config.html;
                    if (!unitId.endsWith('.html')) unitId += '.html';
                }

                if (!config.authorized) continue;

                // 尋找此單元所屬的課程 ID
                const courseRecord = lessons.find(l => 
                    (Array.isArray(l.courseUnits) && l.courseUnits.some(u => unitIdsMatch(u, unitId))) ||
                    (l.classroomUrl && l.classroomUrl.includes(unitId))
                );
                const cid = courseRecord ? courseRecord.courseId : unitId;

                if (!synthesizedConfigs[cid]) {
                    synthesizedConfigs[cid] = { authorizedTutors: [], tutorDetails: {}, githubClassroomUrls: {} };
                }

                if (!synthesizedConfigs[cid].githubClassroomUrls[unitId]) {
                    synthesizedConfigs[cid].githubClassroomUrls[unitId] = {};
                }

                if (!synthesizedConfigs[cid].authorizedTutors.includes(email)) {
                    synthesizedConfigs[cid].authorizedTutors.push(email);
                }
                synthesizedConfigs[cid].tutorDetails[email] = {
                    email,
                    name: resolveNameFromUserData(uData, email, ""),
                    qualifiedAt: config.updatedAt || config.qualifiedAt
                };

                if (config.githubClassroomUrl) {
                    synthesizedConfigs[cid].githubClassroomUrls[unitId][email] = config.githubClassroomUrl;
                }

                if (unitId.endsWith('.html')) {
                    if (!unitTutorConfigs[unitId]) {
                        unitTutorConfigs[unitId] = {
                            courseId: cid,
                            authorizedTutors: [],
                            tutorDetails: {},
                            githubClassroomUrls: {}
                        };
                    }

                    if (!unitTutorConfigs[unitId].authorizedTutors.includes(email)) {
                        unitTutorConfigs[unitId].authorizedTutors.push(email);
                    }
                    unitTutorConfigs[unitId].tutorDetails[email] = {
                        email,
                        name: resolveNameFromUserData(uData, email, ""),
                        qualifiedAt: config.updatedAt || config.qualifiedAt
                    };
                    if (config.githubClassroomUrl) {
                        unitTutorConfigs[unitId].githubClassroomUrls[email] = config.githubClassroomUrl;
                    }
                }
            }
        });

        Object.keys(synthesizedConfigs).forEach(docId => {
            try {
                const cfg = synthesizedConfigs[docId];
                const isTutorModeAdmin = requesterRole === 'admin' && data.tutorMode !== false;
                const isAuthorized = isTutorModeAdmin || (Array.isArray(cfg.authorizedTutors) && cfg.authorizedTutors.includes(email));
                const mappedId = docId;

                if (cfg.githubClassroomUrls) {
                    Object.keys(cfg.githubClassroomUrls).forEach(unitId => {
                        const existingDocId = unitToDocId[unitId];
                        if (!existingDocId || !existingDocId.includes('.html')) {
                            unitToDocId[unitId] = docId;
                        }
                        // [FIX] Handle start- prefix mismatch between Firestore and Metadata
                        if (unitId.match(/^0[1-5]-unit-/)) {
                            const startKey = 'start-' + unitId;
                            const existingStartDocId = unitToDocId[startKey];
                            if (!existingStartDocId || !existingStartDocId.includes('.html')) {
                                unitToDocId[startKey] = docId;
                            }
                        }
                    });
                }

                if (docId.includes('.html')) {
                    unitToDocId[docId] = docId;
                    if (docId.match(/^0[1-5]-unit-/)) {
                        unitToDocId['start-' + docId] = docId;
                    }
                    if (docId.match(/^start-0[1-5]-unit-/)) {
                        unitToDocId[docId.replace(/^start-/, '')] = docId;
                    }
                }

                if (isAuthorized) {
                    if (docId.includes('.html')) {
                        // [FIX] Normalize ID to handle start- prefix mismatch
                        const normalizedId = mappedId.replace('start-', '');
                        // Find parent course for this unit
                        const parentCourse = lessons.find(l => 
                            l.courseUnits && (l.courseUnits.includes(mappedId) || l.courseUnits.some(cu => cu.replace('start-', '') === normalizedId))
                        );
                        if (parentCourse && !authorizedCourseIds.includes(parentCourse.courseId)) {
                            authorizedCourseIds.push(parentCourse.courseId);
                        }
                    } else {
                        if (!authorizedCourseIds.includes(mappedId)) {
                            authorizedCourseIds.push(mappedId);
                        }
                    }
                    courseGuideIndex[mappedId] = cfg;
                    if (mappedId !== docId) {
                        courseGuideIndex[docId] = cfg;
                    }
                }
            } catch (err) {
                console.error(`Error processing config for course ${docId}:`, err);
            }
        });

        // [NEW] Extract Instructor Guides for all authorized courses dynamically
        // Refactored to aggregate from all related unit files by prefix
        const privateCoursesDir = path.join(__dirname, 'private_courses');
        console.log(`[getDashboardData] privateCoursesDir: ${privateCoursesDir}`);
        const allFiles = fs.existsSync(privateCoursesDir) ? fs.readdirSync(privateCoursesDir) : [];
        console.log(`[getDashboardData] Total files found: ${allFiles.length}. First 5: ${JSON.stringify(allFiles.slice(0, 5))}`);

        // If admin is in Tutor Mode, ensure all courses are considered for guide aggregation.
        if (requesterRole === 'admin' && data.tutorMode !== false) {
            lessons.forEach(l => {
                if (!authorizedCourseIds.includes(l.courseId)) {
                    authorizedCourseIds.push(l.courseId);
                }
            });
        }


        for (const cid of authorizedCourseIds) {
            const course = lessons.find(l => l.courseId === cid);
            if (course && course.classroomUrl) {
                try {
                    const masterFile = (course.classroomUrl || "").split('/').pop().split('?')[0];
                    const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];
                    
                    const relatedFiles = [masterFile, ...units].filter(f => f && allFiles.includes(f));
                    let aggregatedGuides = {};

                    if (relatedFiles.length > 0) {
                        // console.log(`[getDashboardData] Extracting logs for ${cid}. Files: ${relatedFiles.join(', ')}`);
                        relatedFiles.sort((a, b) => {
                            if (a === masterFile) return -1;
                            if (b === masterFile) return 1;
                            return a.localeCompare(b);
                        });

                        console.log(`[getDashboardData] cid: ${cid}, relatedFiles: ${relatedFiles.join(', ')}`);
                        for (const file of relatedFiles) {
                            const filePath = path.join(privateCoursesDir, file);
                            if (!fs.existsSync(filePath)) continue;

                            const html = fs.readFileSync(filePath, 'utf8');

                            const guideContent = extractHiddenSectionContent(html, 'tutor-guide');
                            const attachContent = extractHiddenSectionContent(html, 'attachment-guide');

                            if (attachContent) {
                                if (!aggregatedGuides.attachment) aggregatedGuides.attachment = {};
                                aggregatedGuides.attachment[file] = attachContent;
                            }

                            if (guideContent) {
                                if (!aggregatedGuides.tutor) aggregatedGuides.tutor = {};
                                aggregatedGuides.tutor[file] = guideContent;
                                console.log(`[getDashboardData] ✅ Found Tutor Guide for ${file} in ${cid}`);
                            } else {
                                console.log(`[getDashboardData] ❌ No Tutor Guide match for ${file} in ${cid}`);
                            }

                        }

                        if (Object.keys(aggregatedGuides).length > 0) {
                            if (!courseGuideIndex[cid]) courseGuideIndex[cid] = {};
                            // [MERGE] Use Object.assign to preserve existing properties from Firestore
                            if (aggregatedGuides.tutor) {
                                courseGuideIndex[cid].tutorGuide = Object.assign({}, courseGuideIndex[cid].tutorGuide || {}, aggregatedGuides.tutor);
                            }
                            if (aggregatedGuides.attachment) {
                                courseGuideIndex[cid].attachmentGuide = Object.assign({}, courseGuideIndex[cid].attachmentGuide || {}, aggregatedGuides.attachment);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to extract aggregated instructor guide for ${cid}:`, e);
                }
            }
        }


        // Determine if this user has any management access (Global Admin/Tutor or Course-Specific Tutor)
        // [V13.6] Rule Enforcement: isManagementView for Admin is IMMUNE to Tutor Mode.
        // This ensures the Overview (Global stats) always shows the full database count.
        const isAdminGlobal = (requesterRole === 'admin');
        const isManagementView = isAdminGlobal || authorizedCourseIds.length > 0;

        let result = {
            role: requesterRole,
            summary: {},
            students: [],
            assignments: [],
            courseGuideIndex: courseGuideIndex,
            unitTutorConfigs: unitTutorConfigs,
            myTutorConfigs: myTutorConfigs,
            unitToDocId: unitToDocId, 
            myReferralLink: null,
            myPromotionCode: null,
            earnings: [],
            // [NEW] Application Workflow support
            myApplications: myApplicationsMapping,
            tutorTerms: tutorTerms,
            pendingApplications: allPendingApplications,
            hardwareOrders: [] // [NEW] Complete hardware order history for admin
        };

        // Fetch profit sharing data and the current unit referral link for tutors.
        if (isManagementView) {
            try {
                if (hasQualifiedTutorStatus(userData)) {
                    const userRef = db.collection('users').doc(uid);
                    result.myPromotionCode = await ensureTutorPromotionCode(db, userRef, userData, uid, email);
                }

                // If a unitId is provided from the frontend, fetch the assignmentUrl for that unit
                const filterUnitId = data.unitId || null;
                if (filterUnitId) {
                    const canonicalId = resolveCanonicalUnitId(filterUnitId, lessons);
                    // [V15.5] Robust field lookup via getEffectiveTutorConfig (Handles nested dots)
                    const unitConfig = getEffectiveTutorConfig(canonicalId, myTutorConfigs);
                    if (unitConfig && unitConfig.authorized) {
                        result.myReferralLink = unitConfig.githubClassroomUrl || unitConfig.assignmentUrl || null;
                    }
                }

                const ledgerSnap = await db.collection('profit_ledger')
                    .where('tutorEmail', '==', email)
                    .limit(500)
                    .get();
                
                result.earnings = ledgerSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => (b.month || "").localeCompare(a.month || ""));
            } catch (err) {
                console.error("Error fetching profit data for dashboard:", err);
            }
        }

        // 1. Fetch Users (Filtering based on access level)
        let usersMap = {};
        if (isManagementView) {
            // Admins see all users. Tutors/Course-Tutors see students.
            let usersSnapshot = await db.collection('users').get();
            
            // [V13.0.15] Maintenance Sync: For admins, ensure EVERY Auth user has a Firestore document.
            // Rule Enforcement: Overview & Data Sync should NOT be affected by Tutor Mode for Admins.
            if (requesterRole === 'admin') {
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    const authUsers = listUsersResult.users;
                    const existingUids = usersSnapshot.docs.map(doc => doc.id);
                    const batch = db.batch();
                    let syncCount = 0;
                    
                    for (const au of authUsers) {
                        const userRef = db.collection('users').doc(au.uid);
                        // Find existing role from snapshot if exists
                        const existingDoc = usersSnapshot.docs.find(d => d.id === au.uid);
                        const role = existingDoc?.data()?.role || 'user';

                        batch.set(userRef, {
                            email: au.email || "",
                            name: au.displayName || fallbackNameFromEmail(au.email || "", "New User"),
                            role: role,
                            createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        syncCount++;
                    }
                    if (syncCount > 0) {
                        console.log(`[getDashboardData] Admin Global Sync: ${syncCount} users processed.`);
                        await batch.commit();
                        usersSnapshot = await db.collection('users').get();
                    }
                } catch (syncErr) {
                    console.error("[getDashboardData] Internal User Sync failed:", syncErr);
                }
            }

            usersSnapshot.forEach(doc => {
                const uData = doc.data();
                const role = uData.role || 'user';
                // [V13.0.16] Visibility Rule: Admin Global View (No Context) ALWAYS shows all users.
                // tutorMode only filters content (not people) in Global View for Admin.
                const isAdmin = requesterRole === 'admin';
                if (isAdmin || role === 'user' || !role) {
                    usersMap[doc.id] = { ...uData, role: role, _id: doc.id };
                }
            });
        } else {
            // Student ONLY view
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) usersMap[uid] = userDoc.data();
        }

        const targetDgUids = Object.keys(usersMap);
        if (targetDgUids.length === 0) return result;

        // 2. Fetch Activity Logs
        let logsQuery = db.collection('activity_logs').limit(5000);

        // If it's a student-only view, restrict by UID immediately
        if (!isManagementView) {
            logsQuery = logsQuery.where('uid', '==', uid);
        }

        const logsSnapshot = await logsQuery.get();
        const studentStats = {};

        logsSnapshot.forEach(doc => {
            const log = doc.data();

            // [NEW] Filter out PAGE_VIEW
            if (log.action === 'PAGE_VIEW') return;

            const sid = log.uid;
            const cid = canonicalCourseId(log.courseId || 'unknown');

            // Authorization Filter for each log:
            // - It's my own log
            // - I'm a global admin/tutor
            // - I'm an authorized tutor for this specific course
            const isAuthorizedForLog = (sid === uid) || (requesterRole === 'admin') || authorizedCourseIds.includes(cid);

            if (isAuthorizedForLog && usersMap[sid]) {
                if (!studentStats[sid]) {
                    studentStats[sid] = {
                        uid: sid,
                        email: usersMap[sid]?.email || 'Unknown',
                        name: usersMap[sid]?.name || '', // [NEW] Include student name
                        role: usersMap[sid]?.role || 'user',
                        totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                        courseProgress: {},
                        unitAssignments: usersMap[sid]?.unitAssignments || {},
                        orders: [] // Will be populated below
                    };
                }

                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;
                if (log.action === 'VIDEO') studentStats[sid].videoTime += duration;
                if (log.action === 'DOC') studentStats[sid].docTime += duration;

                if (!studentStats[sid].lastActive) {
                    studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                }

                if (!studentStats[sid].courseProgress[cid]) {
                    studentStats[sid].courseProgress[cid] = { total: 0, video: 0, doc: 0, page: 0, logs: [] };
                }
                const cp = studentStats[sid].courseProgress[cid];
                cp.total += duration;
                if (log.action === 'VIDEO') cp.video += duration;
                if (log.action === 'DOC') cp.doc += duration;
                if (log.action === 'PAGE_VIEW') cp.page += duration;

                cp.logs.push({
                    action: log.action,
                    duration: duration,
                    timestamp: log.timestamp,
                    metadata: log.metadata
                });
            }
        });

        // [NEW] 2.5 Fetch successful orders to identify paid students without logs
        if (isManagementView) {
            try {
                const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
                ordersSnapshot.forEach(doc => {
                    const order = doc.data();
                    const sid = order.uid;
                    if (!sid || sid === 'GUEST') return;

                    // If student already has activity, their entry exists in studentStats.
                    // If not, we create a placeholder entry so they show up in the list.
                    if (!studentStats[sid] && usersMap[sid]) {
                        studentStats[sid] = {
                            uid: sid,
                            email: usersMap[sid].email || 'Unknown',
                            name: usersMap[sid].name || '', // [NEW] Include name
                            role: usersMap[sid].role || 'user',
                            totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                            courseProgress: {},
                            accountStatus: 'paid',
                            unitAssignments: usersMap[sid].unitAssignments || {},
                            orders: []
                        };
                    } else if (studentStats[sid]) {
                        // Just ensure they have the unitAssignments field
                        studentStats[sid].unitAssignments = usersMap[sid].unitAssignments || {};
                        studentStats[sid].accountStatus = 'paid';
                        if (!studentStats[sid].orders) studentStats[sid].orders = [];
                    }

                    // Map order items to course progress placeholder if missing
                    // This ensures the student appears under the specific course/unit management listing
                    if (studentStats[sid] && order.items) {
                        if (!studentStats[sid].orderRecords) studentStats[sid].orderRecords = [];
                        const logistics = order.logistics || {};
                        studentStats[sid].orderRecords.push({
                            id: doc.id,
                            createdAt: order.createdAt || null,
                            paidAt: order.paidAt || null,
                            paymentDate: order.paymentDate || null,
                            expiryDate: order.expiryDate || null,
                            fulfillmentStatus: order.fulfillmentStatus || 'PENDING',
                            logistics,
                            shippingContact: {
                                name: logistics.receiverName || logistics.ReceiverName || '',
                                phone: logistics.receiverPhone || logistics.ReceiverCellPhone || logistics.ReceiverPhone || ''
                            },
                            shippingAddress: logistics.storeAddress || logistics.CVSAddress || logistics.ReceiverAddress || '',
                            items: order.items
                        });
                        Object.keys(order.items).forEach(originalCid => {
                            const cid = canonicalCourseId(originalCid);
                            if (!studentStats[sid].orders.includes(cid)) {
                                studentStats[sid].orders.push(cid);
                            }
                            if (!studentStats[sid].courseProgress[cid]) {
                                studentStats[sid].courseProgress[cid] = {
                                    total: 0, video: 0, doc: 0, page: 0, logs: [],
                                    isLicenseOnly: true // Mark as having license but no activity
                                };
                            }
                        });
                    }
                });
            } catch (orderErr) {
                console.error("Error fetching orders for dashboard:", orderErr);
            }
        }

        // [NEW] Student view: include own successful order records (shipment status/details)
        if (!isManagementView) {
            try {
                const myOrdersSnapshot = await db.collection('orders')
                    .where('uid', '==', uid)
                    .where('status', '==', 'SUCCESS')
                    .get();

                if (!studentStats[uid] && usersMap[uid]) {
                    studentStats[uid] = {
                        uid,
                        email: usersMap[uid]?.email || 'Unknown',
                        name: usersMap[uid]?.name || '',
                        role: usersMap[uid]?.role || 'user',
                        totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                        courseProgress: {},
                        unitAssignments: usersMap[uid]?.unitAssignments || {},
                        orders: [],
                        orderRecords: []
                    };
                }

                myOrdersSnapshot.forEach(doc => {
                    const order = doc.data() || {};
                    const logistics = order.logistics || {};
                    if (!studentStats[uid].orderRecords) studentStats[uid].orderRecords = [];
                    studentStats[uid].orderRecords.push({
                        id: doc.id,
                        createdAt: order.createdAt || null,
                        paidAt: order.paidAt || null,
                        paymentDate: order.paymentDate || null,
                        expiryDate: order.expiryDate || null,
                        fulfillmentStatus: order.fulfillmentStatus || 'PENDING',
                        logistics,
                        shippingContact: {
                            name: logistics.receiverName || logistics.ReceiverName || '',
                            phone: logistics.receiverPhone || logistics.ReceiverCellPhone || logistics.ReceiverPhone || ''
                        },
                        shippingAddress: logistics.storeAddress || logistics.CVSAddress || logistics.ReceiverAddress || '',
                        items: order.items || {}
                    });

                    Object.keys(order.items || {}).forEach(originalCid => {
                        const cid = canonicalCourseId(originalCid);
                        if (!studentStats[uid].orders) studentStats[uid].orders = [];
                        if (!studentStats[uid].orders.includes(cid)) {
                            studentStats[uid].orders.push(cid);
                        }
                    });
                });
            } catch (myOrderErr) {
                console.error("Error fetching student's own orders for dashboard:", myOrderErr);
            }
        }

        // [NEW] Ensure the global admin overview includes every registered user, even with no activity.
        const shouldIncludeAllRegisteredUsers = isManagementView && requesterRole === 'admin' && !data.unitId && !data.courseId;

        // [NEW] Ensure all relevant users are included, along with registration time
        if (isManagementView) {
            Object.keys(usersMap).forEach(sid => {
                const userRole = usersMap[sid].role || 'user';
                const shouldIncludeUser = shouldIncludeAllRegisteredUsers || userRole === 'user' || !userRole;
                
                if (!studentStats[sid] && shouldIncludeUser) {
                    studentStats[sid] = {
                        uid: sid,
                        email: usersMap[sid].email || 'Unknown',
                        name: usersMap[sid].name || '',
                        role: userRole,
                        createdAt: usersMap[sid].createdAt || null,
                        totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                        courseProgress: {},
                        accountStatus: 'free',
                        unitAssignments: usersMap[sid].unitAssignments || {},
                        orders: [],
                        orderRecords: []
                    };
                } else if (studentStats[sid]) {
                    // Always try to use the raw createdAt from usersMap if available
                    if (!studentStats[sid].createdAt) {
                        studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                    }
                }
            });
        }

        // [V13.0.14] UNIFIED STUDENT FILTERING: Filter students based on authorization scope.
        // 1. Admin Global with Tutor Mode ON: All students.
        // 2. Unit Context: Only students in that unit (assigned to the tutor).
        // 3. Course Context: Only students in that course.
        // 4. Tutor Global (Tutor Mode): Only students assigned to THEM.
        
        const filteredStudentStats = [];
        const isAdmin = requesterRole === 'admin';
        const isTutorModeAdmin = isAdmin && data.tutorMode !== false;
        const targetUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const targetCourseId = data.courseId || null;

        Object.values(studentStats).forEach(s => {
            // [A] Master Bypass for Admin in Global View (Overview)
            // Rule: Overview should not be affected by Tutor Mode simulation.
            if (isAdmin && !targetUnitId && !targetCourseId) {
                filteredStudentStats.push(s);
                return;
            }

            // [B] Authorization Check for Simulated or Standard Tutor
            let isRelevant = false;
            
            // 1. Assignment Check: Is the student assigned to THIS tutor for THIS unit?
            if (targetUnitId) {
                const assignedTutor = s.unitAssignments?.[targetUnitId];
                if (assignedTutor === email || isTutorModeAdmin) {
                    isRelevant = true;
                }
            } else if (targetCourseId) {
                // Course Check: Does the student have orders or assignments for this course?
                const hasCourseOrder = (s.orders || []).includes(targetCourseId);
                const assignedToAnyInCourse = Object.keys(s.unitAssignments || {}).some(uid => {
                    const parent = findParentCourseIdByUnit(uid, lessons);
                    return parent === targetCourseId && (s.unitAssignments[uid] === email || isTutorModeAdmin);
                });
                if (hasCourseOrder || assignedToAnyInCourse) isRelevant = true;
            } else {
                // Global Tutor View (No Context): Only see students assigned to THEM at all
                const hasAnyAssignmentToMe = Object.values(s.unitAssignments || {}).some(t => t === email);
                if (hasAnyAssignmentToMe || isTutorModeAdmin) isRelevant = true;
            }

            if (isRelevant) filteredStudentStats.push(s);
        });

        result.students = filteredStudentStats;

        // 2.5 Fetch Tutors (Administrators and Authorized Tutors)
        const tutorList = [];
        Object.entries(usersMap).forEach(([uid, data]) => {
            const role = data.role || 'user';
            if (role === 'admin' || hasQualifiedTutorStatus(data)) {
                tutorList.push({
                    uid,
                    email: data.email || 'No Email',
                    name: data.name || 'Anonymous',
                    role: role,
                    tutorConfigs: data.tutorConfigs || {}
                });
            }
        });
        result.tutors = tutorList;

        // 3. Fetch Assignments
        let assignQuery = db.collection('assignments');
        if (!isManagementView) {
            assignQuery = assignQuery.where('userId', '==', uid);
        }
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach(doc => {
            const data = doc.data();
            // [REPAIR] If userId/uid is missing in fields, extract from Doc ID (UID_ASSIGNMENTID)
            let targetUid = data.userId || data.uid;
            if (!targetUid && doc.id.includes('_')) {
                targetUid = doc.id.split('_')[0];
            }
            
            const originalCid = data.courseId || 'unknown';
            const mappedCid = canonicalCourseId(originalCid);

            const assignmentTutor = data.assignedTutorEmail || null;
            const requesterEmail = auth.token.email || "";

            // Authorization Filter for each assignment
            // 1. My own assignment (Student/Any)
            // 2. Admin can see all
            // 3. Tutor can see if: assigned to them OR they have access to the (possibly legacy) courseId
            // [V14.10] DECOUPLED: Tutors authorized for any relevant course can see the assignment if unit matches.
            const requesterHasTutorAccess = hasQualifiedTutorStatus(userData);
            const isAuthorizedForAssign = (targetUid === uid) || 
                                          (requesterRole === 'admin') || 
                                          (requesterHasTutorAccess && (
                                              assignmentTutor === requesterEmail || 
                                              authorizedCourseIds.includes(mappedCid) ||
                                              (data.unitId && authorizedCourseIds.some(cid => {
                                                  // Basic check: if tutor has access to a course that includes this unit
                                                  // (This is advanced/deferred: currently trust mappedCid)
                                                  return false; 
                                              }))
                                          ));

            if (isAuthorizedForAssign) {
                // If admin, we allow it through even if student info is partially missing
                const studentInfo = usersMap[targetUid] || {};
                result.assignments.push({
                    id: doc.id,
                    ...data,
                    userId: targetUid, // Ensure normalized UID is present
                    courseId: mappedCid, 
                    studentEmail: studentInfo.email || data.userEmail || data.studentEmail || (targetUid ? `User: ${targetUid.slice(0,8)}` : 'Unknown Student')
                });
            }
        });

        // 3.5 Fetch Active Interventions for Tutor / Admin Dashboard
        let interventions = [];
        const isTutorOrAdmin = requesterRole === 'admin' || hasQualifiedTutorStatus(userData);
        if (isTutorOrAdmin) {
            try {
                const intSnapshot = await db.collection('assignment_interventions')
                    .get();

                intSnapshot.forEach(doc => {
                    const intData = doc.data();
                    const studentUid = intData.studentUid;
                    const studentInfo = usersMap[studentUid] || {};

                    // In-memory filter for tutor owned / unassigned
                    if (requesterRole !== 'admin' && intData.ownerTutorEmail && intData.ownerTutorEmail !== email) {
                        return; // Owned by another tutor
                    }

                    interventions.push({
                        id: doc.id,
                        ...intData,
                        studentEmail: studentInfo.email || data.userEmail || data.studentEmail || (studentUid ? `User: ${studentUid.slice(0,8)}` : 'Unknown Student')
                    });
                });
            } catch (intErr) {
                console.warn("[getDashboardData] Failed to fetch assignment_interventions:", intErr.message);
            }
        }
        result.interventions = interventions;

        // Summary
        const registeredUserStats = result.students;
        const paidStudentStats = result.students.filter(s => s.accountStatus === 'paid' && (s.role === 'user' || !s.role));

        result.summary = {
            totalStudents: registeredUserStats.length,
            totalPaidStudents: paidStudentStats.length,
            totalHours: paidStudentStats.reduce((acc, curr) => acc + curr.totalTime, 0) / 3600
        };

        // [NEW] 2.6 Aggregate Pending Shipments for Admin
        if (requesterRole === 'admin') {
            const pendingShipments = [];
            try {
                const shipmentsSnapshot = await db.collection('orders')
                    .where('status', '==', 'SUCCESS')
                    .get();

                shipmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const items = data.items || {};
                    const physicalItems = Object.keys(items).filter(id => {
                        const canonicalId = canonicalCourseId(id);
                        const itemData = items[id] || {};
                        if (itemData.isPhysical === true) return true;
                        return physicalUnitIds.has(canonicalId) || physicalUnitIds.has(id);
                    });

                    if (physicalItems.length > 0) {
                        const student = usersMap[data.uid] || {};
                        const logistics = data.logistics || {};
                        const shippingContact = {
                            name: logistics.receiverName || logistics.ReceiverName || '',
                            phone: logistics.receiverPhone || logistics.ReceiverCellPhone || logistics.ReceiverPhone || ''
                        };
                        const shippingAddress = logistics.storeAddress || logistics.CVSAddress || logistics.ReceiverAddress || '';
                        const orderRecord = {
                            id: doc.id,
                            uid: data.uid,
                            email: student.email || '未提供',
                            name: student.name || '未提供',
                            amount: data.amount || 0,
                            paidAt: data.paidAt ? data.paidAt.toDate().toISOString() : (data.createdAt ? data.createdAt.toDate().toISOString() : null),
                            status: data.status,
                            fulfillmentStatus: data.fulfillmentStatus || 'PENDING',
                            logistics,
                            shippingContact,
                            shippingAddress,
                            items: physicalItems.map(id => {
                                const canonicalId = canonicalCourseId(id);
                                return lessons.find(l => l.id === canonicalId)?.title || items[id]?.name || id;
                            })
                        };
                        result.hardwareOrders.push(orderRecord);
                        if (data.fulfillmentStatus !== 'SHIPPED') {
                            pendingShipments.push(orderRecord);
                        }
                    }
                });
                result.hardwareOrders.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
                result.pendingShipments = pendingShipments;
                result.pendingShipmentsCount = pendingShipments.length;
            } catch (shipErr) {
                console.error("Error aggregating shipments:", shipErr);
            }
        }

        result.lessons = lessons; // [NEW] Backend fallback for frontend loadLessons() failures
        return result;

    } catch (error) {
        console.error("Dashboard Data Error:", error);
        throw new HttpsError('internal', 'Failed to fetch dashboard data.');
    }
});

// 8.0 指派學生給老師 (Admin/Tutor)
exports.assignStudentToTutor = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    if (requesterRole !== 'admin') {
        throw new HttpsError('permission-denied', '僅限管理員執行此操作');
    }

    const { studentUid, unitId, tutorEmail } = data;
    if (!studentUid) throw new HttpsError('invalid-argument', '缺少學生 ID');
    if (!unitId) throw new HttpsError('invalid-argument', '缺少單元 ID');

    try {
        await upsertStudentUnitAssignment(admin.firestore(), studentUid, unitId, tutorEmail || null, uid, true);

        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// ==========================================
// 8. 作業系統 (Assignment System)
// ==========================================

// 8.1 作業紀錄寫入/正式提交 (Student)
exports.submitAssignment = onCall(async (request) => {
    const { data, auth } = request;
    // 1. Verify Auth
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { courseId, unitId, assignmentId, url, note, title, status, assignmentType } = data;
    const userId = auth.uid;
    const userEmail = auth.token.email || "Unknown";
    const userName = await resolveUserDisplayName(admin.firestore(), userId, userEmail, auth.token.name || "");

    // Simple validation (unless just starting)
    const currentStatus = status || "submitted";
    if (!url && currentStatus !== 'started') {
        throw new HttpsError('invalid-argument', '請提供作業連結 (GitHub / Demo)');
    }

    const db = admin.firestore();
    // Unique ID for the submission
    const docId = `${userId}_${assignmentId}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const lessons = await getLessons();
        const access = await resolveStudentAssignmentAccess(db, userId, courseId, unitId, lessons);
        if (!access.authorized) {
            throw new HttpsError('permission-denied', '尚未完成此課程付款授權。');
        }

        const assignedTutorEmail = access.assignedTutorEmail || null;
        if (access.requiresTutorAssignment && !assignedTutorEmail) {
            throw new HttpsError('failed-precondition', '此單元尚未完成老師指派，暫時無法建立作業紀錄。');
        }

        const submissionUrl = String(url || "").trim();
        const isClassroomInvite = /classroom\.github\.com\/a\//i.test(submissionUrl);
        if (currentStatus === "submitted" && isClassroomInvite && GITHUB_ORG_ADMIN_TOKEN) {
            const membership = await ensureGithubOrgMembership({ firebaseUid: userId, org: GITHUB_CLASSROOM_ORG });
            if (!membership.ok) {
                const base = '尚未完成 GitHub Classroom 組織授權。請先到 https://github.com/settings/organizations 接受邀請後重試。';
                const detail = membership.state === "missing_github_identity"
                    ? '（目前帳號尚未綁定 GitHub 登入）'
                    : membership.state === "invited"
                        ? '（系統已自動補發邀請）'
                        : '';
                throw new HttpsError('failed-precondition', `${base}${detail}`);
            }
        }

        // Prevent status downgrade
        const existingDoc = await docRef.get();
        let finalStatus = currentStatus;
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            const existingStatus = existingData.currentStatus || existingData.status;
            if ((existingStatus === 'submitted' || existingStatus === 'graded') && currentStatus === 'started') {
                finalStatus = existingStatus;
            }
        }

        const now = admin.firestore.Timestamp.now();
        const submittedAtISO = new Date().toISOString();

        const historyEntry = {
            timestamp: submittedAtISO,
            url: url || "",
            note: note || '',
            action: currentStatus === 'started' ? 'START' : 'SUBMIT'
        };

        const assignmentData = {
            id: docId,
            userId,
            userEmail,
            userName,
            courseId: courseId || "unknown_course",
            unitId: unitId || "unknown_unit",
            assignmentId,
            assignmentTitle: title || assignmentId,
            assignmentUrl: url || "",
            studentNote: note || "",
            status: finalStatus,
            currentStatus: finalStatus,
            assignmentType: assignmentType || "manual",
            assignedTutorEmail,
            learningState: existingDoc.exists ? (existingDoc.data().learningState || 'in_progress') : 'in_progress',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (existingDoc.exists) {
            // 更新現有紀錄：推送 historyEntry 並覆蓋 assignment 元數據
            await docRef.update({
                ...assignmentData,
                submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
            });
        } else {
            // 全新繳交：初始化並設定 submittedAt
            await docRef.set({
                ...assignmentData,
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                grade: null,
                tutorFeedback: null,
                submissionHistory: [historyEntry]
            }, { merge: true });
        }

        if (currentStatus === 'submitted' && assignedTutorEmail) {
            const dashboardUrl = `https://vibe-coding.tw/dashboard.html?courseId=${encodeURIComponent(access.effectiveCourseId)}&unitId=${encodeURIComponent(access.canonicalUnitId)}&tab=assignments`;
            await sendAssignmentNotification(assignedTutorEmail, userName, assignmentData.assignmentTitle, dashboardUrl);
        }

        return { success: true, message: currentStatus === 'started' ? "紀錄已更新" : "作業繳交成功！" };

    } catch (e) {
        console.error("Submit Assignment Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

exports.gradeAssignment = onCall(async (request) => {
    throw new HttpsError(
        'failed-precondition',
        'Manual grading has been removed. Please use GitHub autograde sync.'
    );
});

// 8.2 GitHub 自動評分寫回 (MVP)
exports.ingestGithubAutograde = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const signature = req.get("x-hub-signature-256") || "";
        if (GITHUB_WEBHOOK_SECRET) {
            if (!signature.startsWith("sha256=")) {
                return res.status(401).json({ success: false, error: "Missing signature" });
            }
            const expected = "sha256=" + crypto
                .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
                .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
                .digest("hex");
            const sigBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return res.status(401).json({ success: false, error: "Invalid signature" });
            }
        }

        const payload = (req.body && typeof req.body === "object") ? req.body : {};
        const assignmentDocId = payload.assignmentDocId || payload.assignment?.docId || null;
        const userId = payload.userId || payload.assignment?.userId || null;
        const assignmentId = payload.assignmentId || payload.assignment?.assignmentId || null;
        const unitIdFromPayload = payload.unitId || payload.assignment?.unitId || null;
        const repositoryFullName = payload.repository?.full_name || payload.repo || "";
        const scoreRaw = payload.score ?? payload.grade ?? payload.autoGrade?.score;
        const maxScoreRaw = payload.maxScore ?? payload.autoGrade?.maxScore ?? null;
        const score = Number(scoreRaw);
        const maxScore = maxScoreRaw !== null && maxScoreRaw !== undefined ? Number(maxScoreRaw) : null;

        const effectiveUnitId = (unitIdFromPayload || assignmentId || "").replace(/\.html$/, "");
        let resolvedDocId = assignmentDocId || (userId && effectiveUnitId ? `${userId}_${effectiveUnitId}` : null);

        const inferUnitIdFromRepo = (repoFullName = "") => {
            const repoName = String(repoFullName || "").split("/").pop() || "";
            // Typical classroom repo name pattern contains duplicated unit id:
            // vibe-coding-classroom-01-unit-vscode-online-01-unit-vscode-online
            const m = repoName.match(/((?:\d{2}|start-\d{2}|basic-\d{2}|adv-\d{2})-unit-[a-z0-9-]+)/i);
            if (!m || !m[1]) return null;
            return `${m[1].toLowerCase()}.html`;
        };

        const scoreStatusRank = (status = "") => {
            const s = String(status || "").toLowerCase();
            if (s === "graded") return 0;
            if (s === "submitted") return 1;
            if (s === "started") return 9;
            return 5;
        };

        const tsToMs = (value) => {
            if (!value) return 0;
            if (typeof value.toMillis === "function") return value.toMillis();
            if (typeof value === "number") return value;
            return 0;
        };

        if (!resolvedDocId) {
            const inferredUnitId = unitIdFromPayload || inferUnitIdFromRepo(repositoryFullName);
            if (inferredUnitId) {
                const unitCandidates = Array.from(new Set([
                    String(inferredUnitId || "").trim(),
                    String(inferredUnitId || "").replace(/\.html$/, "").trim(),
                ].filter(Boolean)));

                const candidateDocs = [];
                for (const unitCandidate of unitCandidates) {
                    const snap = await db.collection("assignments").where("unitId", "==", unitCandidate).limit(200).get();
                    snap.forEach((doc) => candidateDocs.push(doc));
                }

                const dedup = new Map();
                for (const doc of candidateDocs) dedup.set(doc.id, doc);
                let candidates = Array.from(dedup.values()).map((doc) => ({ id: doc.id, data: doc.data() || {} }));

                if (repositoryFullName) {
                    const strictMatched = candidates.filter((row) =>
                        String(row.data.assignmentUrl || "").includes(repositoryFullName)
                    );
                    if (strictMatched.length > 0) candidates = strictMatched;
                }

                if (userId) {
                    candidates = candidates.filter((row) => String(row.data.userId || row.data.uid || "") === String(userId));
                }

                if (assignmentId) {
                    const exactMatched = candidates.filter((row) => String(row.data.assignmentId || "") === String(assignmentId));
                    if (exactMatched.length > 0) candidates = exactMatched;
                }

                candidates.sort((a, b) => {
                    const sr = scoreStatusRank(a.data.currentStatus) - scoreStatusRank(b.data.currentStatus);
                    if (sr !== 0) return sr;
                    return tsToMs(b.data.updatedAt) - tsToMs(a.data.updatedAt);
                });

                if (candidates.length === 1) {
                    resolvedDocId = candidates[0].id;
                } else if (candidates.length > 1) {
                    await sendAutogradeFailureAlertEmail(
                        process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                        `Ambiguous assignment mapping for unit ${inferredUnitId}`,
                        {
                            repository: repositoryFullName,
                            inferredUnitId,
                            candidateCount: candidates.length,
                            candidateIds: candidates.slice(0, 20).map((c) => c.id),
                            payload,
                        }
                    );
                    return res.status(409).json({
                        success: false,
                        error: "Ambiguous assignment mapping. Please provide userId + unitId.",
                        inferredUnitId,
                        candidateCount: candidates.length,
                    });
                }
            }
        }

        if (!resolvedDocId) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, 'Missing assignment identifier', payload);
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for missing identifier:", notifyErr);
            }
            return res.status(400).json({
                success: false,
                error: "Missing assignment identifier. Provide userId + unitId."
            });
        }
        if (!Number.isFinite(score)) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, 'Invalid score value', payload);
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for invalid score:", notifyErr);
            }
            return res.status(400).json({ success: false, error: "Invalid score value." });
        }

        const assignmentRef = db.collection("assignments").doc(resolvedDocId);
        const assignmentDoc = await assignmentRef.get();
        if (!assignmentDoc.exists) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, `Assignment not found: ${resolvedDocId}`, payload);
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for missing assignment doc:", notifyErr);
            }
            return res.status(404).json({ success: false, error: "Assignment not found." });
        }

        const now = admin.firestore.Timestamp.now();
        const assignmentData = assignmentDoc.data() || {};
        const studentUid = assignmentData.userId || userId || resolvedDocId.split('_')[0];
        const assignmentIdVal = assignmentData.assignmentId || effectiveUnitId;
        const ownerTutorEmail = assignmentData.assignedTutorEmail || "";

        let learningStateUpdate = null;

        if (score < 70) {
            // Check if there is an active intervention (status in ['open', 'in_progress'])
            const interventionsSnap = await db.collection('assignment_interventions')
                .where('assignmentId', '==', assignmentIdVal)
                .where('studentUid', '==', studentUid)
                .where('status', 'in', ['open', 'in_progress'])
                .limit(1)
                .get();

            if (interventionsSnap.empty) {
                // Create a new intervention task
                const newInterventionRef = db.collection('assignment_interventions').doc();
                await newInterventionRef.set({
                    assignmentId: assignmentIdVal,
                    studentUid,
                    triggerScore: score,
                    threshold: 70,
                    status: 'open',
                    ownerTutorEmail,
                    createdAt: now,
                    updatedAt: now
                });
            }
            learningStateUpdate = 'blocked';
        } else {
            // score >= 70: resolve any open/in_progress interventions
            const interventionsSnap = await db.collection('assignment_interventions')
                .where('assignmentId', '==', assignmentIdVal)
                .where('studentUid', '==', studentUid)
                .where('status', 'in', ['open', 'in_progress'])
                .get();

            if (!interventionsSnap.empty) {
                const batch = db.batch();
                interventionsSnap.forEach(doc => {
                    batch.update(doc.ref, {
                        status: 'resolved',
                        resolvedAt: now,
                        updatedAt: now
                    });
                });
                await batch.commit();
            }
            // If currently blocked, update to resolved; otherwise preserve coaching/resolved
            if (assignmentData.learningState === 'blocked') {
                learningStateUpdate = 'resolved';
            }
        }

        const autoGrade = {
            score,
            maxScore: Number.isFinite(maxScore) ? maxScore : null,
            status: payload.status || payload.conclusion || "completed",
            source: "github_actions",
            runUrl: payload.runUrl || payload.html_url || payload.workflow_run?.html_url || null,
            repository: payload.repository?.full_name || payload.repo || null,
            workflow: payload.workflow || payload.workflow_run?.name || null,
            commitSha: payload.commitSha || payload.head_sha || payload.workflow_run?.head_sha || null,
            actor: payload.actor || payload.sender?.login || null,
            summary: payload.summary || payload.feedback || null,
            updatedAt: now
        };

        const updatePayload = {
            autoGrade,
            autoGradeRaw: {
                score: scoreRaw,
                maxScore: maxScoreRaw,
                status: payload.status || payload.conclusion || null,
                runUrl: payload.runUrl || payload.html_url || payload.workflow_run?.html_url || null
            },
            autoGradeSource: "github_actions",
            autoGradeUpdatedAt: now,
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion({
                timestamp: now,
                action: "AUTO_GRADE",
                content: `GitHub auto-grade: ${score}${Number.isFinite(maxScore) ? `/${maxScore}` : ""}`
            })
        };

        if (learningStateUpdate) {
            updatePayload.learningState = learningStateUpdate;
        }

        await assignmentRef.set(updatePayload, { merge: true });

        // Backfill GitHub Actions variables so future runs can always include userId and unitId.
        // This makes auto-grade write-back deterministic even if repo mapping is incomplete.
        try {
            const repoFullName = autoGrade.repository || repositoryFullName || "";
            const parts = String(repoFullName).split("/");
            if (parts.length === 2) {
                const [owner, repo] = parts;
                const assignmentData = assignmentDoc.data() || {};
                const backfillUserId = assignmentData.userId || userId;
                const backfillUnitId = (assignmentData.unitId || unitIdFromPayload || assignmentId || "").replace(/\.html$/, "");
                
                if (backfillUserId && backfillUnitId) {
                    const upsertUserRes = await upsertGithubActionsVariable({
                        owner,
                        repo,
                        name: "VC_USER_ID",
                        value: String(backfillUserId)
                    });
                    const upsertUnitRes = await upsertGithubActionsVariable({
                        owner,
                        repo,
                        name: "VC_UNIT_ID",
                        value: String(backfillUnitId)
                    });
                    if (!upsertUserRes.ok || !upsertUnitRes.ok) {
                        console.warn("[ingestGithubAutograde] Failed to backfill variables:", {
                            repoFullName,
                            backfillUserId,
                            backfillUnitId,
                            upsertUserRes,
                            upsertUnitRes
                        });
                    }
                }
            }
        } catch (varErr) {
            console.warn("[ingestGithubAutograde] Variable backfill error:", varErr);
        }

        try {
            const assignmentData = assignmentDoc.data() || {};
            const dashboardUrl = assignmentData.unitId
                ? `https://vibe-coding.tw/dashboard.html?unitId=${encodeURIComponent(assignmentData.unitId)}&tab=assignments`
                : 'https://vibe-coding.tw/dashboard.html?tab=assignments';
            const assignmentTitle = assignmentData.assignmentTitle || assignmentData.assignmentId || resolvedDocId;
            const studentEmail = assignmentData.userEmail || assignmentData.studentEmail || '';
            const studentName = assignmentData.userName || assignmentData.studentName || '';
            const tutorEmail = assignmentData.assignedTutorEmail || '';

            await sendAutogradeResultToStudent(
                studentEmail,
                studentName,
                assignmentTitle,
                score,
                Number.isFinite(maxScore) ? maxScore : null,
                dashboardUrl,
                autoGrade.runUrl || ''
            );

            await sendAutogradeResultToTutor(
                tutorEmail,
                studentName || studentEmail || '學生',
                assignmentTitle,
                score,
                Number.isFinite(maxScore) ? maxScore : null,
                dashboardUrl,
                autoGrade.runUrl || ''
            );
        } catch (notifyErr) {
            console.error("[ingestGithubAutograde] Notification send failed:", notifyErr);
        }

        return res.status(200).json({ success: true, assignmentId: resolvedDocId });
    } catch (error) {
        console.error("ingestGithubAutograde Error:", error);
        try {
            await sendAutogradeFailureAlertEmail(
                process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                `Internal server error: ${error.message || 'unknown'}`,
                (req.body && typeof req.body === "object") ? req.body : {}
            );
        } catch (notifyErr) {
            console.error("[ingestGithubAutograde] Failed to send alert for internal error:", notifyErr);
        }
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// ==========================================
// 8. 新用戶歡迎信 (onUserCreated)
// ==========================================
exports.onUserCreated = functionsV1.region(REGION).auth.user().onCreate(async (user) => {
    const email = user.email;
    const displayName = user.displayName;
    const uid = user.uid;

    const db = admin.firestore();

    // 1. Create a basic Firestore record so the user appears in the dashboard
    try {
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                email: email || "",
                name: displayName || "",
                role: 'user', // Admin roles must be set manually in Firestore or via Dashboard sync
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`[onUserCreated] Initialized Firestore record for user ${uid} (${email})`);
        }
    } catch (e) {
        console.error(`[onUserCreated] Failed to initialize Firestore record for ${uid}:`, e);
    }

    // 2. Send Welcome Email
    if (email) {
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const expiryDateStr = expiryDate.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await sendWelcomeEmail(email, displayName, expiryDateStr);
    }
});

// ==========================================
// 9. 試用期到期提醒 (checkTrialExpiration)
// ==========================================
// Run every day at 12:00 PM Asia/Taipei
exports.checkTrialExpiration = onSchedule({
    schedule: '0 12 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // Target: Users created between 27 and 28 days ago (3 days left)
    const now = Date.now();
    const startWindow = now - (THIRTY_DAYS_MS - THREE_DAYS_MS); // ~27 days ago
    const endWindow = startWindow - (24 * 60 * 60 * 1000); // 1 day window

    // Valid approach: iterate all users or use a dedicated Firestore collection "users" to query by createdAt.
    // Since listing all Auth users is heavy, we should rely on Firestore 'users' collection if possible.
    // However, 'users' collection might not have all users.
    // Let's use Firestore 'users' as the source for mailing list management to be safe and scalable.

    // Note: We need to ensure when a user is created, they are added to Firestore 'users'.
    // Currently 'setUserRole' adds to 'users', but basic signup might not?
    // Let's add that to 'onUserCreated' as well to be sure.

    // For MVP, we will try to list users from Auth (limit 1000) - acceptable for small scale.
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users;

        for (const user of users) {
            const creationTime = new Date(user.metadata.creationTime).getTime();
            const diff = now - creationTime;

            // If diff is between 27 days and 28 days
            // 30 days = 720 hours
            // 3 days left = 27 days passed = 648 hours
            const daysPassed = diff / (24 * 60 * 60 * 1000);

            if (daysPassed >= 27 && daysPassed < 28) {
                // Check if we already sent warning? 
                // Ideally check a flag in Firestore.
                const userRef = admin.firestore().collection('users').doc(user.uid);
                const doc = await userRef.get();
                if (!doc.exists || !doc.data().trialWarningSent) {
                    console.log(`Sending trial warning to ${user.email}`);
                    if (user.email) {
                        await sendTrialExpiringEmail(user.email, user.displayName, 3);
                        // Mark as sent
                        await userRef.set({ trialWarningSent: true }, { merge: true });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in checkTrialExpiration:", error);
    }
});

// ==========================================
// 9.5 課程到期提醒 (checkCourseExpiration)
// ==========================================
// Run every day at 10:00 AM Asia/Taipei
exports.checkCourseExpiration = onSchedule({
    schedule: '0 10 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
    const buffer = 2 * 24 * 60 * 60 * 1000; // Look for anything expiring in the next 9 days roughly

    try {
        // Query for successful orders that haven't expired yet but are near.
        // We limit to 500 orders per run for safety.
        const snapshot = await db.collection("orders")
            .where("status", "==", "SUCCESS")
            .limit(1000)
            .get();

        const results = [];
        for (const doc of snapshot.docs) {
            const orderData = doc.data();
            if (!orderData.expiryDate || !orderData.uid) continue;

            const expiryTime = orderData.expiryDate.toDate().getTime();
            const diff = expiryTime - now;

            let warningType = null;
            let daysLeft = 0;

            // Window check (around 7 days)
            if (diff > SEVEN_DAYS_MS - 43200000 && diff <= SEVEN_DAYS_MS + 43200000) { // +/- 12 hours
                if (!orderData.warning7Sent) {
                    warningType = "7DAY";
                    daysLeft = 7;
                }
            }
            // Window check (around 1 day)
            else if (diff > ONE_DAY_MS - 43200000 && diff <= ONE_DAY_MS + 43200000) {
                if (!orderData.warning1Sent) {
                    warningType = "1DAY";
                    daysLeft = 1;
                }
            }

            if (warningType) {
                try {
                    // Fetch user email and name
                    const userRecord = await admin.auth().getUser(orderData.uid);
                    const email = userRecord.email;
                    const displayName = await resolveUserDisplayName(
                        admin.firestore(),
                        orderData.uid || "",
                        email || "",
                        userRecord.displayName || ""
                    );

                    if (email) {
                        // Get Course Name from items
                        const itemNames = Object.values(orderData.items || {}).map(i => i.name).join(', ') || "Vibe Coding 課程";

                        console.log(`Sending ${warningType} course warning to ${email} for course: ${itemNames}`);
                        await sendCourseExpiringEmail(email, displayName, itemNames, daysLeft);

                        // Mark as sent in Firestore
                        const updateData = {};
                        if (warningType === "7DAY") updateData.warning7Sent = true;
                        if (warningType === "1DAY") updateData.warning1Sent = true;
                        await doc.ref.update(updateData);

                        results.push({ email, warningType });
                    }
                } catch (e) {
                    console.error(`Failed to process warning for order ${doc.id}:`, e);
                }
            }
        }
        console.log(`Course expiration check completed. Sent ${results.length} notifications.`);
    } catch (error) {
        console.error("Error in checkCourseExpiration:", error);
    }
});

// ==========================================
// 8.6 管理員指派提醒 (remindAdminPendingAssignments)
// ==========================================
// Run every day at 9:00 AM Asia/Taipei
exports.remindAdminPendingAssignments = onSchedule({
    schedule: '0 9 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    if (!adminEmail) return;

    try {
        const lessons = await getLessons();
        const unitToCourse = new Map();
        lessons.forEach(course => {
            const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];
            units.forEach(unitId => unitToCourse.set(String(unitId), course));
        });

        const unitRequiresTutorAssignment = (unitId) => {
            if (!unitId) return false;
            const course = unitToCourse.get(String(unitId));
            if (!course) return false;
            const price = Number(course.price || 0);
            return price > 0 && course.isPhysical !== true;
        };

        // 1. Get all successful orders
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
        const pendingMap = new Map(); // uid -> Set of unitIds

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid && data.items) {
                const purchasedUnits = collectPurchasedUnitIds(data.items, lessons);
                purchasedUnits.forEach(unitId => {
                    // Only keep paid, non-physical course units that need tutor assignment.
                    if (!unitRequiresTutorAssignment(unitId)) return;
                    if (!pendingMap.has(data.uid)) pendingMap.set(data.uid, new Set());
                    pendingMap.get(data.uid).add(unitId);
                });
            }
        });

        // 2. Cross-reference with user assignments
        const uids = Array.from(pendingMap.keys());
        const pendingAssignments = [];

        // Chunking UID list due to Firestore 'in' limit
        for (let i = 0; i < uids.length; i += 10) {
            const chunk = uids.slice(i, i + 10);
            const usersSnapshot = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const uid = doc.id;
                const requiredUnits = pendingMap.get(uid);
                const assignedUnits = userData.unitAssignments || {};

                const unassigned = Array.from(requiredUnits).filter(unitId => !assignedUnits[unitId]);

                if (unassigned.length > 0) {
                    pendingAssignments.push({
                        email: userData.email || '未提供電子郵件',
                        units: unassigned
                    });
                }
            });
        }

        // 3. Send summary to admin if there are pending tasks
        if (pendingAssignments.length > 0) {
            console.log(`Found ${pendingAssignments.length} users with pending assignments. Notifying admin.`);
            await sendAdminAssignmentReminder(adminEmail, pendingAssignments);
        } else {
            console.log("No pending tutor assignments found.");
        }

    } catch (error) {
        console.error("Error in remindAdminPendingAssignments:", error);
    }
});

// ==========================================
// 8.7 管理員出貨提醒 (remindAdminPendingShipments)
// ==========================================
// Run every day at 9:30 AM Asia/Taipei
exports.remindAdminPendingShipments = onSchedule({
    schedule: '30 9 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    if (!adminEmail) return;

    try {
        const lessons = await getLessons();
        const physicalUnitIds = new Set(lessons.filter(l => l.isPhysical === true).map(l => l.id));

        // 1. Get all successful orders that contain physical items and aren't shipped
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'SUCCESS')
            .get();

        const pendingShipments = [];

        for (const doc of ordersSnapshot.docs) {
            const data = doc.data();
            if (data.fulfillmentStatus === 'SHIPPED') continue;

            const items = data.items || {};
            const physicalItems = Object.keys(items).filter(id => {
                if (items[id]?.isPhysical === true) return true;
                return physicalUnitIds.has(id);
            });
            if (physicalItems.length > 0) {
                // Fetch user info for the email
                const userDoc = await db.collection('users').doc(data.uid).get();
                const userData = userDoc.exists ? userDoc.data() : {};

                pendingShipments.push({
                    orderId: doc.id,
                    email: userData.email || '未提供',
                    items: physicalItems.map(id => lessons.find(l => l.id === id)?.title || items[id]?.name || id),
                    paidAt: data.paidAt ? data.paidAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未知'
                });
            }
        }

        if (pendingShipments.length > 0) {
            console.log(`Found ${pendingShipments.length} pending shipments. Notifying admin.`);
            const { sendAdminShipmentReminder } = require('./emailService');
            await sendAdminShipmentReminder(adminEmail, pendingShipments);
        } else {
            console.log("No pending shipments found.");
        }

    } catch (error) {
        console.error("Error in remindAdminPendingShipments:", error);
    }
});

// ==========================================
// 10. 電子地圖回傳 (mapReply)
// ==========================================
exports.mapReply = onRequest((req, res) => {
    // EcPay sends data via POST
    if (req.method !== 'POST') {
        // Default to redirecting home if accessed via GET
        return res.redirect('https://vibe-coding.tw/cart.html');
    }

    try {
        const { CVSStoreID, CVSStoreName, CVSAddress, ExtraData } = req.body;
        console.log("Map Reply Received:", CVSStoreID, CVSStoreName);

        // Redirect user back to cart with store info
        const baseUrl = "https://vibe-coding.tw/cart.html";
        const params = new URLSearchParams({
            storeId: CVSStoreID || '',
            storeName: CVSStoreName || '',
            address: CVSAddress || '',
            action: 'storeSelected'
        });

        res.redirect(`${baseUrl}?${params.toString()}`);

    } catch (error) {
        console.error("Map Reply Error:", error);
        res.status(500).send("Error processing map reply");
    }
});

// ==========================================
// 11. 利潤分享架構 (Profit Sharing)
// ==========================================

// 11.1 驗證老師作業連結 (verifyReferralLink)
const verifyReferralLinkHandler = onCall(async (request) => {
    const { data } = request;
    const referralLink = data?.referralLink || data?.promoCode;
    const { cartItems = [] } = data || {};
    if (!referralLink) throw new HttpsError('invalid-argument', '缺少老師作業連結');

    try {
        const db = admin.firestore();
        const inputStr = referralLink.trim();

        const lowerInput = inputStr.toLowerCase();
        const isUrl = lowerInput.includes('github.com/classroom/') || lowerInput.includes('classroom.github.com/');

        if (isUrl) {
            console.log(`[Referral] Resolving GitHub Link via index: ${inputStr}`);
            const normalizedLink = normalizeGitHubUrl(inputStr);
            const linkId = Buffer.from(normalizedLink).toString('base64');
            const linkDoc = await db.collection('referral_links').doc(linkId).get();

            if (!linkDoc.exists) {
                return { success: false, message: '查無此作業連結對應的導師 (若剛更新設定，請稍候 30 秒)' };
            }

            const lData = linkDoc.data();
            const tEmail = lData.tutorEmail;
            const tutorUserSnap = await db.collection('users').where('email', '==', tEmail).limit(1).get();
            if (tutorUserSnap.empty) {
                return { success: false, message: '對應的導師帳號似乎已被移除' };
            }
            const tutorData = tutorUserSnap.docs[0].data();
            const lessons = await getLessons();

            if (cartItems && cartItems.length > 0) {
                const results = cartItems.map(item => {
                    const courseId = item.courseId || item.id;
                    return {
                        courseId,
                        qualified: isTutorFullyQualifiedForCourse(tutorData, courseId, lessons)
                    };
                });
                const allQualified = results.every(r => r.qualified);
                if (!allQualified) {
                    const failId = results.find(r => !r.qualified).courseId;
                    return { success: false, message: `此導師尚未取得「${failId}」的全單元認證，無法作為推薦人。` };
                }
            }

            return {
                success: true,
                referredTutorEmail: tEmail,
                referredTutorName: tutorData.name || tEmail,
                courseId: lData.unitId,
                isLink: true,
                message: '已成功辨識老師推薦連結'
            };
        }

        return { success: false, message: '目前僅支援以 GitHub Classroom 連結作為推薦識別，請輸入老師提供的作業連結。' };
    } catch (e) {
        console.error(`[Referral] Error: ${e.message}`);
        throw new HttpsError('internal', e.message);
    }
});
exports.verifyReferralLink = verifyReferralLinkHandler;
exports.verifyPromoCode = verifyReferralLinkHandler;

function normalizeClassroomInvite(value = '') {
    const s = String(value || '').trim();
    if (!s) return '';
    try {
        const url = new URL(s);
        if (url.hostname !== 'classroom.github.com') return s;
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '').toLowerCase();
    } catch (_) {
        const token = s.replace(/^https?:\/\/classroom\.github\.com\/a\//i, '').replace(/\/+$/, '');
        return token ? `https://classroom.github.com/a/${token}`.toLowerCase() : '';
    }
}

function extractInviteCandidates(cfg) {
    if (!cfg) return [];
    if (typeof cfg === 'string') return [normalizeClassroomInvite(cfg)].filter(Boolean);
    if (typeof cfg === 'object') {
        return Object.values(cfg)
            .filter(v => typeof v === 'string' && v.trim())
            .map(v => normalizeClassroomInvite(v))
            .filter(Boolean);
    }
    return [];
}

async function lookupClassroomInviteBinding(inputRaw) {
    const normalizedInvite = normalizeClassroomInvite(inputRaw);
    if (!normalizedInvite.includes('classroom.github.com/a/')) {
        throw new HttpsError('invalid-argument', '請輸入 GitHub Classroom 邀請連結或 invite code。');
    }

    const lessons = await getLessons();
    const matches = [];
    for (const lesson of lessons) {
        const urlMap = lesson?.githubClassroomUrls || {};
        for (const [unitKey, cfg] of Object.entries(urlMap)) {
            const candidates = extractInviteCandidates(cfg);
            if (!candidates.includes(normalizedInvite)) continue;
            matches.push({
                lessonDocId: lesson.id || null,
                courseId: lesson.courseId || lesson.id || null,
                title: lesson.title || null,
                unitKey,
                courseUnits: Array.isArray(lesson.courseUnits) ? lesson.courseUnits : []
            });
        }
    }
    return { success: true, normalizedInvite, totalMatches: matches.length, matches };
}

// 11.1-b Admin 工具：查詢 GitHub Classroom 邀請連結目前綁定在哪些單元
exports.findClassroomInviteBinding = onCall(async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    const requesterRole = await getRole(auth.uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', 'Only admins can query invite bindings.');

    const inputRaw = String(
        request.data?.inviteCodeOrUrl ||
        request.data?.inviteUrl ||
        request.data?.inviteCode ||
        ''
    ).trim();
    if (!inputRaw) throw new HttpsError('invalid-argument', '缺少 inviteCodeOrUrl');
    return lookupClassroomInviteBinding(inputRaw);
});

exports.findClassroomInviteBindingHttp = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', 'https://vibe-coding.tw');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
        const idToken = authHeader.substring(7);
        const decoded = await admin.auth().verifyIdToken(idToken);
        const requesterRole = await getRole(decoded.uid);
        if (requesterRole !== 'admin') return res.status(403).json({ error: 'Only admins can query invite bindings.' });

        const inputRaw = String(
            req.body?.inviteCodeOrUrl ||
            req.body?.inviteUrl ||
            req.body?.inviteCode ||
            req.body?.data?.inviteCodeOrUrl ||
            ''
        ).trim();
        if (!inputRaw) return res.status(400).json({ error: '缺少 inviteCodeOrUrl' });

        const result = await lookupClassroomInviteBinding(inputRaw);
        return res.json(result);
    } catch (error) {
        console.error('[findClassroomInviteBindingHttp] failed:', error);
        return res.status(500).json({ error: error.message || 'internal error' });
    }
});

// 11.2 每月計算分潤 (Scheduled Job - 1st of each month)
exports.calculateMonthlySharing = onSchedule("0 0 1 * *", async (event) => {
    const db = admin.firestore();
    const now = new Date();
    // Calculate for the previous month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    console.log(`Starting profit sharing calculation for: ${lastMonth.toISOString()} to ${endOfLastMonth.toISOString()}`);

    try {
        // 1. Find all successful orders in the last month that have referral info
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'SUCCESS')
            .where('paidAt', '>=', admin.firestore.Timestamp.fromDate(lastMonth))
            .where('paidAt', '<=', admin.firestore.Timestamp.fromDate(endOfLastMonth))
            .get();

        if (ordersSnapshot.empty) {
            console.log("No successful orders found for sharing this month.");
            return;
        }

        const auditTrail = [];

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const orderId = orderDoc.id;
            const studentUid = order.uid;
            const items = order.items || {};

            for (const [itemKey, itemValue] of Object.entries(items)) {
                const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
                const itemPrice = parseFloat(itemValue?.price || 0) || 0;
                const lineAmount = itemPrice * quantity;
                const initialTutor = (itemValue?.referredTutorEmail && itemValue.referredTutorEmail.trim())
                    ? itemValue.referredTutorEmail.trim()
                    : ((itemValue?.referralTutor && itemValue.referralTutor.trim()) ? itemValue.referralTutor.trim() : "info@vibe-coding.tw");
                const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;

                if (lineAmount <= 0) continue;

                let currentTutorEmail = initialTutor;
                let currentShare = lineAmount * 0.2; // First level: 20%
                let level = 1;

                while (currentTutorEmail && currentShare >= 0.01) {
                    const period = `${lastMonth.getFullYear()}-${(lastMonth.getMonth() + 1).toString().padStart(2, '0')}`;
                    const idempotencySeed = `${period}|${orderId}|${itemKey}|${level}|${currentTutorEmail.toLowerCase()}`;
                    const idempotencyKey = crypto.createHash('sha256').update(idempotencySeed).digest('hex').slice(0, 40);
                    const ledgerRef = db.collection('profit_ledger').doc(idempotencyKey);
                    const shareRecord = {
                        idempotencyKey,
                        tutorEmail: currentTutorEmail,
                        studentUid: studentUid,
                        orderId: orderId,
                        orderItemId: itemKey,
                        orderAmount: lineAmount,
                        shareAmount: Math.round(currentShare * 100) / 100,
                        level: level,
                        referralLink: itemReferralLink,
                        calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        period
                    };
                    await ledgerRef.set(shareRecord, { merge: true });
                    auditTrail.push(shareRecord);

                    if (currentTutorEmail === "info@vibe-coding.tw") break;

                    const tutorUserSnapshot = await db.collection('users').where('email', '==', currentTutorEmail).limit(1).get();
                    if (!tutorUserSnapshot.empty) {
                        const tutorData = tutorUserSnapshot.docs[0].data();
                        currentTutorEmail = tutorData.tutorEmail || "info@vibe-coding.tw";
                        currentShare = currentShare * 0.2;
                        level++;
                    } else {
                        currentTutorEmail = "info@vibe-coding.tw";
                        currentShare = currentShare * 0.2;
                        level++;
                    }
                }
            }
        }

        console.log(`Profit sharing completed. Recorded ${auditTrail.length} share entries.`);
    } catch (error) {
        console.error("Error in calculateMonthlySharing:", error);
    }
});

/**
 * [NEW] Mark an order as shipped (markOrderShipped)
 */
exports.markOrderShipped = onCall(async (request) => {
    const { orderId } = request.data;
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '請先登入');
    if (!orderId) throw new HttpsError('invalid-argument', '缺少訂單編號');

    const db = admin.firestore();
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.data()?.role !== 'admin') {
            throw new HttpsError('permission-denied', '只有管理員可以標記出貨');
        }

        await db.collection('orders').doc(orderId).update({
            fulfillmentStatus: 'SHIPPED',
            shippedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (orderDoc.exists) {
                const order = orderDoc.data() || {};
                const studentUid = order.uid;
                if (studentUid && studentUid !== 'GUEST') {
                    const userRecord = await admin.auth().getUser(studentUid);
                    const studentEmail = userRecord?.email || '';
                    const items = order.items || {};
                    const itemsDesc = Object.values(items).map(item => item?.name || '教材').join(', ');
                    await sendOrderShippedEmail(studentEmail, orderId, itemsDesc, order.logistics || {});
                }
            }
        } catch (notifyErr) {
            console.error(`[markOrderShipped] Failed to send shipped email for ${orderId}:`, notifyErr);
        }

        console.log(`Order ${orderId} marked as SHIPPED by ${uid}`);
        return { success: true };
    } catch (error) {
        console.error("Error in markOrderShipped:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * [V16.1] Bind a tutor to a unit via a Classroom URL (Self-Binding)
 * Triggered when a student enters a tutor's link in the assignment modal.
 */
exports.bindTutorToUnit = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const { unitId, courseId, referralLink } = data;
    if (!unitId || !referralLink) throw new HttpsError('invalid-argument', '缺少必要參數');

    const db = admin.firestore();
    const uid = auth.uid;

    try {
        // 1. Verify Payment
        const lessons = await getLessons();
        const access = await resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons);
        if (!access.authorized) throw new HttpsError('permission-denied', '尚未取得此單元之付款授權。');

        // 2. Verify Link
        const normalizedLink = normalizeGitHubUrl(referralLink);
        const linkId = Buffer.from(normalizedLink).toString('base64');
        const linkDoc = await db.collection('referral_links').doc(linkId).get();

        if (!linkDoc.exists) throw new HttpsError('not-found', '查無此作業連結對應的導師。');

        const lData = linkDoc.data();
        const tutorEmail = lData.tutorEmail;

        // 3. Verify Tutor Qualification
        const tutorUserSnap = await db.collection('users').where('email', '==', tutorEmail).limit(1).get();
        if (tutorUserSnap.empty) throw new HttpsError('not-found', '對應的導師帳號已被移除。');
        
        const tutorData = tutorUserSnap.docs[0].data();
        const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseId;

        const config = getEffectiveTutorConfig(canonicalUnitId, tutorData.tutorConfigs || {});
        if (!config || config.authorized !== true) {
             throw new HttpsError('permission-denied', '此導師尚未取得該單元的指導認證。');
        }

        // 4. Bind (Upsert)
        await upsertStudentUnitAssignment(db, uid, canonicalUnitId, tutorEmail, 'selfBinding', true);

        // 5. Cascade Assignment (If it's a course bundle)
        const course = lessons.find(l => l.courseId === effectiveCourseId);
        if (course && Array.isArray(course.courseUnits) && course.courseUnits.includes(canonicalUnitId)) {
             // If teacher is fully qualified for the course, cascade to all units
             if (isTutorFullyQualifiedForCourse(tutorData, effectiveCourseId, lessons)) {
                 for (const uId of course.courseUnits) {
                     const cId = resolveCanonicalUnitId(uId, lessons);
                     await upsertStudentUnitAssignment(db, uid, cId, tutorEmail, 'selfBinding_cascade', true);
                 }
                 console.log(`[bindTutorToUnit] Cascade-assigned ${uid} -> ${tutorEmail} for ${course.courseUnits.length} units in ${effectiveCourseId}`);
             }
        }

        return { success: true, tutorEmail };
    } catch (error) {
        console.error("Self-binding failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Bind tutor by promotion code for a specific unit.
 * Source of truth: users.promotionCode + users.tutorConfigs.{unitId}
 */
exports.bindTutorByPromotionCode = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const unitIdRaw = String(data?.unitId || '').trim();
    const courseIdRaw = String(data?.courseId || '').trim();
    const promoCodeRaw = String(data?.promotionCode || '').trim();
    if (!unitIdRaw) {
        throw new HttpsError('invalid-argument', '缺少必要參數（unitId）');
    }

    const db = admin.firestore();
    const uid = auth.uid;
    const requesterRole = await getRole(uid);

    try {
        const lessons = await getLessons();
        const canonicalUnitId = resolveCanonicalUnitId(unitIdRaw, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseIdRaw;

        // Admin tutor-mode debugging/support flow should not be blocked by student payment gate.
        if (requesterRole !== 'admin') {
            const access = await resolveStudentAssignmentAccess(db, uid, effectiveCourseId, canonicalUnitId, lessons);
            if (!access.authorized) {
                throw new HttpsError('permission-denied', '尚未取得此單元之付款授權。');
            }
        }

        const DEFAULT_TUTOR_EMAIL = 'rover.k.chen@gmail.com';
        const normalizedInput = promoCodeRaw;
        const promotionCode = normalizedInput.toUpperCase();
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput);
        let tutorSnap;
        let resolvedPromotionCode = promotionCode;

        if (!normalizedInput) {
            tutorSnap = await db.collection('users')
                .where('email', '==', DEFAULT_TUTOR_EMAIL)
                .limit(1)
                .get();
        } else if (looksLikeEmail) {
            tutorSnap = await db.collection('users')
                .where('email', '==', normalizedInput.toLowerCase())
                .limit(1)
                .get();
        } else if (promotionCode) {
            tutorSnap = await db.collection('users')
                .where('promotionCode', '==', promotionCode)
                .limit(1)
                .get();
        }
        if (tutorSnap.empty) {
            if (!normalizedInput) {
                throw new HttpsError('not-found', '系統預設導師不存在。');
            }
            throw new HttpsError('not-found', looksLikeEmail ? '查無此 Tutor email 對應的導師。' : '查無此 Promotion code 對應的導師。');
        }

        const tutorDoc = tutorSnap.docs[0];
        const tutorData = tutorDoc.data() || {};
        const tutorEmail = String(tutorData.email || '').trim();
        if (!tutorEmail) {
            throw new HttpsError('failed-precondition', '該導師資料不完整（缺少 email）。');
        }

        const cfg = getEffectiveTutorConfig(canonicalUnitId, tutorData.tutorConfigs || {});
        if (!cfg || cfg.authorized !== true) {
            throw new HttpsError('permission-denied', '此導師尚未取得該單元授權。');
        }

        const assignmentUrl = (cfg.assignmentUrl || cfg.githubClassroomUrl || '').trim();
        if (!assignmentUrl) {
            throw new HttpsError('failed-precondition', '此導師尚未設定該單元 GitHub Classroom 連結。');
        }

        const tutorRef = db.collection('users').doc(tutorDoc.id);
        resolvedPromotionCode = await ensureTutorPromotionCode(db, tutorRef, tutorData, tutorDoc.id, tutorEmail);

        await upsertStudentUnitAssignment(db, uid, canonicalUnitId, tutorEmail, 'promotionCodeBinding', true);

        await db.collection('users').doc(uid).set({
            [`unitAssignmentMeta.${canonicalUnitId}`]: {
                tutorUid: tutorDoc.id,
                tutorEmail,
                promotionCode: resolvedPromotionCode,
                linkedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return {
            success: true,
            tutorEmail,
            tutorName: tutorData.name || tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl
        };
    } catch (error) {
        console.error('bindTutorByPromotionCode failed:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

// === Tutor x Student Interaction MVP Functions ===

// 1. Submit Blocker (Student)
exports.submitStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { assignmentId, blockerType, blockerNote } = data;
    if (!assignmentId || !blockerType || !blockerNote) {
        throw new HttpsError('invalid-argument', '缺少必要參數');
    }

    const userId = auth.uid;
    const db = admin.firestore();
    const docId = `${userId}_${assignmentId.replace(/\.html$/, '')}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }

        const now = admin.firestore.Timestamp.now();
        const blockerEntry = {
            type: blockerType,
            note: blockerNote,
            createdAt: now
        };

        const historyEntry = {
            timestamp: new Date().toISOString(),
            action: 'BLOCKER_REPORTED',
            content: `Student reported blocker: [${blockerType}] ${blockerNote}`
        };

        await docRef.update({
            learningState: 'blocked',
            latestBlocker: blockerEntry,
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        return { success: true, message: '已成功標記卡點' };
    } catch (e) {
        console.error("submitStudentBlocker Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 2. Submit Attempt Summary (Student)
exports.submitAttemptSummary = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { assignmentId, attemptSummary } = data;
    if (!assignmentId || !attemptSummary) {
        throw new HttpsError('invalid-argument', '缺少必要參數');
    }

    const userId = auth.uid;
    const db = admin.firestore();
    const docId = `${userId}_${assignmentId.replace(/\.html$/, '')}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }

        const now = admin.firestore.Timestamp.now();
        const historyEntry = {
            timestamp: new Date().toISOString(),
            action: 'ATTEMPT_LOGGED',
            content: `Student logged attempt: ${attemptSummary}`
        };

        await docRef.update({
            attemptSummary: attemptSummary,
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        return { success: true, message: '嘗試紀錄提交成功！' };
    } catch (e) {
        console.error("submitAttemptSummary Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 3. Resolve Blocker (Student or Tutor)
exports.resolveStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { assignmentId, studentUid } = data;
    if (!assignmentId) {
        throw new HttpsError('invalid-argument', '缺少必要參數');
    }

    const db = admin.firestore();
    const targetUid = studentUid || auth.uid;
    
    if (studentUid && studentUid !== auth.uid) {
        const requesterUid = auth.uid;
        const reqUserSnap = await db.collection('users').doc(requesterUid).get();
        const reqUserData = reqUserSnap.data() || {};
        const isRequesterAdmin = reqUserData.role === 'admin';
        
        let isTutor = false;
        if (reqUserData.role === 'tutor' || reqUserData.tutorConfigs) {
            isTutor = true;
        }
        
        if (!isRequesterAdmin && !isTutor) {
            throw new HttpsError('permission-denied', '您沒有權限解決此學生的卡點。');
        }
    }

    const docId = `${targetUid}_${assignmentId.replace(/\.html$/, '')}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }

        const now = admin.firestore.Timestamp.now();
        const historyEntry = {
            timestamp: new Date().toISOString(),
            action: 'BLOCKER_RESOLVED',
            content: `Blocker marked as resolved by ${studentUid ? 'Tutor' : 'Student'}`
        };

        await docRef.update({
            learningState: 'in_progress',
            latestBlocker: null,
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        return { success: true, message: '已成功解決卡點！' };
    } catch (e) {
        console.error("resolveStudentBlocker Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 4. Submit Tutor Coaching Log (Tutor/Admin)
exports.submitTutorCoachingLog = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { assignmentId, studentUid, hintLevel, blockerType, coachNote, nextAction } = data;
    if (!assignmentId || !studentUid || hintLevel === undefined || !coachNote) {
        throw new HttpsError('invalid-argument', '缺少必要參數');
    }

    const tutorEmail = auth.token.email;
    const db = admin.firestore();
    const docId = `${studentUid}_${assignmentId.replace(/\.html$/, '')}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new HttpsError('not-found', '找不到該學生的作業紀錄');
        }

        const assignmentData = doc.data() || {};
        const reqUserSnap = await db.collection('users').doc(auth.uid).get();
        const reqUserData = reqUserSnap.data() || {};
        const isRequesterAdmin = reqUserData.role === 'admin';
        const isAssignedTutor = assignmentData.assignedTutorEmail === tutorEmail;

        if (!isRequesterAdmin && !isAssignedTutor) {
            throw new HttpsError('permission-denied', '您並非指派給此學生的導師，無法提交指導紀錄。');
        }

        const now = admin.firestore.Timestamp.now();

        // 1. Create a log in assignment_coaching_logs
        const coachingLogRef = db.collection('assignment_coaching_logs').doc();
        await coachingLogRef.set({
            assignmentId,
            studentUid,
            tutorEmail,
            hintLevel: Number(hintLevel),
            blockerType: blockerType || 'concept',
            coachNote: coachNote,
            createdAt: now
        });

        // 2. Update the assignment doc
        const historyEntry = {
            timestamp: new Date().toISOString(),
            action: 'TUTOR_COACHED',
            content: `Tutor logged coaching note (Hint Level: L${hintLevel}). Next action: ${nextAction || 'None'}`
        };

        await docRef.update({
            learningState: 'coaching',
            hintLevelUsed: Number(hintLevel),
            nextAction: nextAction || '',
            updatedAt: now,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        // 3. Update active interventions
        const interventionsSnap = await db.collection('assignment_interventions')
            .where('assignmentId', '==', assignmentId)
            .where('studentUid', '==', studentUid)
            .where('status', 'in', ['open', 'in_progress'])
            .get();

        const batch = db.batch();
        interventionsSnap.forEach(interventionDoc => {
            batch.update(interventionDoc.ref, {
                status: 'in_progress',
                ownerTutorEmail: tutorEmail,
                updatedAt: now
            });
        });
        await batch.commit();

        return { success: true, message: '指導紀錄已提交' };
    } catch (e) {
        console.error("submitTutorCoachingLog Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});
