// Configuration et gestion de la base de données PostgreSQL
const { Pool } = require('pg');

// Vérifier que DATABASE_URL est défini
if (!process.env.DATABASE_URL) {
    console.error('❌ ERREUR CRITIQUE: La variable d\'environnement DATABASE_URL n\'est pas définie !');
    console.error('📝 Veuillez configurer DATABASE_URL dans vos variables d\'environnement.');
    console.error('   Format: postgresql://username:password@host:port/database');
    process.exit(1);
}

console.log('✅ DATABASE_URL détectée');
console.log('🔧 Environnement:', process.env.NODE_ENV || 'development');

// Configuration de la connexion PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Tester la connexion
pool.on('connect', () => {
    console.log('✅ Connexion à PostgreSQL établie');
});

pool.on('error', (err) => {
    console.error('❌ Erreur PostgreSQL:', err.message);
});

// Initialiser les tables
async function initDatabase() {
    console.log('🔄 Initialisation de la base de données...');
    const client = await pool.connect();
    try {
        console.log('✅ Client PostgreSQL connecté');
        // Table users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                permissions JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table sanctions
        await client.query(`
            CREATE TABLE IF NOT EXISTS sanctions (
                id SERIAL PRIMARY KEY,
                staff_member VARCHAR(255) NOT NULL,
                type VARCHAR(100) NOT NULL,
                reason TEXT NOT NULL,
                notes TEXT,
                author VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table tasks
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                assigned_to TEXT[] NOT NULL,
                due_date DATE NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                author VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table announcements
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                author VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table absences
        await client.query(`
            CREATE TABLE IF NOT EXISTS absences (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                reason TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Vérifier si l'utilisateur admin existe
        const adminCheck = await client.query('SELECT * FROM users WHERE username = $1', ['admin']);

        if (adminCheck.rows.length === 0) {
            // Créer l'utilisateur admin par défaut
            await client.query(`
                INSERT INTO users (username, password, role, permissions)
                VALUES ($1, $2, $3, $4)
            `, [
                'admin',
                'admin123',
                'admin',
                JSON.stringify({
                    canManageSanctions: true,
                    canManageTasks: true,
                    canManageAnnouncements: true,
                    canManageUsers: true
                })
            ]);
            console.log('✅ Utilisateur admin créé par défaut');
        }

        console.log('✅ Base de données initialisée');
    } catch (error) {
        console.error('❌ Erreur initialisation base de données:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Fonctions pour les utilisateurs
async function getUsers() {
    const result = await pool.query('SELECT id, username, role, permissions, created_at FROM users ORDER BY id');
    return result.rows;
}

async function getUserByUsername(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
}

async function createUser(username, password, role, permissions) {
    const result = await pool.query(
        'INSERT INTO users (username, password, role, permissions) VALUES ($1, $2, $3, $4) RETURNING id, username, role, permissions, created_at',
        [username, password, role, JSON.stringify(permissions)]
    );
    return result.rows[0];
}

async function updateUser(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.username) {
        fields.push(`username = $${paramCount++}`);
        values.push(updates.username);
    }
    if (updates.password) {
        fields.push(`password = $${paramCount++}`);
        values.push(updates.password);
    }
    if (updates.role) {
        fields.push(`role = $${paramCount++}`);
        values.push(updates.role);
    }
    if (updates.permissions) {
        fields.push(`permissions = $${paramCount++}`);
        values.push(JSON.stringify(updates.permissions));
    }

    values.push(id);

    const result = await pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, role, permissions, created_at`,
        values
    );
    return result.rows[0];
}

async function deleteUser(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

async function getUsernames() {
    const result = await pool.query('SELECT username FROM users ORDER BY username');
    return result.rows.map(row => row.username);
}

// Fonctions pour les sanctions
async function getSanctions() {
    const result = await pool.query('SELECT * FROM sanctions ORDER BY created_at DESC');
    return result.rows.map(row => ({
        id: row.id,
        staffMember: row.staff_member,
        type: row.type,
        reason: row.reason,
        notes: row.notes,
        author: row.author,
        date: row.created_at
    }));
}

async function createSanction(staffMember, type, reason, notes, author) {
    const result = await pool.query(
        'INSERT INTO sanctions (staff_member, type, reason, notes, author) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [staffMember, type, reason, notes, author]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        staffMember: row.staff_member,
        type: row.type,
        reason: row.reason,
        notes: row.notes,
        author: row.author,
        date: row.created_at
    };
}

async function deleteSanction(id) {
    await pool.query('DELETE FROM sanctions WHERE id = $1', [id]);
}

// Fonctions pour les tâches
async function getTasks() {
    const result = await pool.query('SELECT * FROM tasks ORDER BY due_date');
    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        assignedTo: row.assigned_to,
        date: row.due_date,
        dueDate: row.due_date,
        status: row.status,
        author: row.author,
        assignedBy: row.author,
        createdAt: row.created_at
    }));
}

async function createTask(title, description, assignedTo, dueDate, author) {
    // Convertir assignedTo en tableau si c'est une string
    const assignedToArray = typeof assignedTo === 'string'
        ? assignedTo.split(',').map(u => u.trim())
        : assignedTo;

    const result = await pool.query(
        'INSERT INTO tasks (title, description, assigned_to, due_date, author) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, description, assignedToArray, dueDate, author]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        assignedTo: row.assigned_to,
        date: row.due_date,
        dueDate: row.due_date,
        status: row.status,
        author: row.author,
        assignedBy: row.author,
        createdAt: row.created_at
    };
}

async function updateTaskStatus(id, status) {
    const result = await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        assignedTo: row.assigned_to,
        date: row.due_date,
        dueDate: row.due_date,
        status: row.status,
        author: row.author,
        assignedBy: row.author,
        createdAt: row.created_at
    };
}

async function deleteTask(id) {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

// Fonctions pour les annonces
async function getAnnouncements() {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type,
        author: row.author,
        date: row.created_at
    }));
}

async function createAnnouncement(title, content, type, author) {
    const result = await pool.query(
        'INSERT INTO announcements (title, content, type, author) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, content, type, author]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type,
        author: row.author,
        date: row.created_at
    };
}

async function deleteAnnouncement(id) {
    await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
}

// Fonctions pour les absences
async function getAbsences() {
    const result = await pool.query('SELECT * FROM absences ORDER BY start_date DESC');
    return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason,
        createdAt: row.created_at
    }));
}

async function createAbsence(username, startDate, endDate, reason) {
    const result = await pool.query(
        'INSERT INTO absences (username, start_date, end_date, reason) VALUES ($1, $2, $3, $4) RETURNING *',
        [username, startDate, endDate, reason]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        username: row.username,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason,
        createdAt: row.created_at
    };
}

async function deleteAbsence(id) {
    await pool.query('DELETE FROM absences WHERE id = $1', [id]);
}

module.exports = {
    pool,
    initDatabase,
    // Users
    getUsers,
    getUserByUsername,
    createUser,
    updateUser,
    deleteUser,
    getUsernames,
    // Sanctions
    getSanctions,
    createSanction,
    deleteSanction,
    // Tasks
    getTasks,
    createTask,
    updateTaskStatus,
    deleteTask,
    // Announcements
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    // Absences
    getAbsences,
    createAbsence,
    deleteAbsence
};
