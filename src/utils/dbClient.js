require("dotenv").config();
const { Client } = require("pg");

const DB_URL = process.env.DB_URL;

const dbClient = new Client({
  connectionString: DB_URL,
});

module.exports = { dbClient };
