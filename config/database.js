// const mongoose = require('mongoose')

// const database = async () => {
//     await mongoose.connect(process.env.DATABASE)
// .then((con) => {
//    console.log(`database connect ${con.connection.host}`);
// })
// }

// module.exports = database












const mongoose = require('mongoose');

const database = async () => {
  try {
    const con = await mongoose.connect(process.env.DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30s wait to find MongoDB server
      socketTimeoutMS: 45000,           // 45s socket timeout
      connectTimeoutMS: 30000,          // 30s connection timeout
    });
    console.log(`✅ Database connected: ${con.connection.host}`);
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
  }
};

module.exports = database;



