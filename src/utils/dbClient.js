require("dotenv").config();
const { Client } = require("pg");

const DB_URL = process.env.DATABASE_URL;

const dbClient = new Client({
  connectionString: DB_URL,
});

dbClient
  .connect()
  .then(() => console.log("Connected to database"))
  .catch((err) =>
    console.error("Database connection error:", err)
  );

module.exports = { dbClient };
