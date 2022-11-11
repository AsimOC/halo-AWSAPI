"use strict";

const { pgConnection } = require("../../db/pgConnection");
const {
  EVENT_TABLES: TABLES,
  USER_TABLES,
  SCHEMAS,
} = require("../../db/tables");
const checkIdValidity = require("../../utils/checkIdValidity");
const handleErrors = require("../../utils/handleErrors");
const {
  NOT_FOUND,
  INVALID_REQUEST,
  PERMISSION_DENIED,
} = require("../../utils/createError");
const queries = require("../../queries/eventQueries");
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

const pgDb = pgConnection();
const schema = SCHEMAS.PUBLIC;

async function getClientId(object_id) {
  let query = `select id from ${USER_TABLES.CLIENT} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    console.log("Response from RDS:: Client --> ", resp);
    if (resp.length === 0) throw new Error("Invalid client_id!");

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
}

async function getUser(object_id, name) {
  let query = `select id, permission_role, client_id from ${USER_TABLES.USER} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
}

async function getEvent(object_id, name) {
  let query = `select id, client_id from ${TABLES.EVENT} where object_id = '${object_id}' AND NOT deleted`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0];
  } catch (error) {
    handleErrors(error);
  }
}

async function getUserId(object_id, name) {
  let query = `select id from ${USER_TABLES.USER} where object_id = '${object_id}'`;

  try {
    let resp = await pgDb.any(query);
    if (resp.length === 0) throw INVALID_REQUEST(`Invalid ${name}!`);

    return resp[0].id;
  } catch (error) {
    handleErrors(error);
  }
}

async function checkAndInsertUser(usersAsString, eventId) {
  let isUsers = usersAsString && usersAsString.length > 0;
  if (!isUsers) return;

  let users = usersAsString.split(",");

  for (let user of users) {
    let user_id = await getUserId(user, "user_id");

    let userObj = {
      user_id: user_id,
      event_id: eventId,
    };

    const [fields, values] = getFieldsAndValues(userObj);

    const createUser = `INSERT INTO ${schema}.${TABLES.EVENT_USERS} (${fields})
                                      VALUES (${values}) 
                                      RETURNING id;`;

    try {
      let [createRes] = await pgDb.any(createUser);
      console.log("User created::", createRes);
    } catch (error) {
      console.log("error in creating user:::", error);
    }
  }
}

async function createEvent(root, args) {
  // Required fields - same as defined in database

  let zones = "{}";
  if (args.zones && args.zones.length > 0) {
    zones = args.zones.split(",");
    zones = JSON.stringify(zones);
    zones = zones.replace("[", "{").replace("]", "}");
  }
  let client_id = await getClientId(args.client_id);

  let created_by_id = args.created_by_id;
  if (created_by_id)
    created_by_id = await getUserId(created_by_id, "created_by_id");

  let brief_file = args.brief_file;
  if (brief_file) {
    const [type, format] = getMetaDataFromBase64File(brief_file);
    if (!type.includes("application"))
      throw INVALID_REQUEST("file must be a pdf/doc/docx");

    const file = generateFileFromBase64(brief_file, type);

    const uploadTo = "brief_files/";
    const name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::brief_file:::", name);

    await uploadFile(name, file);

    brief_file = name;
  }

  let custom_logo_file = args.custom_logo_file;
  if (custom_logo_file) {
    const [type, format] = getMetaDataFromBase64File(custom_logo_file);
    if (!type.includes("image")) throw INVALID_REQUEST("file must be an image");

    const file = generateFileFromBase64(custom_logo_file, type);

    const uploadTo = "event_logos/";
    const name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::custom_logo_file:::", name);

    await uploadFile(name, file);

    custom_logo_file = name;
  }

  let event = {
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    title: args.title,
    overview: args.overview || "",
    start_date: args.start_date,
    end_date: args.end_date,
    event_pin: args.event_pin || "0000",
    event_code: args.event_code || "N/A",
    closed: false,
    import_performance_id: args.import_performance_id || "",
    brief_file: brief_file,
    custom_logo_file: custom_logo_file,
    venue_name: args.venue_name || "",
    venue_address: args.venue_address || "",
    capacity_counter: args.capacity_counter || 0,
    capacity_total: args.capacity_total,
    zones: zones,
    client_id: client_id,
    controlled_by_id: args.controlled_by_id,
    created_by_id: created_by_id,
    public_report: args.public_report || false,
    imported: args.imported || false,
  };
  console.log(`createEvent --> ${event}`);

  const [fields, values] = getFieldsAndValues(event);

  const create = `INSERT INTO ${schema}.${TABLES.EVENT} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING *;`;

  console.log("Create Event Mutation:::", create);

  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    await checkAndInsertUser(args.users, createRes.id);

    let resp = await pgDb.any(
      queries.getEventQuery({ id: createRes.object_id })
    );
    console.log("Response from RDS --> ", resp);

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
async function updateEvent(root, args) {
  // checkIdValidity(args.id);

  let zones;
  if (args.zones && args.zones.length > 0) {
    zones = args.zones.split(",");
    zones = JSON.stringify(zones);
    zones = zones.replace("[", "{").replace("]", "}");
  }

  let client_id = args.client_id;
  if (client_id) {
    client_id = await getClientId(client_id);
  }

  let updated_by_id = args.updated_by_id;
  if (updated_by_id) {
    updated_by_id = await getUserId(updated_by_id, "updated_by_id");
  }

  let brief_file = args.brief_file;
  if (brief_file) {
    const [type, format] = getMetaDataFromBase64File(brief_file);
    if (!type.includes("application"))
      throw INVALID_REQUEST("file must be a pdf/doc/docx");

    const file = generateFileFromBase64(brief_file, type);

    const uploadTo = "brief_files/";
    const name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::brief_file:::", name);

    await uploadFile(name, file);

    brief_file = name;
  }

  let custom_logo_file = args.custom_logo_file;
  if (custom_logo_file) {
    const [type, format] = getMetaDataFromBase64File(custom_logo_file);
    if (!type.includes("image")) throw INVALID_REQUEST("file must be an image");

    const file = generateFileFromBase64(custom_logo_file, type);

    const uploadTo = "event_logos/";
    const name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::custom_logo_file:::", name);

    await uploadFile(name, file);

    custom_logo_file = name;
  }

  // Required fields - same as defined in database
  const event = {
    updated_at: new Date().toISOString(),
    title: args.title,
    overview: args.overview,
    start_date: args.start_date,
    end_date: args.end_date,
    event_pin: args.event_pin,
    event_code: args.event_code,
    import_performance_id: args.import_performance_id,
    brief_file: brief_file,
    custom_logo_file: custom_logo_file,
    closed: args.closed,
    venue_name: args.venue_name,
    venue_address: args.venue_address,
    capacity_counter: args.capacity_counter,
    capacity_total: args.capacity_total,
    zones: zones,
    client_id: client_id,
    controlled_by_id: args.controlled_by_id,
    updated_by_id: updated_by_id,
    public_report: args.public_report,
    imported: args.imported,
  };
  console.log(`updateEvent --> ${event}`);

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(event);

  const update = `UPDATE ${schema}.${TABLES.EVENT} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT}.object_id = '${args.id}'  
                  RETURNING *;`;

  console.log("updateEvent Mutation:::", update);

  try {
    let [data] = await pgDb.any(update);
    console.log("Updated Successfully!");

    await checkAndInsertUser(args.users, data.id);

    let resp = await pgDb.any(queries.getEventQuery({ id: args.id }));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) throw new Error("id doesn't exist!");

    resp = resp[0];
    let result = response({
      result: resp,
      main_object_name: "event",
      others: args,
    });

    if (event.closed) {
      notificationSend({
        type: notificationTypes.EVENT,
        object: result.item,
        trigger: triggers.EVENT_CLOSED,
        triage: false,
        category: "SILENT",
      });
    } else if (event.capacity_total) {
      notificationSend({
        type: notificationTypes.EVENT,
        object: result.item,
        trigger: triggers.CAPACITY_UPDATED,
        triage: false,
        category: "SILENT",
      });
    }

    return result;
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function deleteBatchEvents(root, args) {
  let deleted_by_id = await getUserId(args.deleted_by_id, "deleted_by_id");

  //soft delete
  let event = {
    deleted: true,
    deleted_on: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_by_id: deleted_by_id,
  };
  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(event);

  let objectIds = args.ids.split(",");
  let objectIdsAsString = JSON.stringify(objectIds)
    .replace("[", "(")
    .replace("]", ")")
    .replaceAll('"', "'");

  let deleteQuery = `UPDATE ${schema}.${TABLES.EVENT} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT}.object_id IN ${objectIdsAsString} RETURNING *;`;

  console.log("deleteBatchEvents Mutation:::", deleteQuery);
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

async function createUserEventBook(root, args) {
  let user = await getUser(args.user_id, "user_id");
  let event = await getEvent(args.event_id, "event_id");

  const isCrestAdmin = user.permission_role === "CrestAdmin";

  if (!isCrestAdmin && event.client_id !== user.client_id)
    throw PERMISSION_DENIED();

  let updateQuery;
  switch (args.mode) {
    case "BOOK_ON": {
      updateQuery = `UPDATE ${schema}.${USER_TABLES.USER} 
                  SET current_event_id = ${event.id}
                  WHERE ${USER_TABLES.USER}.id = ${user.id} RETURNING id;`;
      break;
    }

    case "BOOK_OFF": {
      updateQuery = `UPDATE ${schema}.${USER_TABLES.USER} 
                  SET current_event_id = NULL
                  WHERE ${USER_TABLES.USER}.id = ${user.id} RETURNING id;`;
      break;
    }

    default:
      throw INVALID_REQUEST(`${args.mode} is not a valid mode!`);
  }

  try {
    let [updateRes] = await pgDb.any(updateQuery);
    console.log("Row updated::", updateRes);

    let resp = await pgDb.any(getUserQuery(updateRes.id));
    console.log("Response from RDS :::", resp);

    return response({
      result: resp[0],
      main_object_name: "user",
      others: args,
    });
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function createEventCheck(root, args) {
  // Required fields - same as defined in database
  let eventCheck = {
    deleted: args.deleted || false,
    deleted_on: args.deleted_on,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    occurs_at: args.occurs_at,
    notified_user_of_availability: args.notified_user_of_availability || false,
    status: args.status || "pending",
    completed_location: args.completed_location,
    completed_by_id: args.completed_by_id,
    completed_comment: args.completed_comment,
    completed_at: args.completed_at,
    completed_image: args.completed_image,
    admin_check_id: args.admin_check_id,
    deleted_by_id: args.deleted_by_id,
    created_by_id: args.created_by_id,
    updated_by_id: args.updated_by_id,
    event_id: args.event_id,
    imported: args.imported || false,
  };
  console.log(`createEventCheck --> ${eventCheck}`);

  const [fields, values] = getFieldsAndValues(eventCheck);

  const create = `INSERT INTO ${schema}.${TABLES.EVENT_CHECK} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING id;`;

  console.log("createEventCheck Mutation:::", create);
  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    let resp = await pgDb.any(queries.getEventCheckQuery(createRes.id));
    console.log("Response from RDS --> ", resp);

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
async function updateEventCheck(root, args) {
  checkIdValidity(args.id);

  // Required fields - same as defined in database
  const eventCheck = {
    deleted: args.deleted,
    deleted_on: args.deleted_on,
    updated_at: new Date().toISOString(),
    object_id: args.object_id,
    occurs_at: args.occurs_at,
    notified_user_of_availability: args.notified_user_of_availability,
    status: args.status,
    completed_location: args.completed_location,
    completed_by_id: args.completed_by_id,
    completed_comment: args.completed_comment,
    completed_at: args.completed_at,
    completed_image: args.completed_image,
    admin_check_id: args.admin_check_id,
    deleted_by_id: args.deleted_by_id,
    created_by_id: args.created_by_id,
    updated_by_id: args.updated_by_id,
    event_id: args.event_id,
    imported: args.imported,
  };
  console.log(`updateEventCheck --> ${eventCheck}`);

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(eventCheck);

  const update = `UPDATE ${schema}.${TABLES.EVENT_CHECK} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT_CHECK}.id = ${args.id}  
                  RETURNING id;`;

  console.log("updateEventCheck Mutation:::", update);
  try {
    await pgDb.any(update);
    console.log("Updated Successfully!");

    let resp = await pgDb.any(queries.getEventCheckQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) throw new Error("id doesn't exist!");

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

async function createEventCheckMessage(root, args) {
  // Required fields - same as defined in database
  let eventCheckMessage = {
    deleted: args.deleted || false,
    deleted_on: args.deleted_on,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    attachment: args.attachment,
    message: args.message,
    sent_at: new Date().toISOString(),
    deleted_by_id: args.deleted_by_id,
    event_check_id: args.event_check_id,
    user_id: args.user_id,
    created_by_id: args.created_by_id,
    updated_by_id: args.updated_by_id,
    imported: args.imported || false,
  };
  console.log(`createEventCheckMessage --> ${eventCheckMessage}`);

  const [fields, values] = getFieldsAndValues(eventCheckMessage);

  const create = `INSERT INTO ${schema}.${TABLES.EVENT_CHECK_MESSAGE} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING id;`;

  console.log("createEventCheckMessage Mutation:::", create);
  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    let resp = await pgDb.any(queries.getEventCheckMessageQuery(createRes.id));
    console.log("Response from RDS --> ", resp);

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
async function updateEventCheckMessage(root, args) {
  checkIdValidity(args.id);

  // Required fields - same as defined in database
  const eventCheckMessage = {
    deleted: args.deleted,
    deleted_on: args.deleted_on,
    updated_at: new Date().toISOString(),
    object_id: args.object_id,
    attachment: args.attachment,
    message: args.message,
    sent_at: new Date().toISOString(),
    deleted_by_id: args.deleted_by_id,
    event_check_id: args.event_check_id,
    user_id: args.user_id,
    created_by_id: args.created_by_id,
    updated_by_id: args.updated_by_id,
    imported: args.imported,
  };
  console.log(`updateEventCheckMessage --> ${eventCheckMessage}`);

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(eventCheckMessage);

  const update = `UPDATE ${schema}.${TABLES.EVENT_CHECK_MESSAGE} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT_CHECK_MESSAGE}.id = ${args.id}  
                  RETURNING id;`;

  console.log("updateEventCheckMessage Mutation:::", update);
  try {
    await pgDb.any(update);
    console.log("Updated Successfully!");

    let resp = await pgDb.any(queries.getEventCheckMessageQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) throw new Error("id doesn't exist!");

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

async function createEventCheckMessageView(root, args) {
  // Required fields - same as defined in database
  let eventCheckMessageView = {
    viewed_at: new Date().toISOString(),
    message_id: args.message_id,
    user_id: args.user_id,
  };
  console.log("createEventCheckMessage:::", eventCheckMessageView);

  const [fields, values] = getFieldsAndValues(eventCheckMessageView);

  const create = `INSERT INTO ${schema}.${TABLES.EVENT_CHECK_MESSAGE_VIEW} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING id;`;

  console.log("createEventCheckMessageView Mutation:::", create);
  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    let resp = await pgDb.any(
      queries.getEventCheckMessageViewQuery(createRes.id)
    );
    console.log("Response from RDS --> ", resp);

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
async function updateEventCheckMessageView(root, args) {
  checkIdValidity(args.id);

  // Required fields - same as defined in database
  const eventCheckMessageView = {
    message_id: args.message_id,
    user_id: args.user_id,
  };
  console.log("updateEventCheckMessageView:::", eventCheckMessageView);

  let updateAbleFields = getUpdateAbleFields(eventCheckMessageView);
  if (updateAbleFields.length === 0) throw new Error("Invalid request!");
  let updateAbleFieldsAsString = updateAbleFields.join(", ");

  const update = `UPDATE ${schema}.${TABLES.EVENT_CHECK_MESSAGE_VIEW} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT_CHECK_MESSAGE_VIEW}.id = ${args.id} 
                  RETURNING id;`;

  console.log("updateEventCheckMessageView Mutation:::", update);
  try {
    await pgDb.any(update);
    console.log("Updated Successfully!");

    let resp = await pgDb.any(queries.getEventCheckMessageViewQuery(args.id));
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) throw new Error("id doesn't exist!");

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

module.exports = {
  createEvent,
  updateEvent,
  deleteBatchEvents,
  createUserEventBook,
  createEventCheck,
  updateEventCheck,
  createEventCheckMessage,
  updateEventCheckMessage,
  createEventCheckMessageView,
  updateEventCheckMessageView,
};
