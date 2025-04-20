const mongoose = require("mongoose");
const dbgr = require("debug")("production:mongoose");
const config = require("config");

const MONGO_URI = "MONGODB_URI=mongodb+srv://sachinbajaj:MySecurePass@clartalk.gzh9a.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect(MONGO_URI)
.then(() => dbgr("MongoDB Connected! 🚀"))
.catch((err) => dbgr("MongoDB Connection Error:"));

module.exports = mongoose.connection;
