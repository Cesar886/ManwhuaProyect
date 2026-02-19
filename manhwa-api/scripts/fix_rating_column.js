const { query } = require('../src/config/database');

async function fixRatingColumn() {
    try {
        console.log('Fixing numeric precision for rating columns...');
        
        // Alter series table
        await query(`ALTER TABLE series ALTER COLUMN rating_average TYPE DECIMAL(5,2);`);
        
        // Alter chapters table
        await query(`ALTER TABLE chapters ALTER COLUMN rating TYPE DECIMAL(5,2);`);

        console.log('Column types updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

fixRatingColumn();
