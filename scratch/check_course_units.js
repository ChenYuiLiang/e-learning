
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

async function checkCourseContent() {
    const courseId = "JKgVwocZw4hAd5VOsqz7";
    const targetUnit = "start-01-unit-flexbox-layout.html";

    console.log(`Fetching details for course ID: ${courseId}...`);
    const doc = await db.collection('metadata_lessons').doc(courseId).get();
    
    if (!doc.exists) {
        console.error("Course document not found.");
        return;
    }

    const data = doc.data();
    console.log(`Course Title: ${data.title}`);
    console.log(`Course Units:`, data.courseUnits || []);

    const units = data.courseUnits || [];
    const isIncluded = units.includes(targetUnit);

    console.log(`\nDoes it include "${targetUnit}"? ${isIncluded ? "YES" : "NO"}`);
}

checkCourseContent().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
