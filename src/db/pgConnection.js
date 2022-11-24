/**
 * connection via pg-promise
 */

const initOptions = {
  schema: ["public"],
};

// pgsql db connection using pg promise
const pgp = require("pg-promise")(initOptions);

// Reference: https://github.com/vitaly-t/pg-promise/wiki/Connection-Syntax#configuration-object
/* const connectionObj = {
  host: "halodb-proxy-dev.proxy-c28dvacixhqm.eu-west-1.rds.amazonaws.com", //Using proxy connection for pooling purposes
  port: 5432,
  database: "halodb",
  user: "halodbuser",
  password: "!Newark.",
  idleTimeoutMillis: 3000,
  max: 10,
  min: 1,
  query_timeout: 30000,
  ssl: true,
}; */
const pgConfig = {
  host: process.env.DB_HOST, //Using proxy connection for pooling purposes
  port: 5432,
  database: process.env.DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  idleTimeoutMillis: 3000,
  max: 10,
  min: 1,
  query_timeout: 30000,
  ssl: true,
};

const pgDb = pgp(pgConfig);

module.exports = {
  pgDb,
  pgp
};
