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

  await checkAndInsertUser(users, group.id);

  // get created group
  let resp = await pgDb.any(queries.getGroupQuery(group.object_id));
  resp = resp[0];
  return response({
    result: resp,
    main_object_name: null,
    others: args,
  });
}

const deleteBatchGroups = async (root, args) => {
  let { deleted_by_id , ids } = args;
  deleted_by_id = await getUserID(deleted_by_id, "deleted_by_id");

  //soft delete
  let group = {
    deleted: true,
    deleted_on: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_by_id: deleted_by_id,
  };

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(group);

  let objectIds = ids.split(",");
  let objectIdsAsString = JSON.stringify(objectIds)
      .replace("[", "(")
      .replace("]", ")")
      .replaceAll('"', "'");

  let deleteQuery = `UPDATE ${schema}.${USER_TABLES.GROUP} 
                  SET  ${updateAbleFieldsAsString} 
                  WHERE ${USER_TABLES.GROUP}.object_id IN ${objectIdsAsString} RETURNING *;`;

  console.log("deleteBatchGroups Mutation:::", deleteQuery);
  try {
    let resp = await pgDb.any(deleteQuery);
    console.log("Deleted Successfully!", resp);

    return response({
      result: resp,
      main_object_name: null,
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

const updateGroup = async (root, args) => {
  let { users, id , name , updated_by_id } = args;
  updated_by_id = await getUserID(updated_by_id, "updated_by_id");

  let updateObject = {
    name : name,
    updated_by_id : updated_by_id,
    updated_at : new Date().toISOString()
  }

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(updateObject);
  let updateQuery = `UPDATE ${schema}.${USER_TABLES.GROUP} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${USER_TABLES.GROUP}.object_id = '${id}' RETURNING *;`;
  let [group] = await pgDb.any(updateQuery);
  await checkAndInsertUser(users, group.id);

  // get updated group
  let resp = await pgDb.any(queries.getGroupQuery(group.object_id));
  resp = resp[0];

  return response({
    result: resp,
    main_object_name: null,
    others: args,
  });
}


async function checkAndInsertUser(usersAsString, groupId) {

    // first remove all old relations with users of current group
    let deleteUserRelationQuery = `DELETE FROM ${schema}.${USER_TABLES.GROUP_USERS} WHERE ${USER_TABLES.GROUP_USERS}.group_id = '${groupId}';`;
    await pgDb.any(deleteUserRelationQuery);

    let isUsers = usersAsString && usersAsString.length > 0;
    if (!isUsers) return;

    let users = usersAsString.split(",");

    for (let user of users) {
      try {
      let user_id = await getUserID(user, "user_id");

      // if not found userId then continue to next loop
      if (!user_id) {
        continue;
      }

      let userObj = {
        user_id: user_id,
        group_id: groupId,
      };

      const [fields, values] = getFieldsAndValues(userObj);
      let q = `INSERT INTO ${schema}.${USER_TABLES.GROUP_USERS} (${fields})
               VALUES (${values})
                 RETURNING id;`;

        let [createRes] = await pgDb.any(q);
        console.log("User relation created::", createRes);
      } catch (error) {
        console.log("error in creating user:::", error);
      }
    }
}

module.exports = {
  createGroup,
  updateGroup,
  deleteBatchGroups
};
