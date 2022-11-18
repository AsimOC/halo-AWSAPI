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
  getEventCheckID,
} = require("../../utils/validatorQueries");
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

const schema = SCHEMAS.PUBLIC;

async function checkAndInsertUser(usersAsString, eventId) {

  // first remove all old relations with users of current group
  let deleteUserRelationQuery = `DELETE FROM ${schema}.${TABLES.EVENT_USERS} WHERE ${TABLES.EVENT_USERS}.event_id = '${eventId}';`;
  await pgDb.any(deleteUserRelationQuery);

  let isUsers = usersAsString && usersAsString.length > 0;
  if (!isUsers) return;

  let users = usersAsString.split(",");

  for (let user of users) {
    let user_id = await getUserID(user, "user_id");

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

//  Event
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
    created_by_id = await getUserID(created_by_id, "created_by_id");

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
    updated_by_id = await getUserID(updated_by_id, "updated_by_id");
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
  let deleted_by_id = await getUserID(args.deleted_by_id, "deleted_by_id");

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

//  EventCheck
async function createEventCheck(root, args) {
  // Required fields - same as defined in database
  let eventCheck = {
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    occurs_at: args.occurs_at,
    notified_user_of_availability: args.notified_user_of_availability || false,
    status: args.status || "pending",
    deleted_by_id: null,
    created_by_id: args.created_by_id,
    event_id: args.event_id,
    imported: args.imported || false,
  };

  let adminCheck = {
    deleted_on: null,
    event_type: args.event_type || TYPE_CHOICES['event'],
    title: args.title,
    object_id: uid(20),
    description: args.description || '',
    zones: args.zones || [],
    image: args.image || '',
    start_at: args.start_at,
    start_at_time: args.start_at_time,
    recurring_end_at: args.recurring_end_at || null,
    recurring_end_at_time: args.recurring_end_at_time || null,
    recurring_period: args.recurring_period || RECURRING_CHECK_CHOICES.never,
  }


  const insertQuery = {
    text: `INSERT INTO ${TABLES.EVENT_ADMIN_CHECK}
      (deleted, created_at, updated_at, object_id, event_type, title, description, zones, image, start_at,
      start_at_time, recurring_period, event_id, created_by_id, updated_by_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
      SELECT id FROM ${TABLES.EVENT_ADMIN_CHECK} where object_id = $4`,
    values: [
      eventCheck.deleted, eventCheck.created_at, eventCheck.updated_at, adminCheck.object_id,
      adminCheck.event_type, adminCheck.title, adminCheck.description, adminCheck.zones,
      adminCheck.image, adminCheck.start_at, adminCheck.start_at_time, adminCheck.recurring_period,
      eventCheck.event_id, eventCheck.created_by_id, eventCheck.updated_by_id
    ],
  };

  let adminRes = await pgDb.any(insertQuery);

  console.log('admin return', adminRes)
  eventCheck.admin_check_id = adminRes[0].id

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
  let userID = await getUserID(args.loggedInUserId, "loggedInUserId");
  let eventCheckId = await getEventCheckID(
    args.event_check_id,
    "event_check_id"
  );

  let attachment = args.attachment;
  if (attachment) {
    const [type, format] = getMetaDataFromBase64File(attachment);
    if (
      !type.includes("image") &&
      format !== "txt" &&
      format !== "xlsx" &&
      format !== "docx" &&
      format !== "doc" &&
      format !== "pdf" &&
      format !== "csv"
    )
      throw INVALID_REQUEST(
        "file must be an image or pdf or text or csv or word or excel file!"
      );

    const file = generateFileFromBase64(attachment, type);

    let uploadTo = "attachments/";
    let name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::", name);

    await uploadFile(name, file);

    attachment = name;
  }

  // Required fields - same as defined in database
  let eventCheckMessage = {
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    attachment: attachment,
    message: args.message,
    sent_at: new Date().toISOString(),
    event_check_id: eventCheckId,
    user_id: userID,
    created_by_id: userID,
    updated_by_id: userID,
    imported: args.imported || false,
  };

  console.log("createEventCheckMessage -->", eventCheckMessage);

  const insertReadBy = async (messageID) => {
    let checkMsgReadBy = {
      message_id: messageID,
      user_id: userID,
      viewed_at: new Date().toISOString(),
    };

    console.log("createCheckMessageReadBy -->", checkMsgReadBy);
    const [fields, values] = getFieldsAndValues(checkMsgReadBy);

    const createReadyBy = `INSERT INTO ${schema}.${TABLES.EVENT_CHECK_MESSAGE_VIEW} (${fields})
                                                      VALUES (${values}) RETURNING id;`;

    try {
      let [createRes] = await pgDb.any(createReadyBy);
      console.log("Row created checkMsgReadBy::", createRes);
    } catch (ex) {
      console.log("Error checkMsgReadBy:::", ex);
    }
  };

  const [fields, values] = getFieldsAndValues(eventCheckMessage);

  const create = `INSERT INTO ${schema}.${TABLES.EVENT_CHECK_MESSAGE} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING *;`;

  console.log("createEventCheckMessage Mutation:::", create);
  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    await insertReadBy(createRes.id);

    let resp = await pgDb.any(
      queries.getEventCheckMessageQuery(createRes.object_id)
    );
    console.log("Response from RDS --> ", resp);

    resp = resp[0];
    let result = response({
      result: resp,
      main_object_name: "eventcheckmessage",
      others: args,
    });

    const eventCheck = result.item.event_check;
    let adminCheckTitle = "";

    try {
      let adminCheckRes = await pgDb.any(
        `select title from event_admincheck where id = ${eventCheck.admin_check_id}`
      );

      if (adminCheckRes.length > 0) adminCheckTitle = adminCheckRes[0].title;
    } catch (error) {
      console.log("Error while getting admin title");
    }

    notificationSend({
      type: notificationTypes.EVENT_CHECK_MESSAGE,
      object: eventCheck,
      current_user_id: result.item.user_id,
      message: `New update on check ${adminCheckTitle}`,
      include_log: false,
      trigger: triggers.EVENT_CHECK_MESSAGE_ADDED,
      triage: false,
      category: "BOTH",
    });

    return result;
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function updateEventCheckMessage(root, args) {
  let userID = await getUserID(args.loggedInUserId, "loggedInUserId");

  let eventCheckMessage = {
    updated_at: new Date().toISOString(),
    updated_by_id: userID,
  };

  // Required fields - same as defined in database
  switch (args.mode) {
    case "DELETE": {
      eventCheckMessage = {
        deleted: true,
        deleted_on: new Date().toISOString(),
        deleted_by_id: userID,
      };
      break;
    }

    case "OTHER": {
      throw INVALID_REQUEST("mode 'OTHER' not working at this moment!");
    }

    default:
      throw INVALID_REQUEST("Invalid mode!");
  }

  console.log(`updateEventCheckMessage --> ${eventCheckMessage}`);

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(eventCheckMessage);

  const update = `UPDATE ${schema}.${TABLES.EVENT_CHECK_MESSAGE} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.EVENT_CHECK_MESSAGE}.object_id = '${args.id}'  
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
