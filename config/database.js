const mongoose = require('mongoose')

const database = async () => {
    // await mongoose.connect(process.env.DATABASE)

  await  mongoose.connect(process.env.DATABASE, {
  serverSelectionTimeoutMS: 10000,  // 10s timeout
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: "majority",
}).then((con) => {
   console.log(`database connect ${con.connection.host}`);
})
}

module.exports = database



