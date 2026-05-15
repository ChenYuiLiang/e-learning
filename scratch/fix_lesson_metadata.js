
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

async function fixLessonMetadata() {
    const courseDocId = "JKgVwocZw4hAd5VOsqz7";
    const unitId = "start-01-unit-flexbox-layout.html";
    const inviteUrl = "https://classroom.github.com/a/QbqpVXAY";

    console.log(`Updating githubClassroomUrls for course: ${courseDocId}...`);
    
    const docRef = db.collection('metadata_lessons').doc(courseDocId);
    const doc = await docRef.get();

    if (!doc.exists) {
        console.error("Course document not found.");
        return;
    }

    const data = doc.data();
    const currentUrls = data.githubClassroomUrls || {};
    
    // Update the map
    currentUrls[unitId] = inviteUrl;

    await docRef.update({
        githubClassroomUrls: currentUrls,
        // Double check the titles are correct
        title: "Web App 快速入門與 UI/UX 設計",
        courseName: "Web App 快速入門與 UI/UX 設計"
    });

    console.log("Firestore update complete.");
    
    // Also update 'lessons' collection if it exists there
    const lessonsRef = db.collection('lessons').doc(courseDocId);
    const lDoc = await lessonsRef.get();
    if (lDoc.exists) {
        console.log("Updating 'lessons' collection too...");
        await lessonsRef.update({
            githubClassroomUrls: currentUrls,
            title: "Web App 快速入門與 UI/UX 設計",
            name: "Web App 快速入門與 UI/UX 設計"
        });
    }
}

fixLessonMetadata().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
