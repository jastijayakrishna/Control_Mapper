import { initDb, closeDb } from './database.js';
import { seedDb } from './seed-fn.js';

initDb();
seedDb();
closeDb();
console.log('Seeded catalog version 2024.1 (15 requirements, 9 controls, 1 demo customer)');
