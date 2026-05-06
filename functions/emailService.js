const nodemailer = require('nodemailer');

// Configure Nodemailer Transport
// We rely on environment variables for credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

/**
 * Standard Premium Email Wrapper to ensure responsiveness and brand consistency.
 */
function getEmailHtmlWrapper(title, content, footer = 'Vibe Coding 團隊') {
    return `
        <div style="background-color: #f4f7f9; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px; color: #1e293b; font-size: 16px; word-break: break-word;">
                    ${content}
                </div>
                
                <!-- Footer -->
                <div style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; color: #64748b; font-size: 13px;">
                    <p style="margin: 0;">${footer}</p>
                    <p style="margin: 5px 0 0 0;">© 2026 Vibe Coding. All rights reserved.</p>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
                若您不應收到此郵件，請忽略或聯繫我們：<a href="mailto:info@vibe-coding.tw" style="color: #4f46e5; text-decoration: none;">info@vibe-coding.tw</a>
            </div>
        </div>
    `;
}

/**
 * Send a welcome email to a newly registered user.
 * @param {string} email - User's email address
 * @param {string} displayName - User's display name
 */
async function sendWelcomeEmail(email, displayName, expiryDateStr) {
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: '歡迎加入 Vibe Coding！',
        html: getEmailHtmlWrapper(
            '歡迎加入 Vibe Coding！',
            `
                <p>Hi ${displayName || '開發者'},</p>
                <p>感謝您註冊 Vibe Coding。我們很高興能與您一起探索程式開發的樂趣！</p>
                
                <div style="background-color: #f0f7ff; border-left: 4px solid #4f46e5; padding: 20px; margin: 25px 0; border-radius: 8px;">
                    <p style="margin: 0; font-weight: bold; color: #4f46e5; font-size: 14px; text-transform: uppercase;">🎁 限時歡迎禮：入門課程免費使用一個月</p>
                    <p style="margin: 10px 0 0 0;">為了慶祝您加入，目前所有標記為<strong>「入門」</strong>的課程，您皆可免費存取使用至：</p>
                    <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ef4444;">${expiryDateStr}</p>
                </div>

                <p>您可以立即開始您的學習之旅：</p>
                <p style="margin-top: 25px;">
                    <a href="https://vibe-coding.tw/index.html" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">開始學習</a>
                </p>
                <p style="margin-top: 25px; font-size: 14px; color: #64748b;">如果您有任何問題，隨時回覆這封郵件。</p>
            `,
            '祝學習愉快！<br>Vibe Coding 團隊'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${email}`);
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
}

/**
 * Send a payment confirmation email.
 * @param {string} email - User's email address
 * @param {string} orderId - Order ID
 * @param {number} amount - Total amount paid
 * @param {string} itemsDesc - Description of items purchased
 * @param {boolean} hasPhysical - Whether the order contains physical items
 */
async function sendPaymentSuccessEmail(email, orderId, amount, itemsDesc, hasPhysical = false) {
    const fulfillmentMessage = hasPhysical 
        ? '若購買的是實體教材，我們將於 1-3 個工作天內為您寄出。您可以在儀表板追蹤出貨狀態。'
        : '您現在可以隨時登入平台存取您的課程內容。';

    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: 'Vibe Coding 訂單確認',
        html: getEmailHtmlWrapper(
            '付款成功：報名通知書',
            `
                <p>感謝您的購買。您的訂單已成功確認，歡迎開始學習！</p>
                <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 10px 0;"><strong style="color: #64748b; font-size: 13px; text-transform: uppercase;">訂單編號</strong><br><span style="font-family: monospace; font-size: 15px;">${orderId}</span></p>
                    <p style="margin: 0 0 10px 0;"><strong style="color: #64748b; font-size: 13px; text-transform: uppercase;">購買項目</strong><br><strong>${itemsDesc}</strong></p>
                    <p style="margin: 0;"><strong style="color: #64748b; font-size: 13px; text-transform: uppercase;">實付金額</strong><br><span style="font-size: 18px; color: #10b981; font-weight: bold;">TWD $${amount}</span></p>
                </div>
                <p>${fulfillmentMessage}</p>
                <p style="margin-top: 30px;">
                    <a href="https://vibe-coding.tw/dashboard.html" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">前往學習儀表板</a>
                </p>
            `,
            '謝謝您的支持！<br>Vibe Coding 團隊'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Payment success email sent to ${email} for order ${orderId}`);
    } catch (error) {
        console.error('Error sending payment email:', error);
    }
}

/**
 * Send a trial expiration warning email.
 * @param {string} email - User's email address
 * @param {string} displayName - User's name
 * @param {number} daysLeft - Days remaining in trial
 */
async function sendTrialExpiringEmail(email, displayName, daysLeft) {
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `您的試用期即將在 ${daysLeft} 天後結束`,
        html: getEmailHtmlWrapper(
            '試用期即將結束',
            `
                <p>Hi ${displayName || '開發者'},</p>
                <p>提醒您，您的 Vibe Coding 入門試用資格即將在 <strong>${daysLeft} 天</strong>後到期。</p>
                <p>希望您在這些課程中收穫滿滿！如果您希望繼續存取這些內容或解鎖更多進階課程，請考慮升級您的帳戶，解鎖更多 AI 實作技能。</p>
                <p style="margin-top: 30px;">
                    <a href="https://vibe-coding.tw/index.html" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2);">查看課程方案</a>
                </p>
            `,
            'Vibe Coding 團隊'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Trial expiring email sent to ${email}`);
    } catch (error) {
        console.error('Error sending trial email:', error);
    }
}

/**
 * Send a course expiration warning email.
 * @param {string} email - User's email address
 * @param {string} displayName - User's name
 * @param {string} courseName - Name of the course
 * @param {number} daysLeft - Days remaining
 */
async function sendCourseExpiringEmail(email, displayName, courseName, daysLeft) {
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `[提醒] 您的課程 "${courseName}" 即將在 ${daysLeft} 天後到期`,
        html: getEmailHtmlWrapper(
            '課程使用期限提醒',
            `
                <p>Hi ${displayName || '開發者'},</p>
                <p>提醒您，您的課程 <strong>${courseName}</strong> 的使用期限即將在 <strong>${daysLeft} 天</strong>後到期。</p>
                <p>把握最後的時間複習課程內容！如果您希望繼續存取這些內容或解鎖更多進階課程，請考慮購買續約或查看最新優惠。</p>
                <p style="margin-top: 30px;">
                    <a href="https://vibe-coding.tw/dashboard.html" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">登入儀表板</a>
                </p>
            `,
            'Happy Coding!<br>Vibe Coding 團隊'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Course expiring email sent to ${email} for course ${courseName}`);
    } catch (error) {
        console.error('Error sending course expiring email:', error);
    }
}

/**
 * Send an email to a newly authorized tutor.
 * @param {string} email - Tutor's email address
 * @param {string} unitName - Name of the unit
 * @param {string} unitId - The course unit ID
 * @param {string} assignmentUrl - The GitHub Classroom assignment URL
 */
async function sendTutorAuthorizationEmail(email, unitName, unitId, assignmentUrl) {
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}&tab=assignments` : `https://vibe-coding.tw/dashboard.html`;

    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `Vibe Coding 課程單元授權通知: ${unitName}`,
        text: `恭喜您成為 Vibe Coding 授權導師！\n\n您已獲得課程單元 "${unitName}" 的管理權限。\n\n您的專屬招生連結 (GitHub Classroom) 為：\n${assignmentUrl || '尚未配置'}\n\n學生點擊此連結報名時，系統將自動計算您的分潤。\n\n請前往導師儀表板開始管理：\n${dashboardUrl}\n\nHappy Teaching!\nVibe Coding Team`,
        html: getEmailHtmlWrapper(
            '授權導師資格通知',
            `
                <p>Hi,</p>
                <p>恭喜您！您已獲得課程單元 <strong>${unitName}</strong> 的管理授權。現在可以存取導師資源、管理學生作業並獲得推廣分潤權益。</p>
                
                <div style="background: #f0f7ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #d0e7ff;">
                    <p style="margin: 0; color: #4f46e5; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">您的專屬招生連結 (GitHub Classroom)</p>
                    <p style="margin: 12px 0; font-size: 14px; word-break: break-all; color: #1e293b; font-family: monospace; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e0edff;">
                        <a href="${assignmentUrl || '#'}" style="color: #4f46e5; text-decoration: none;">${assignmentUrl || '尚未配置連結'}</a>
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b;">（學生點擊此連結報名課程，即可自動獲取作業權限並連結至您的分潤帳戶）</p>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold;">下一步建議：</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569;">
                        <li style="margin-bottom: 5px;">登入導師儀表板獲取推廣專屬 QR Code</li>
                        <li style="margin-bottom: 5px;">分享上述 GitHub Classroom 連結給您的學生</li>
                        <li>在「分潤」分頁即時追蹤您的成交成效</li>
                    </ul>
                </div>

                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">前往導師儀表板</a>
                </p>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; word-break: break-all;">備用網址連結：<br>${dashboardUrl}</p>
            `,
            'Happy Teaching!<br>Vibe Coding 教務組'
        )
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Tutor authorization email sent to ${email} for unit ${unitId}. MessageId: ${info.messageId}`);
    } catch (error) {
        console.error('Error sending tutor authorization email:', error);
    }
}

/**
 * Send an assignment submission notification to the tutor/admin.
 * @param {string} tutorEmail - Tutor's email address
 * @param {string} studentName - Student's display name
 * @param {string} assignmentTitle - Title of the assignment
 * @param {string} assignmentUrl - Link to the assignment or dashboard
 */
async function sendAssignmentNotification(tutorEmail, studentName, assignmentTitle, assignmentUrl) {
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: tutorEmail,
        subject: `[作業繳交] ${studentName} 繳交了 "${assignmentTitle}"`,
        html: getEmailHtmlWrapper(
            '收到新的作業！',
            `
                <p>老師您好,</p>
                <p>學生 <strong>${studentName}</strong> 剛剛繳交了作業，待您進行批閱：</p>
                <div style="background-color: #f8fafc; padding: 25px; border-radius: 10px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 10px 0;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">作業名稱</strong><br><strong>${assignmentTitle}</strong></p>
                    <p style="margin: 0;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">繳交時間</strong><br>${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                </div>
                
                <div style="background-color: #fefce8; border-left: 4px solid #facc15; padding: 15px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; font-weight: bold; color: #854d0e; font-size: 14px;">💡 教學互動建議</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #713f12;">除了批改分數，給予深入的具體反饋能幫助學生更快進步。良好的師生互動是持續學習的最佳動力！</p>
                </div>

                <p style="margin-top: 30px;">
                    <a href="${assignmentUrl || 'https://vibe-coding.tw/dashboard.html?tab=assignments'}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">前往儀表板批改</a>
                </p>
            `,
            'Vibe Coding 自動化管家'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Assignment notification sent to ${tutorEmail}`);
    } catch (error) {
        console.error('Error sending assignment notification:', error);
    }
}

/**
 * Send an email to the student when their assignment is graded.
 * @param {string} email - Student's email
 * @param {string} studentName - Student's name
 * @param {string} assignmentTitle - Assignment title
 * @param {number} grade - Grade received
 * @param {string} feedback - Tutor's feedback
 */
async function sendGradingNotification(email, studentName, assignmentTitle, grade, feedback, dashboardUrl = 'https://vibe-coding.tw/dashboard.html?tab=assignments') {
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `[作業評改] 老師已評回您的作業 "${assignmentTitle}"`,
        html: getEmailHtmlWrapper(
            '作業已完成評閱！',
            `
                <p>Hi ${studentName},</p>
                <p>老師已經看過您繳交的 <strong>${assignmentTitle}</strong> 並給予了回饋，快來看看您的學習成果吧！</p>
                
                <div style="background-color: #f0fdf4; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #dcfce7;">
                    <p style="margin: 0 0 15px 0;"><strong style="color: #166534; font-size: 13px; text-transform: uppercase;">獲得評分</strong><br><span style="font-size: 32px; color: #10b981; font-weight: 800;">${grade}</span></p>
                    <p style="margin: 0; background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #dcfce7;"><strong style="color: #166534; font-size: 12px; text-transform: uppercase;">老師的話：</strong><br><span style="color: #1e293b;">${feedback || '做得好！繼續加油。'}</span></p>
                </div>

                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; font-weight: bold; color: #1d4ed8; font-size: 14px;">🤝 建立良好的師生互動</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">對評語或課程有疑問嗎？歡迎透過平台的功能或 Email 向老師提問。保持積極的溝通能讓您的學習更有效率！</p>
                </div>

                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">查看作業詳情</a>
                </p>
            `,
            '持續前進！<br>Vibe Coding 團隊'
        )
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Grading notification sent to ${email}`);
    } catch (error) {
        console.error('Error sending grading notification:', error);
    }
}

/**
 * Send an email to the student when they are assigned a tutor for a unit.
 */
async function sendStudentLinkedToTutorEmail(email, studentName, unitId, tutorEmail) {
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}&tab=assignments` : 'https://vibe-coding.tw/dashboard.html';
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `[課程通知] 您的單元 "${unitId}" 已指派指導老師`,
        html: getEmailHtmlWrapper(
            '專屬老師已指派！',
            `
                <p>Hi ${studentName},</p>
                <p>我們已為您的課程單元 <strong>${unitId}</strong> 指派了專屬指導老師，協助您更精準地掌握技能：</p>
                <div style="background-color: #f0f9ff; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #e0f2fe; text-align: center;">
                    <p style="margin: 0 0 5px 0; color: #0369a1; font-size: 13px; text-transform: uppercase;">您的指導老師</p>
                    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0ea5e9;">${tutorEmail}</p>
                </div>
                <p>在學習過程中若有任何疑問，或完成作業後需要批改，老師都會全程協助您。鼓勵您主動與老師保持聯繫，祝您學習愉快！</p>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">前往儀表板</a>
                </p>
            `,
            'Vibe Coding 團隊'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending student relationship email:', error);
    }
}

/**
 * Send an email to the tutor when a student is assigned to them.
 */
async function sendTutorLinkedToStudentEmail(email, studentName, unitId) {
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}&tab=assignments` : 'https://vibe-coding.tw/dashboard.html';
    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: `[教學任務] 新學生 ${studentName} 已指派給您 (${unitId})`,
        html: getEmailHtmlWrapper(
            '新的教學任務',
            `
                <p>老師您好，</p>
                <p>系統已將學生 <strong>${studentName}</strong> 指派給您，進行單元 <strong>${unitId}</strong> 的課程指導。</p>
                <div style="background-color: #fffbeb; border-left: 4px solid #fbbf24; padding: 20px; margin: 25px 0; border-radius: 8px;">
                    <p style="margin: 0; font-weight: bold; color: #92400e; font-size: 14px; text-transform: uppercase;">💡 教務提醒</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #92400e;">請隨時關注這位學生的學習進度與作業繳交狀況，並透過積極的正向回饋建立良好的教學互動關係。學生的成長是我們最大的成就！</p>
                </div>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">開啟導師後台</a>
                </p>
            `,
            'Vibe Coding 教務系統'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending tutor relationship email:', error);
    }
}

/**
 * Send an email to the admin when a new tutor application is submitted.
 */
async function sendAdminNewApplicationEmail(adminEmail, userEmail, unitId) {
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}&tab=admin` : 'https://vibe-coding.tw/dashboard.html?tab=admin';
    const mailOptions = {
        from: '"Vibe Coding System" <info@vibe-coding.tw>',
        to: adminEmail,
        subject: `[新申請] 合格導師資格申請: ${userEmail}`,
        html: getEmailHtmlWrapper(
            '收到新的合格導師申請',
            `
                <p>管理員您好，</p>
                <p>使用者 <strong>${userEmail}</strong> 提交了針對單元 <strong>${unitId}</strong> 的合格導師資格申請，待您進行審核。</p>
                <div style="background-color: #fff7ed; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #ffedd5; text-align: center;">
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #ea580c;">申請人：${userEmail}</p>
                </div>
                <p>請前往 Admin Console 進行資料審核與權限授權。</p>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background-color: #ea580c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(234, 88, 12, 0.2);">開啟管理控制台</a>
                </p>
            `,
            'Vibe Coding 自動化管家'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending admin application notification:', error);
    }
}

/**
 * Send an email to the user when their tutor application has been resolved.
 */
async function sendApplicationResultEmail(email, unitId, status, message = "") {
    const isApproved = status === 'approved';
    const subject = isApproved ? `[申請通過] 恭喜您成為 "${unitId}" 的合格導師` : `[申請結果] 您的 "${unitId}" 合格導師申請未通過`;
    const titleColor = isApproved ? '#2ECC71' : '#E74C3C';
    const resultText = isApproved ? '恭喜！您的申請已獲批准。' : '很遺憾，您的申請目前未獲批准。';
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}&tab=assignments` : 'https://vibe-coding.tw/dashboard.html';

    const mailOptions = {
        from: '"Vibe Coding" <info@vibe-coding.tw>',
        to: email,
        subject: subject,
        html: getEmailHtmlWrapper(
            isApproved ? '合格導師申請通過！' : '合格導師申請結果通知',
            `
                <p>Hi,</p>
                <p>關於您對單元 <strong>${unitId}</strong> 的合格導師進階權限申請，管理員已完成審查。</p>
                
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 15px 0;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">審核狀態</strong><br><span style="font-size: 20px; color: ${titleColor}; font-weight: 800;">${isApproved ? '已通過 (Approved)' : '未通過 (Rejected)'}</span></p>
                    ${message ? `<p style="margin: 15px 0 0 0; background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">管理員回覆：</strong><br><span style="color: #1e293b;">${message}</span></p>` : ''}
                </div>

                ${isApproved ? `
                <p>恭喜您正式加入導師團隊！您現在已經具備該單元的管理權限。建議您立即登入儀表板查看相關功能：</p>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">開啟導師儀表板</a>
                </p>
                ` : `
                <p>若有任何疑問，歡迎回覆此郵件與我們聯繫。您可以持續精進實作技能，並於日後再次提交申請。我們期待您的加入！</p>
                `}
            `,
            '祝 順心！<br>Vibe Coding 團隊'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending application result email:', error);
    }
}

/**
 * Send a summary email to the admin about pending student assignments.
 */
async function sendAdminAssignmentReminder(adminEmail, pendingList) {
    const dashboardUrl = 'https://vibe-coding.tw/dashboard.html?tab=admin';
    const listHtml = pendingList.map(item => `
        <li style="margin-bottom: 10px;">
            <strong>${item.email}</strong> 購買了: <em>${item.units.join(', ')}</em>
        </li>
    `).join('');

    const mailOptions = {
        from: '"Vibe Coding System" <info@vibe-coding.tw>',
        to: adminEmail,
        subject: `[每日提醒] 尚有 ${pendingList.length} 位學生等待指派老師`,
        html: getEmailHtmlWrapper(
            '待處理的課程指派任務',
            `
                <p>管理員您好，系統掃描到以下已付費學生尚未完成所有課程單元的老師指派，請撥冗處理：</p>
                <ul style="background-color: #f8fafc; padding: 25px; border-radius: 12px; list-style-type: none; border: 1px solid #e2e8f0; margin: 25px 0;">
                    ${listHtml}
                </ul>
                <p>完成指派能確保學生的學習權益與教學互動品質。良好的第一印象是學員續約的關鍵。</p>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background-color: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">前往後台處理</a>
                </p>
            `,
            'Vibe Coding 自動化管家'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending admin reminder email:', error);
    }
}

/**
 * Send a summary email to the admin about pending shipments.
 */
async function sendAdminShipmentReminder(adminEmail, pendingList) {
    const dashboardUrl = 'https://vibe-coding.tw/dashboard.html?tab=admin';
    const listHtml = pendingList.map(item => `
        <li style="margin-bottom: 15px; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">
            <div style="font-weight: bold; color: #2d3748;">訂單: ${item.orderId}</div>
            <div style="font-size: 14px; color: #4a5568;">買家: ${item.email} | 付款時間: ${item.paidAt}</div>
            <div style="font-size: 14px; color: #4f46e5; margin-top: 5px;">項目: ${item.items.join(', ')}</div>
        </li>
    `).join('');

    const mailOptions = {
        from: '"Vibe Coding System" <info@vibe-coding.tw>',
        to: adminEmail,
        subject: `[每日提醒] 尚有 ${pendingList.length} 筆訂單等待出貨`,
        html: getEmailHtmlWrapper(
            '待處理的實體出貨任務',
            `
                <p>管理員您好，系統掃描到以下訂單包含實體教材且尚未標記為已出貨，請撥冗處理：</p>
                <ul style="background-color: #f8fafc; padding: 25px; border-radius: 12px; list-style-type: none; border: 1px solid #e2e8f0; margin: 25px 0;">
                    ${listHtml}
                </ul>
                <p>及時的出貨與精美的包裝能顯著提升品牌信任感。加油！</p>
                <p style="margin-top: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);">前往後台處理</a>
                </p>
            `,
            'Vibe Coding 自動化管家'
        )
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending admin shipment reminder email:', error);
    }
}

module.exports = {
    sendWelcomeEmail,
    sendPaymentSuccessEmail,
    sendTrialExpiringEmail,
    sendCourseExpiringEmail,
    sendAssignmentNotification,
    sendTutorAuthorizationEmail,
    sendGradingNotification,
    sendStudentLinkedToTutorEmail,
    sendTutorLinkedToStudentEmail,
    sendAdminAssignmentReminder,
    sendAdminShipmentReminder,
    sendAdminNewApplicationEmail,
    sendApplicationResultEmail
};
