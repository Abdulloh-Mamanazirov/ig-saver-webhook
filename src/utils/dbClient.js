require("dotenv").config();
const path = require("path");
const { Client } = require("pg");

const DB_URL = process.env.DATABASE_URL;

const dbClient = new Client({
  connectionString: DB_URL,
});

dbClient
  .connect()
  .then(() => console.log("Connected to database", path.dirname()))
  .catch((err) =>
    console.error("Database connection error:", path.dirname(), err)
  );

module.exports = { dbClient };
