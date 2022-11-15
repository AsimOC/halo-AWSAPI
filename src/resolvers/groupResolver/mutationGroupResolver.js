"use strict";

const { pgDb } = require("../../db/pgConnection");
const {
  EVENT_TABLES: TABLES,
  USER_TABLES,
  SCHEMAS,
} = require("../../db/tables");
const {
  getUser,
  getClientId,
  getUserID,
  getEvent,
  getEventCheckID, getUsers,
} = require("../../utils/validatorQueries");
const handleErrors = require("../../utils/handleErrors");
const {
  NOT_FOUND,
  INVALID_REQUEST,
  PERMISSION_DENIED,
} = require("../../utils/createError");
const queries = require("../../queries/groupQueries");
const { getUserQuery } = require("../../queries/userQueries");

const {
  getFieldsAndValues,
  getUpdateAbleFields,
  getUpdateAbleFieldsAsString,
} = require("../../utils/mutationServices");

const {
  uploadFile,
  getMetaDataFromBase64File,
  generateFileFromBase64,
} = require("../../utils/fileService");

const {
  triggers,
  notificationSend,
  notificationTypes,
} = require("../../utils/notificationsHelper");

const response = require("../response");

const { uid } = require("uid");
const uuid = require("uuid");

const schema = SCHEMAS.PUBLIC;


const createGroup = async (root, args) => {
  const { loggedInUserId , client_id , users , name } = args;

  let authenticateUserID = await getUserID(loggedInUserId, 'object_id');
  let client = await getClientId(client_id);

  let createObject = {
    client_id : client,
    created_by_id : authenticateUserID,
    updated_by_id : authenticateUserID,
    name : name,
    deleted: false,
    object_id : uid(20),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const [fields, values] = getFieldsAndValues(createObject);
  let query = queries.createGroupQuery(fields, values);
  let [group] = await pgDb.any(query);

  if (users.length === 0) {
    return group;
  }

  //get users list by objectIDs
  let usersList = await getUsers(users.join("','"), 'object_ids_list')

  let relationQueryValues = usersList.map(user =>
      `('${user.id}','${group.id}') `
  );

  //attach user relation with group
  let relationQuery = queries.createGroupUserRelationQuery(relationQueryValues);
  await pgDb.any(relationQuery);

  // get created group
  let resp = await pgDb.any(queries.getGroupQuery(group.object_id));
  resp = resp[0];
  return response({
    result: resp,
    main_object_name: "group",
    others: args,
  });
}


module.exports = {
  createGroup,

};
