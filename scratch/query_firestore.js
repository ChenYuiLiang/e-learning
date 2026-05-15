
const path = require('path');
const fs = require('fs');

// Define where to look for firebase-admin
const possiblePaths = [
    path.join(__dirname, '..', 'functions', 'node_modules'),
    path.join(__dirname, '..', 'node_modules')
];

let admin;
let found = false;

for (const p of possiblePaths) {
    const adminPath = path.join(p, 'firebase-admin');
    if (fs.existsSync(adminPath)) {
        console.log(`Found firebase-admin at: ${adminPath}`);
        module.paths.push(p);
        admin = require('firebase-admin');
        found = true;
        break;
    }
}

if (!found) {
    console.error("Could not find firebase-admin in functions/node_modules or root node_modules.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

function normalizeGitHubUrl(url = '') {
    if (!url) return '';
    try {
        let clean = url.trim().toLowerCase();
        clean = clean.replace(/\/+$/, '');
        return clean;
    } catch (e) {
        return url.trim().toLowerCase();
    }
}

async function query(targetUrl) {
    const normalizedTarget = normalizeGitHubUrl(targetUrl);
    console.log(`Querying for: ${targetUrl}`);
    console.log(`Normalized: ${normalizedTarget}\n`);

    // 1. Query referral_links collection
    console.log("--- Checking 'referral_links' collection ---");
    const refSnap = await db.collection('referral_links')
        .where('url', '==', normalizedTarget)
        .get();

    if (refSnap.empty) {
        console.log("No matches found in 'referral_links'.");
    } else {
        refSnap.forEach(doc => {
            console.log(`Match found in 'referral_links' (ID: ${doc.id}):`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    // 2. Scan users collection (as fallback or verification)
    console.log("\n--- Scanning 'users' collection (tutorConfigs) ---");
    const usersSnap = await db.collection('users').get();
    let userMatches = 0;

    usersSnap.forEach(doc => {
        const uData = doc.data();
        const tConfigs = uData.tutorConfigs || {};
        
        for (const [unitId, config] of Object.entries(tConfigs)) {
            const effectiveConfig = (config && !config.authorized && config.html) ? config.html : config;
            if (!effectiveConfig || !effectiveConfig.authorized) continue;

            const rawUrl = effectiveConfig.githubClassroomUrl || effectiveConfig.assignmentUrl || "";
            if (normalizeGitHubUrl(rawUrl) === normalizedTarget) {
                console.log(`Match found in user: ${uData.email} (${uData.name || 'N/A'})`);
                console.log(`  Unit ID: ${unitId}`);
                console.log(`  Config:`, effectiveConfig);
                userMatches++;
            }
        }
    });

    if (userMatches === 0) {
        console.log("No matches found in 'users' collection.");
    }
}

const target = 'https://classroom.github.com/a/QbqpVXAY';
query(target).catch(err => {
    console.error("Error during query:", err);
    process.exit(1);
});
