
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function findUnboundAssignments() {
    console.log("Searching for assignments with Classroom URLs but no assigned teacher...");
    
    // We fetch all assignments
    const assignmentsSnap = await db.collection('assignments').get();
    
    let count = 0;
    const results = [];

    assignmentsSnap.forEach(doc => {
        const data = doc.data();
        const url = data.url || "";
        const assignedTeacher = data.assignedTeacherEmail;

        // Check if it's a GitHub Classroom URL
        const isClassroom = url.includes('classroom.github.com');
        
        // Check if teacher is bound
        // Also check student's unitAssignments just in case
        if (isClassroom && (!assignedTeacher || assignedTeacher === 'info@vibe-coding.tw')) {
            results.push({
                id: doc.id,
                studentEmail: data.studentEmail,
                unitId: data.unitId,
                url: url,
                assignedTeacher: assignedTeacher,
                submittedAt: data.submittedAt ? data.submittedAt.toDate().toISOString() : 'N/A'
            });
            count++;
        }
    });

    console.log(`\nFound ${count} unbound/placeholder assignments.\n`);

    if (results.length > 0) {
        console.table(results);
    } else {
        console.log("No unbound Classroom assignments found.");
    }
}

findUnboundAssignments().catch(e => {
    console.error(e);
    process.exit(1);
});
