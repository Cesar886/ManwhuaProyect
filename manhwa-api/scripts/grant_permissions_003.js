const { query } = require('../src/config/database');

async function grantPermissions() {
    try {
        console.log('Granting permissions on new tables...');
        
        await query(`GRANT ALL PRIVILEGES ON TABLE series_ratings TO public;`);
        await query(`GRANT ALL PRIVILEGES ON TABLE chapter_ratings TO public;`);
        await query(`GRANT USAGE, SELECT ON SEQUENCE series_ratings_id_seq TO public;`);
        await query(`GRANT USAGE, SELECT ON SEQUENCE chapter_ratings_id_seq TO public;`);

        console.log('Permissions granted successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Grant permissions failed:', error);
        process.exit(1);
    }
}

grantPermissions();
