const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Charity = require('../models/Charity');
const zipGeocoder = require('../services/zip-geocoder');
const embeddingService = require('../services/embedding-service');

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const charities = await Charity.find();

  for (const charity of charities) {
    if (charity.zipCode && !charity.location?.coordinates?.length) {
      charity.location = await zipGeocoder.geocodeZip(charity.zipCode);
    }

    const text = [charity.name, charity.type, charity.description, charity.zipCode]
      .filter(Boolean)
      .join(' ');
    charity.searchText = text.toLowerCase();
    charity.embedding = await embeddingService.embedText(text);
    await charity.save();
    console.log(`Updated search metadata for ${charity.name}`);
  }

  await mongoose.disconnect();
}

run().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
