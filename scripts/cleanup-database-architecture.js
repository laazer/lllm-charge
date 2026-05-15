#!/usr/bin/env node
/**
 * Database Architecture Cleanup Script
 * 
 * Removes legacy agent and workflow data from main database to resolve
 * CRITICAL-003: Database Architecture Chaos
 * 
 * The system already uses independent databases correctly:
 * - agents.db for independent agents (24 agents)
 * - flows.db for independent flows (27 flows) 
 * - llm-charge.db for projects, specs, notes, checkpoints
 * 
 * This script removes the conflicting legacy data from main database.
 */

import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';

const MAIN_DB_PATH = './data/llm-charge.db';
const BACKUP_DIR = './data/backups';

async function main() {
  try {
    console.log('🔧 Starting database architecture cleanup...');
    
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Create timestamp for this cleanup operation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `pre-cleanup-${timestamp}.db`);
    
    // Create backup before cleanup
    console.log('📦 Creating backup before cleanup...');
    await fs.copyFile(MAIN_DB_PATH, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    
    // Open main database
    const mainDb = new sqlite3.Database(MAIN_DB_PATH);
    
    // Check current state
    console.log('\n📊 Current state analysis:');
    const agentCount = await runQuery(mainDb, 'SELECT COUNT(*) as count FROM agents');
    const workflowCount = await runQuery(mainDb, 'SELECT COUNT(*) as count FROM workflows');
    
    console.log(`   Main DB agents: ${agentCount[0].count} (should be 0)`);
    console.log(`   Main DB workflows: ${workflowCount[0].count} (should be 0)`);
    
    if (agentCount[0].count === 0 && workflowCount[0].count === 0) {
      console.log('✅ No cleanup needed - architecture is already clean!');
      mainDb.close();
      return;
    }
    
    // Perform cleanup
    console.log('\n🧹 Starting cleanup operations...');
    
    if (agentCount[0].count > 0) {
      console.log(`   Removing ${agentCount[0].count} legacy agents...`);
      await runQuery(mainDb, 'DELETE FROM agents');
      console.log('   ✅ Legacy agents removed');
    }
    
    if (workflowCount[0].count > 0) {
      console.log(`   Removing ${workflowCount[0].count} legacy workflows...`);
      await runQuery(mainDb, 'DELETE FROM workflows');  
      console.log('   ✅ Legacy workflows removed');
    }
    
    // Drop the tables entirely to prevent future confusion
    console.log('\n🗑️  Dropping legacy tables to prevent future conflicts...');
    
    try {
      await runQuery(mainDb, 'DROP TABLE agents');
      console.log('   ✅ Agents table dropped from main database');
    } catch (error) {
      console.log('   ⚠️  Agents table already dropped or doesn\'t exist');
    }
    
    try {
      await runQuery(mainDb, 'DROP TABLE workflows');
      console.log('   ✅ Workflows table dropped from main database');
    } catch (error) {
      console.log('   ⚠️  Workflows table already dropped or doesn\'t exist');
    }
    
    // Verify cleanup
    console.log('\n🔍 Verification:');
    try {
      await runQuery(mainDb, 'SELECT COUNT(*) FROM agents');
      console.log('   ❌ ERROR: Agents table still exists!');
    } catch (error) {
      console.log('   ✅ Agents table successfully removed');
    }
    
    try {
      await runQuery(mainDb, 'SELECT COUNT(*) FROM workflows');
      console.log('   ❌ ERROR: Workflows table still exists!');
    } catch (error) {
      console.log('   ✅ Workflows table successfully removed');
    }
    
    // Close database
    mainDb.close();
    
    console.log('\n🎉 Database architecture cleanup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Legacy agents removed from main database');
    console.log('   • Legacy workflows removed from main database'); 
    console.log('   • Agent operations now use agents.db exclusively');
    console.log('   • Flow operations now use flows.db exclusively');
    console.log('   • Main database handles projects, specs, notes, checkpoints only');
    console.log(`   • Backup available at: ${backupPath}`);
    console.log('\n✅ CRITICAL-003 Database Architecture Chaos RESOLVED');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Utility function to run SQLite queries with promises
function runQuery(db, query, params = []) {
  return new Promise((resolve, reject) => {
    if (query.toUpperCase().startsWith('SELECT')) {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

// Run the script
main().catch(console.error);