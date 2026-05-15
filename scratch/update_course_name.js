
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

async function updateCourseName() {
    const oldName = "We App 快速入門與 UI/UX 設計";
    const newName = "Web App 快速入門與 UI/UX 設計";

    console.log(`Searching for course: "${oldName}"...`);
    
    // Check both 'title' and 'courseName' fields
    const collections = ['metadata_lessons', 'lessons', 'products'];
    let updateCount = 0;

    for (const colName of collections) {
        console.log(`Checking collection: ${colName}...`);
        try {
            const snap = await db.collection(colName).get();
            for (const doc of snap.docs) {
                const data = doc.data();
                let changed = false;
                const updateData = {};

                // Check title, courseName, name
                const fieldsToCheck = ['title', 'courseName', 'name'];
                for (const field of fieldsToCheck) {
                    if (data[field] === oldName) {
                        updateData[field] = newName;
                        changed = true;
                    }
                }

                if (changed) {
                    console.log(`Updating document in ${colName}, ID: ${doc.id}`);
                    await db.collection(colName).doc(doc.id).update(updateData);
                    updateCount++;
                }
            }
        } catch (e) {
            console.warn(`Collection ${colName} not found or inaccessible.`);
        }
    }

    console.log(`\nUpdate finished. Total documents updated: ${updateCount}`);
}

updateCourseName().catch(err => {
    console.error("Error during update:", err);
    process.exit(1);
});
