
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
        module.paths.push(p);
        admin = require('firebase-admin');
        found = true;
        break;
    }
}

if (!found) {
    console.error("Could not find firebase-admin.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function inspectLesson() {
    const productId = "ydb63bg";
    const targetUrl = "https://classroom.github.com/a/QbqpVXAY";

    console.log(`Inspecting lesson with product ID: ${productId}...`);
    
    // Check both metadata_lessons and lessons
    const collections = ['metadata_lessons', 'lessons'];
    let foundDoc = null;

    for (const col of collections) {
        const snap = await db.collection(col).doc(productId).get();
        if (snap.exists) {
            foundDoc = { id: snap.id, col, data: snap.data() };
            break;
        }
    }

    if (!foundDoc) {
        // Try searching by courseId field
        for (const col of collections) {
            const snap = await db.collection(col).where('courseId', '==', productId).get();
            if (!snap.empty) {
                foundDoc = { id: snap.docs[0].id, col, data: snap.docs[0].data() };
                break;
            }
        }
    }

    if (foundDoc) {
        console.log(`Found lesson in collection "${foundDoc.col}" with ID: ${foundDoc.id}`);
        console.log(`Title: ${foundDoc.data.title}`);
        console.log(`githubClassroomUrls:`, JSON.stringify(foundDoc.data.githubClassroomUrls, null, 2));
        
        const urls = foundDoc.data.githubClassroomUrls || {};
        const units = foundDoc.data.courseUnits || [];
        console.log(`Course Units:`, units);
    } else {
        console.error("Could not find lesson for product ID ydb63bg.");
    }
}

inspectLesson().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
