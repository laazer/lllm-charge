// Debug script to understand task selection behavior
import { AutomaticTaskPickupSkill } from './src/skills/automatic-task-pickup-skill.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugTaskSelection() {
  console.log('🔍 Debugging AutomaticTaskPickupSkill task selection...');
  
  const skill = new AutomaticTaskPickupSkill({
    backlogPath: path.join(__dirname, 'tickets', 'pending'),
    maxConcurrentTasks: 3,
    priorityWeights: {
      'Critical': 100,
      'High': 75,
      'Medium': 50,
      'Low': 25
    },
    epicFocus: ['Python Migration', 'Platform Migration'],
    preferredTaskTypes: ['Migration', 'Integration', 'Architecture'],
    skillConstraints: {
      'database': 'high',
      'python': 'high',
      'typescript': 'high',
      'mcp': 'high'
    }
  });

  try {
    console.log('\n📋 Scanning for available tasks...');
    const result = await skill.pickNextTask();

    console.log('\n✅ Task Selection Results:');
    console.log('Selected Task:', result.selectedTask ? result.selectedTask.id + ': ' + result.selectedTask.title : 'None');
    console.log('Reason:', result.reason);
    
    if (result.alternativeTasks && result.alternativeTasks.length > 0) {
      console.log('\n📋 Alternative Tasks Available:');
      result.alternativeTasks.slice(0, 5).forEach((task, index) => {
        console.log(`${index + 1}. ${task.id}: ${task.title}`);
        console.log(`   Priority: ${task.priority}, Type: ${task.type}, Epic: ${task.epic}`);
      });
    }

    if (result.blockedTasks && result.blockedTasks.length > 0) {
      console.log('\n🚫 Blocked Tasks:');
      result.blockedTasks.slice(0, 3).forEach((task, index) => {
        console.log(`${index + 1}. ${task.id}: ${task.title}`);
      });
    }

    console.log('\n💡 Recommendations:');
    result.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });

    console.log('\n➡️ Next Actions:');
    result.nextActions.forEach(action => {
      console.log(`• ${action}`);
    });

    return result;

  } catch (error) {
    console.error('❌ Error during task selection:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

debugTaskSelection().catch(console.error);