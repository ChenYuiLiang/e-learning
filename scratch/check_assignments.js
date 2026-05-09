
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function checkAssignments() {
    console.log("Checking Student-Tutor Assignments...");
    const usersSnap = await db.collection('users').get();
    
    let totalAssignments = 0;
    const studentStats = [];

    usersSnap.forEach(doc => {
        const data = doc.data();
        const assignments = data.unitAssignments || {};
        const assignmentCount = Object.keys(assignments).length;

        if (assignmentCount > 0) {
            totalAssignments += assignmentCount;
            studentStats.push({
                email: data.email || doc.id,
                role: data.role,
                assignments: assignments
            });
        }
    });

    console.log(`\nFound ${studentStats.length} students with assignments.`);
    console.log(`Total unit assignments: ${totalAssignments}\n`);

    studentStats.forEach(s => {
        console.log(`Student: ${s.email} (${s.role})`);
        Object.entries(s.assignments).forEach(([unit, tutor]) => {
            console.log(`  - Unit: ${unit} -> Tutor: ${tutor}`);
        });
        console.log('-------------------');
    });
}

checkAssignments().catch(e => {
    console.error("Error checking assignments:", e);
    process.exit(1);
});
