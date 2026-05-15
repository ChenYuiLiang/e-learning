
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
    console.error("Could not find firebase-admin.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function revertMetadata() {
    const courseId = "JKgVwocZw4hAd5VOsqz7";
    console.log(`Reverting githubClassroomUrls for course: ${courseId}...`);
    
    // Remove the field entirely to restore original state
    await db.collection('metadata_lessons').doc(courseId).update({
        githubClassroomUrls: admin.firestore.FieldValue.delete()
    });

    console.log("Revert complete.");
}

revertMetadata().catch(err => {
    console.error("Error during revert:", err);
    process.exit(1);
});
