"use strict";

const { pgDb } = require("../../db/pgConnection");
const { INCIDENT_TABLES: TABLES, USER_TABLES } = require("../../db/tables");
const queries = require("../../queries/incidentQueries");
const handleErrors = require("../../utils/handleErrors");
let { INVALID_REQUEST, PERMISSION_DENIED } = require("../../utils/createError");
const { getIncidentID, isCrestAdmin } = require("../../utils/validatorQueries");
const { getRequestedFields } = require("../../utils/requestedFieldsValidators");
const { INCIDENT_TABLE_INFO } = require("../../db/tableRelations");

const response = require("../response");

async function getIncident(root, args, requiredFields) {
  try {
    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested Incident fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({ id: args.id, requiredFields })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp[0]?.data || null,
      others: args,
    });
  } catch (error) {
    console.log("Error while getting incident:::", error);
    handleErrors(ex);
  }
}

async function getIncidents(root, args, requiredFields) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";
  const eventId = args.eventId;

  try {
    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested Incidents fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentsQuery({
        limit,
        offset,
        sort,
        eventId: eventId ? eventId : null,
        requiredFields: requiredFields,
      })
    );

    const { data: incidents } = resp[0];
    console.log("response from RDS --> ", incidents);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: incidents || [],
      others: args,
    });
  } catch (error) {
    console.log("Error while getting getIncidents response:::", error);
    handleErrors(error);
  }
}

async function getClosedIncidents(root, args, requiredFields) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";
  const eventId = args.eventId;

  try {
    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested ClosedIncidents fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentsQuery({
        limit,
        offset,
        sort,
        eventId: eventId ? eventId : null,
        isClosed: true,
        requiredFields,
      })
    );

    const { data: closedIncidents } = resp[0];
    console.log("response from RDS --> ", closedIncidents);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: closedIncidents || [],
      others: args,
    });
  } catch (error) {
    console.log("Error while getting getClosedIncidents response:::", error);
    handleErrors(error);
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
