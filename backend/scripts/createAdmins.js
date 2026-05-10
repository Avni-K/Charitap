const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

async function createAdmins() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/charitap';
  await mongoose.connect(uri);
  
  const emails = ['himanshu@charitap.com', 'admin@charitap.com', 'your-email@gmail.com'];
  const password = 'charitap';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  for (const email of emails) {
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        password: hashedPassword,
        authProvider: 'local',
        displayName: email.split('@')[0],
        role: 'admin',
        adminScope: 'wellspring'
      });
      await user.save();
      console.log(`Created admin user: ${email}`);
    } else {
      user.password = hashedPassword;
      user.role = 'admin';
      user.adminScope = 'wellspring';
      await user.save();
      console.log(`Updated existing admin user: ${email}`);
    }
  }
  
  mongoose.disconnect();
}

createAdmins().catch(console.error);
