const {
  INCIDENT_TABLES,
  EVENT_TABLES,
  USER_TABLES,
  SCHEMAS,
} = require("../db/tables");
const handleErrors = require("./handleErrors");
let createError,
  { INVALID_REQUEST, NOT_FOUND } = require("./createError");
const { pgDb } = require("../db/pgConnection");

module.exports.isCrestAdmin = async (object_id, name) => {
  let query = `select id, permission_role from ${USER_TABLES.USER} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    resp = resp[0];

    return resp.permission_role === "CrestAdmin";
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getClientId = async (object_id) => {
  let query = `select id from ${USER_TABLES.CLIENT} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    console.log("Response from RDS:: Client --> ", resp);
    if (resp.length === 0) throw new Error("Invalid client_id!");

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getUserObject = async (object_id, name) => {
  if (!object_id) return null;

  let query = `select id from ${USER_TABLES.USER} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getUserID = async (object_id, name) => {
  if (!object_id) return null;

  let query = `select id from ${USER_TABLES.USER} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getUser = async (object_id, name) => {
  let query = `select id, permission_role, client_id from ${USER_TABLES.USER} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getEventID = async (object_id) => {
  if (!object_id) return null;

  let query = `select id from ${EVENT_TABLES.EVENT} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    console.log("Response from RDS:: Event --> ", resp);
    if (resp.length === 0) throw INVALID_REQUEST("Invalid event_id!");

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getEvent = async (object_id, name) => {
  let query = `select id, client_id from ${EVENT_TABLES.EVENT} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getIncidentID = async (object_id, name) => {
  let query = `SELECT inc.id as id from ${INCIDENT_TABLES.INCIDENT} as inc where inc.object_id = '${object_id}' AND NOT inc.deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getLastIncidentMessageID = async (incident_id_int, name) => {
  let query = `SELECT message.id as id, message.object_id as object_id
        FROM ${INCIDENT_TABLES.INCIDENT_MESSAGE} as message
        WHERE message.incident_id = ${incident_id_int}
        ORDER BY message.id desc limit 1;`;

  console.log("Last incident message Query::", query);

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`no message existed!`);

    return [resp[0].id, resp[0].object_id];
  } catch (error) {
    handleErrors(error);
  }
};

module.exports.getEventCheckID = async (object_id, name) => {
  if (!object_id) return null;

  let query = `select id from ${EVENT_TABLES.EVENT_CHECK} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
};
