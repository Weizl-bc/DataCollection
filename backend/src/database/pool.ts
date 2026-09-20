import mysql from "mysql2/promise";
import { settings } from "../config/settings";

export const pool = mysql.createPool({
  host: settings.database.host,
  port: settings.database.port,
  user: settings.database.user,
  password: settings.database.password,
  database: settings.database.database,
  charset: settings.database.charset,
  timezone: settings.database.timeZone,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});
