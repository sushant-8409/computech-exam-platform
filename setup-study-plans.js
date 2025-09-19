const mongoose = require('mongoose');
require('dotenv').config();
const ProblemGroup = require('./models/ProblemGroup');

async function checkGroups() {
  try {
    // Wait for connection to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const groups = await ProblemGroup.find({}).populate('problems');
    console.log('Existing groups:', groups.length);
    groups.forEach(group => {
      console.log('- ' + group.name + ': ' + group.problems.length + ' problems, active: ' + group.isActive);
    });
    
    if (groups.length === 0) {
      console.log('No groups found. Creating sample groups...');
      
      const sampleGroups = [
        {
          name: 'Beginner Algorithms',
          description: 'Perfect for students new to programming and algorithms',
          difficulty: 'Beginner',
          allowedStudentClasses: ['9', '10'],
          createdBy: 'admin@example.com',
          isActive: true
        },
        {
          name: 'Data Structures Mastery',
          description: 'Master fundamental data structures like arrays, strings, and linked lists',
          difficulty: 'Intermediate', 
          allowedStudentClasses: ['10', '11', '12'],
          createdBy: 'admin@example.com',
          isActive: true
        },
        {
          name: 'Advanced Problem Solving',
          description: 'Challenge yourself with complex algorithms and optimization problems',
          difficulty: 'Advanced',
          allowedStudentClasses: ['11', '12'],
          createdBy: 'admin@example.com',
          isActive: true
        }
      ];
      
      for (const groupData of sampleGroups) {
        const group = new ProblemGroup(groupData);
        await group.save();
        console.log('Created group: ' + group.name);
      }
    }
    
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkGroups();