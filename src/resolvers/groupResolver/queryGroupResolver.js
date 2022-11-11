"use strict";

const { pgConnection } = require("../../db/pgConnection");
const { USER_TABLES, SCHEMAS } = require("../../db/tables");
const queries = require("../../queries/groupQueries");
const checkIdValidity = require("../../utils/checkIdValidity");
const handleErrors = require("../../utils/handleErrors");
const {
  NOT_FOUND,
  INVALID_REQUEST,
  PERMISSION_DENIED,
} = require("../../utils/createError");
const response = require("../response");
const {
  isCrestAdmin, getUserObject
} = require("../../utils/validatorQueries");
const pgDb = pgConnection();
const schema = SCHEMAS.PUBLIC;


async function getGroups(root, args) {

  let limit = parseInt(args.limit) || 100 ;
  let offset = parseInt(args.offset) || 0 ;
  let sort = args.sort || "ASC";
  let clientID = null;

  try {
    let isAdmin = await isCrestAdmin(args.loggedInUserId, "loggedInUserId");
    if (!isAdmin) {
      let user = await getUserObject(args.loggedInUserId, "loggedInUserId");
      clientID = user.client_id;
    }

    let query = queries.getGroupsQuery( {limit, offset, sort, clientID });
    let resp = await pgDb.any(query);

    return response({
      result: resp,
      main_object_name: "getGroups",
      others: args,
    });

  } catch (error) {
    handleErrors(error);
  }
}

module.exports = {
  getGroups
};
