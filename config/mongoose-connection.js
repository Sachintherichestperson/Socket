const mongoose = require("mongoose");
const dbgr = require("debug")("production:mongoose");
const config = require("config");

const MONGO_URI = "mongodb+srv://sachinbajaj:MySecurePass@clartalk.gzh9a.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // Increase the timeout to 30 seconds
  })
  .then(() => dbgr("MongoDB Connected! 🚀"))
  .catch((err) => dbgr("MongoDB Connection Error:", err));
  

module.exports = mongoose.connection;
