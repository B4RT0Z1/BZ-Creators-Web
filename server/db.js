import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool(config.database);

export const checkDatabase = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query("SELECT 1");
  } finally {
    connection.release();
  }
};
