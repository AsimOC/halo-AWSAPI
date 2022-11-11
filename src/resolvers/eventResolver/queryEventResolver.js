"use strict";

const { pgConnection } = require("../../db/pgConnection");
const { USER_TABLES, SCHEMAS } = require("../../db/tables");
const queries = require("../../queries/eventQueries");
const checkIdValidity = require("../../utils/checkIdValidity");
const handleErrors = require("../../utils/handleErrors");
const {
  NOT_FOUND,
  INVALID_REQUEST,
  PERMISSION_DENIED,
} = require("../../utils/createError");
const response = require("../response");

const pgDb = pgConnection();
const schema = SCHEMAS.PUBLIC;

async function getClientIDAndPermission(user) {
  let clientID;
  let permissionRole;
  let userQuery = `select client_id, permission_role from ${USER_TABLES.USER} where object_id = '${user}'`;
  try {
    let resp = await pgDb.any(userQuery);
    console.log("Response from RDS:: userQuery --> ", resp);
    if (resp.length === 0) throw new Error("Invalid loggedInUserId!");

    clientID = resp[0].client_id;
    permissionRole = resp[0].permission_role;

    return [clientID, permissionRole];
  } catch (error) {
    handleErrors(error);
  }
}

async function checkUserCurrentlyActive(object_id) {
  let query = `
      select usr.id as id
	    from user_user as usr
        LEFT JOIN core_client as client
          ON client.id = usr.client_id
	    where usr.object_id = '${object_id}' AND 
      NOT usr.deleted AND 
      NOT usr.suspended AND 
      usr.client_id IS NOT NULL AND 
      NOT client.deleted AND
      NOT client.suspended`;

  try {
    let resp = await pgDb.any(query);

    if (resp.length === 0) return null;
    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
}

async function getEvent(root, args) {
  // checkIdValidity(args.id);

  try {
    const [clientID, permissionRole] = await getClientIDAndPermission(
      args.loggedInUserId
    );

    const isNotCrestAdmin = permissionRole !== "CrestAdmin";

    let resp = await pgDb.any(
      queries.getEventQuery({
        id: args.id,
        clientID: isNotCrestAdmin ? clientID : null,
      })
    );
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) return response({ result: null, others: args });

    resp = resp[0];

    return response({
      result: resp,
      main_object_name: "event",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEvents(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    const [clientID, permissionRole] = await getClientIDAndPermission(
      args.loggedInUserId
    );
    const isNotCrestAdmin = permissionRole !== "CrestAdmin";

    let resp = await pgDb.any(
      queries.getEventsQuery({
        limit,
        offset,
        sort,
        clientID: isNotCrestAdmin ? clientID : null,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "event",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getUserEvents(root, args) {
  let activeUser = await checkUserCurrentlyActive(args.loggedInUserId);
  if (!activeUser) throw INVALID_REQUEST(`Invalid loggedInUserId!`);

  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getUserEventsQuery({
        limit,
        offset,
        sort,
        userIntID: activeUser.id,
      })
    );
    console.log("Response from RDS --> ", resp);

    args.limit = limit;
    args.offset = offset;
    return response({
      result: resp,
      main_object_name: "event",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventCheck(root, args) {
  // checkIdValidity(args.id);

  try {
    let resp = await pgDb.any(queries.getEventCheckQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) return response({ result: null, others: args });

    resp = resp[0];

    return response({
      result: resp,
      main_object_name: "eventcheck",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventChecks(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getEventChecksQuery({ limit, offset, sort })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp,
      main_object_name: "eventcheck",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventCheckMessage(root, args) {
  // checkIdValidity(args.id);

  try {
    let resp = await pgDb.any(queries.getEventCheckMessageQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) {
      return response({
        result: null,
        others: args,
      });
    }

    resp = resp[0];
    return response({
      result: resp,
      main_object_name: "eventcheckmessage",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventCheckMessages(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getEventCheckMessagesQuery({ limit, offset, sort })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp,
      main_object_name: "eventcheckmessage",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventCheckMessageView(root, args) {
  // checkIdValidity(args.id);

  try {
    let resp = await pgDb.any(queries.getEventCheckMessageViewQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) {
      return response({
        result: null,
        others: args,
      });
    }

    resp = resp[0];
    return response({
      result: resp,
      main_object_name: "eventcheckmessageview",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function getEventCheckMessageViews(root, args) {
  let limit = parseInt(args.limit) || 100;
  let offset = parseInt(args.offset) || 0;
  let sort = args.sort || "ASC";

  try {
    let resp = await pgDb.any(
      queries.getEventCheckMessageViewsQuery({ limit, offset, sort })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp,
      main_object_name: "eventcheckmessageview",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

module.exports = {
  getEvent,
  getEvents,
  getUserEvents,
  getEventCheck,
  getEventChecks,
  getEventCheckMessage,
  getEventCheckMessages,
  getEventCheckMessageView,
  getEventCheckMessageViews,
};
