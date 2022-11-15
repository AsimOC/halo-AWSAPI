"use strict";

const { pgDb } = require("../../db/pgConnection");
const { INCIDENT_TABLES: TABLES, USER_TABLES } = require("../../db/tables");
const queries = require("../../queries/incidentQueries");
const handleErrors = require("../../utils/handleErrors");
let { INVALID_REQUEST, PERMISSION_DENIED } = require("../../utils/createError");
const { getIncidentID, isCrestAdmin } = require("../../utils/validatorQueries");

const response = require("../response");

async function getIncident(root, args) {
  try {
    let resp = await pgDb.any(
      queries.getIncidentQuery({
        id: args.id,
      })
    );
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) return response({ result: null, others: args });

    resp = resp[0];

    return response({
      result: resp,
      main_object_name: "incident",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

async function getIncidents(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";
  const eventId = args.eventId;

  try {
    let resp = await pgDb.any(
      queries.getIncidentsQuery({
        limit,
        offset,
        sort,
        eventId: eventId ? eventId : null,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "incident",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

async function getClosedIncidents(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";
  const eventId = args.eventId;

  try {
    let resp = await pgDb.any(
      queries.getIncidentsQuery({
        limit,
        offset,
        sort,
        eventId: eventId ? eventId : null,
        isClosed: true,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "incident",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

async function getIncidentViews(root, args) {
  // let isAdmin = await isCrestAdmin(args.loggedInUserId, "loggedInUserId");
  // if (!isAdmin) throw PERMISSION_DENIED("You don't have permission to access!");

  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getIncidentViewsQuery({
        id: args.id,
        offset,
        limit,
        sort,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "incident_userview",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

async function getIncidentMessages(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getIncidentMessagesQuery({
        incidentId: args.incidentId,
        offset,
        limit,
        sort,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "incidentmessage",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

async function getEventIncidentMessages(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getEventIncidentMessagesQuery({
        eventId: args.eventId,
        offset,
        limit,
        sort,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "incidentmessage",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex);
  }
}

module.exports = {
  getIncident,
  getIncidents,
  getClosedIncidents,
  getIncidentViews,
  getIncidentMessages,
  getEventIncidentMessages,
};
