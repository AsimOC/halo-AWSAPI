"use strict";

const { pgDb } = require("../../db/pgConnection");
const {
  INCIDENT_TABLES: TABLES,
  EVENT_TABLES,
  USER_TABLES,
  SCHEMAS,
} = require("../../db/tables");
const { getRequestedFields } = require("../../utils/requestedFieldsValidators");
const { INCIDENT_TABLE_INFO } = require("../../db/tableRelations");
const handleErrors = require("../../utils/handleErrors");
const queries = require("../../queries/incidentQueries");
const {
  getIncidentID,
  getEventID,
  getUserID,
  getLastIncidentMessageID,
} = require("../../utils/validatorQueries");
let createError,
  { INVALID_REQUEST, NOT_FOUND } = require("../../utils/createError");

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
  notificationTypes,
  notificationSend,
} = require("../../utils/notificationsHelper");

const response = require("../response");

const { uid } = require("uid");
const uuid = require("uuid");

const schema = SCHEMAS.PUBLIC;

async function createIncident(root, args, requiredFields) {
  if (args.status_value && args.status_value < 0)
    throw INVALID_REQUEST("status_value must be a positive integer value!");

  let created_by_id = await getUserID(args.created_by_id, "created_by_id");
  let event_id = await getEventID(args.event_id);

  const handleFileUpload = async (imageFile, attachmentFile) => {
    let [imageFileType, imageFileFormat] = ["", ""];
    let [attachmentFileType, attachmentFileFormat] = ["", ""];

    // file extention validation
    if (imageFile) {
      [imageFileType, imageFileFormat] = getMetaDataFromBase64File(imageFile);

      if (!imageFileType.includes("image"))
        throw INVALID_REQUEST("photo field must be an image!");
    }
    if (attachmentFile) {
      [attachmentFileType, attachmentFileFormat] =
        getMetaDataFromBase64File(attachmentFile);

      if (attachmentFileFormat !== "pdf")
        throw INVALID_REQUEST("attachment field must be a pdf!");
    }
    // ---------------------------------------------------

    // upload files
    const uploadTo = "incidents/";
    const fileName = uuid.v1();

    if (imageFile) {
      imageFile = generateFileFromBase64(imageFile, imageFileType);

      const imageName = `${uploadTo}${fileName}.${imageFileFormat}`;
      await uploadFile(imageName, imageFile);
      imageFile = imageName;
    }

    if (attachmentFile) {
      attachmentFile = generateFileFromBase64(
        attachmentFile,
        attachmentFileType
      );

      const attachmentName = `${uploadTo}${fileName}.${attachmentFileFormat}`;
      await uploadFile(attachmentName, attachmentFile);
      attachmentFile = attachmentName;
    }

    return [imageFile, attachmentFile];
  };

  const genCaptureDataAndFile = (capture_data) => {
    if (!capture_data) return ["{}", null, null];
    let imageFile;
    let attachmentFile;

    try {
      if (capture_data.photo) {
        imageFile = capture_data.photo;
        delete capture_data.photo;
      }
      if (capture_data.attachment) {
        attachmentFile = capture_data.attachment;
        delete capture_data.attachment;
      }

      return [JSON.stringify(capture_data), imageFile, attachmentFile];
    } catch (error) {
      console.log("Error there:::", error);
      throw INVALID_REQUEST("capture_data must be a json object!");
    }
  };

  let [capture_data, imageFile, attachmentFile] = genCaptureDataAndFile(
    args.capture_data
  );

  [imageFile, attachmentFile] = await handleFileUpload(
    imageFile,
    attachmentFile
  );

  const genIncidentCode = () => {
    let left = uid(8).toUpperCase();
    let right = new Date().toLocaleDateString().replaceAll("/", "");

    return left + "-" + right;
  };

  const genTags = (tags) => {
    if (!tags) return "{}";

    tags = tags.split(",");
    tags = JSON.stringify(tags);
    tags = tags.replace("[", "{").replace("]", "}");

    return tags;
  };

  let incident = {
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    object_id: args.object_id || uid(20),
    location: args.location,
    status_value: args.status_value,
    capture_data: capture_data,
    img_file: imageFile,
    attachment: attachmentFile,
    tags: genTags(args.tags),
    incident_code: genIncidentCode(),
    type_value: args.type_value,
    triaged: args.triaged || false,
    debrief: args.debrief || false,
    resolved: false,
    archived: false,
    event_id: event_id,
    reported_by_id: created_by_id,
    updated_by_id: created_by_id,
    created_by_id: created_by_id,
    imported: args.imported || false,
  };
  console.log("createIncident -->", incident);

  const [fields, values] = getFieldsAndValues(incident);

  const create = `INSERT INTO ${schema}.${TABLES.INCIDENT} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING id;`;

  console.log("Create Incident Mutation:::", create);
  try {
    let [createRes] = await pgDb.any(create);
    console.log("Row created::", createRes);

    // add the reported to the subscribed list
    let subscribed = {
      incident_id: createRes.id,
      user_id: created_by_id,
    };
    const [subscribedFields, subscribedValues] = getFieldsAndValues(subscribed);

    try {
      const createSubscribed = `INSERT INTO ${schema}.${TABLES.SUBSCRIBED_USERS} (${subscribedFields})
                                                      VALUES (${subscribedValues});`;
      await pgDb.any(createSubscribed);
      console.log("subscribed created");
    } catch (error) {
      console.log("Error while creating subscribed:::", error);
    }
    // ------------------------------------------------------- //

    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested createIncident fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({ id: createRes.id, requiredFields })
    );
    console.log("Response from RDS --> ", resp);

    let result = response({
      result: resp[0]?.data,
      others: args,
    });

    notificationSend({
      type: notificationTypes.INCIDENT,
      object: result.item,
      current_user_id: result.item.reported_by_id,
      message: `A new ${result.item.type_value} incident (${result.item.incident_code}) has been created.`,
      include_log: false,
      trigger: triggers.INCIDENT_ADDED,
      triage: false,
      category: "BOTH",
    });

    return result;
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function updateIncident(root, args, requiredFields) {
  let userID = await getUserID(args.loggedInUserId, "loggedInUserId");

  let incident;
  switch (args.mode) {
    case "RESOLVE": {
      let resolved_image = args.resolved_image;

      if (resolved_image) {
        const [type, format] = getMetaDataFromBase64File(resolved_image);
        if (!type.includes("image"))
          throw INVALID_REQUEST("file must be an image!");

        const file = generateFileFromBase64(resolved_image, type);

        let uploadTo = "resolved_incidents/";
        let name = `${uploadTo}${uuid.v1()}.${format}`;

        console.log("file name:::", name);

        await uploadFile(name, file);

        resolved_image = name;
      }

      incident = {
        resolved: true,
        resolved_text: args.resolved_text,
        resolved_image: resolved_image,
        resolved_date: new Date().toISOString(),
        resolved_by_id: userID,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;
    }

    case "UNRESOLVE":
      incident = {
        resolved: false,
        resolved_text: null,
        resolved_image: null,
        resolved_date: null,
        resolved_by_id: null,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;

    case "CLOSE":
      incident = {
        archived: true,
        debrief: args.debrief || false,
        archived_text: args.archived_text,
        archived_date: new Date().toISOString(),
        archived_by_id: userID,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;

    case "REOPEN":
      incident = {
        archived: false,
        debrief: false,
        archived_text: null,
        archived_date: null,
        archived_by_id: null,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;

    case "DELETE":
      incident = {
        deleted: true,
        deleted_on: new Date().toISOString(),
        deleted_by_id: userID,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;

    case "OTHER": {
      const genCaptureData = (capture_data) => {
        if (!capture_data) return [null, null];

        let img_file;
        try {
          if (capture_data.photo) {
            img_file = capture_data.photo;
            delete capture_data.photo;
          }

          return [JSON.stringify(capture_data), img_file];
        } catch (error) {
          throw INVALID_REQUEST("capture_data must be a json object!");
        }
      };

      const genTags = (tags) => {
        if (!tags) return null;

        tags = tags.split(",");
        tags = JSON.stringify(tags);
        tags = tags.replace("[", "{").replace("]", "}");

        return tags;
      };

      let [capture_data, img_file] = genCaptureData(args.capture_data);

      if (img_file) {
        const [type, format] = getMetaDataFromBase64File(img_file);
        if (!type.includes("image"))
          throw INVALID_REQUEST("file must be an image!");

        const file = generateFileFromBase64(img_file, type);

        let uploadTo = "incidents/";
        let name = `${uploadTo}${uuid.v1()}.${format}`;

        console.log("file name:::", name);

        await uploadFile(name, file);

        img_file = name;
      }

      incident = {
        location: args.location,
        status_value: args.status_value,
        img_file: img_file,
        tags: genTags(args.tags),
        type_value: args.type_value,
        capture_data: capture_data,
        triaged: args.triaged,
        updated_by_id: userID,
        updated_at: new Date().toISOString(),
      };
      break;
    }

    default:
      throw INVALID_REQUEST("Invalid mode!");
  }

  console.log("updateIncident -->", incident);

  let updateAbleFieldsAsString = getUpdateAbleFieldsAsString(
    incident,
    args.mode === "UNRESOLVE" || args.mode === "REOPEN"
  );

  const update = `UPDATE ${schema}.${TABLES.INCIDENT} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.INCIDENT}.object_id = '${args.id}'  
                  RETURNING id;`;

  console.log("updateIncident Mutation:::", update);

  try {
    let [updateRes] = await pgDb.any(update);
    console.log("Updated Successfully::", updateRes);

    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested updateIncident fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({
        id: updateRes.id,
        excludeDeleted: false,
        requiredFields,
      })
    );
    console.log("Response from RDS --> ", resp);

    if (resp.length === 0) throw NOT_FOUND("id doesn't exist!");

    let result = response({
      result: resp[0]?.data,
      others: args,
    });

    let notificationParams = {
      type: notificationTypes.INCIDENT,
      object: result.item,
      current_user_id: result.item.updated_by_id,
      include_log: false,
      triage: false,
      category: "BOTH",
    };

    switch (args.mode) {
      case "RESOLVE": {
        notificationParams.message = `Incident ${result.item.type_value}-${result.item.incident_code} has been resolved.`;
        notificationParams.trigger = triggers.INCIDENT_RESOLVED;
        break;
      }

      case "UNRESOLVE": {
        notificationParams.message = `Incident ${result.item.type_value}-${result.item.incident_code} is still unresolved.`;
        notificationParams.trigger = triggers.INCIDENT_UNRESOLVED;

        break;
      }

      case "CLOSE": {
        notificationParams.message = `Incident ${result.item.type_value}-${result.item.incident_code} has been closed.`;
        notificationParams.trigger = triggers.INCIDENT_CLOSED;

        break;
      }

      case "REOPEN": {
        notificationParams.message = `Incident ${result.item.type_value}-${result.item.incident_code} has been reopened.`;
        notificationParams.trigger = triggers.INCIDENT_REOPENED;

        break;
      }

      case "DELETE":
        break;

      case "OTHER": {
        notificationParams.message = `Incident ${result.item.type_value}-${result.item.incident_code} has been updated.`;
        notificationParams.trigger = triggers.INCIDENT_UPDATED;

        break;
      }

      default:
        break;
    }

    notificationSend(notificationParams);

    return result;
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function shareIncident(root, args, requiredFields) {
  let loggedInUserId = await getUserID(args.loggedInUserId, "loggedInUserId");
  let incidentID = await getIncidentID(args.incident_id, "incident_id");

  let userIDs = args.userIds.split(",");
  let userIdsAsString = JSON.stringify(userIDs)
    .replace("[", "(")
    .replace("]", ")")
    .replaceAll('"', "'");

  const genTags = (tags) => {
    if (!tags) return;

    tags = tags.split(",");
    tags = JSON.stringify(tags);
    tags = tags.replace("[", "{").replace("]", "}");

    return tags;
  };

  let incomingUsers = [];
  let newSubscribedUsers = [];

  let previouslySharedUsers = [];

  //  get the users which we now want to share
  try {
    let query = `SELECT id, object_id from ${USER_TABLES.USER} WHERE object_id in ${userIdsAsString}`;
    console.log("Query for users:::", query);

    incomingUsers = await pgDb.any(query);
    console.log("users data:::", incomingUsers);
  } catch (error) {
    console.log("Error while getting the USERS:::", error);
  }
  // ----------------------------------------------

  // get all the current subscribers who are in the new list
  try {
    let query = `SELECT usr.id as id, usr.object_id as object_id from ${USER_TABLES.USER} as usr
                  JOIN ${TABLES.SUBSCRIBED_USERS} as sub_usr
                    ON sub_usr.user_id = usr.id
                WHERE sub_usr.incident_id = ${incidentID} AND usr.object_id in ${userIdsAsString}`;
    console.log("Query for subscribers:::", query);

    newSubscribedUsers = await pgDb.any(query);
    console.log("subscribers data:::", newSubscribedUsers);
  } catch (error) {
    console.log("Error while getting the subscribers:::", error);
  }
  // -------------------------------------------------

  // get the previously shared users
  try {
    let query = `SELECT id, user_id from ${TABLES.TRIAGING_ALLOWED_USERS}
                WHERE incident_id = ${incidentID}`;
    console.log("Query for previously shared users:::", query);

    previouslySharedUsers = await pgDb.any(query);
    console.log("previousSharedUsers data:::", previouslySharedUsers);
  } catch (error) {
    console.log("Error while getting the previousSharedUsers:::", error);
  }
  // ---------------------------------------------------

  // compare the incoming users with the previously shared users
  let willBeDeleted = previouslySharedUsers.filter(
    ({ user_id: id1 }) => !incomingUsers.some(({ id: id2 }) => id2 === id1)
  );

  let completeNewUsers = incomingUsers.filter(
    ({ id: id1 }) =>
      !previouslySharedUsers.some(({ user_id: id2 }) => id2 === id1)
  );

  console.log("Previous records will be deleted:::", willBeDeleted);
  console.log("New records will be added:::", completeNewUsers);
  // ---------------------------------------------------

  // delete old shared users
  if (willBeDeleted.length > 0) {
    let deleteSharedIds = willBeDeleted.map((item) => item.id);
    let deleteSharedIdsAsString = JSON.stringify(deleteSharedIds)
      .replace("[", "(")
      .replace("]", ")")
      .replaceAll('"', "'");
    let deleteQuery = `DELETE FROM ${TABLES.TRIAGING_ALLOWED_USERS}
                WHERE id in ${deleteSharedIdsAsString};`;

    console.log("Deleting the shared users Query:::", deleteQuery);

    try {
      await pgDb.any(deleteQuery);
      console.log("Deleted Successfully!");
    } catch (error) {
      console.log("Error while deleted the old shared Users:::", error);
    }
  }
  // --------------------------------------------------

  // Insert the newly shared users
  if (completeNewUsers.length > 0) {
    try {
      let values = completeNewUsers.map(
        (user) => `(${incidentID}, ${user.id})`
      );
      let valuesAsString = values.join(",");

      let insertQuery = `INSERT INTO ${TABLES.TRIAGING_ALLOWED_USERS}
                    ( incident_id, user_id )
                    VALUES
                    ${valuesAsString};`;
      console.log("Query for insert the Shared Users:::", insertQuery);

      await pgDb.any(insertQuery);
      console.log("Inserted Successfully!");
    } catch (error) {
      console.log("Error while inserting the Shared Users", error);
    }
  }
  // --------------------------------------------------

  // update the associated incident
  try {
    let tags = genTags(args.tags);
    let updated_by_id = loggedInUserId;

    let updateIncidentFields = {
      updated_by_id,
      tags,
      updated_at: new Date().toISOString(),
    };
    let updateAbleFieldsAsString =
      getUpdateAbleFieldsAsString(updateIncidentFields);
    console.log(
      "Updated fields for shareIncident:::",
      updateAbleFieldsAsString
    );

    const updateIncident = `UPDATE ${schema}.${TABLES.INCIDENT} 
                  SET  ${updateAbleFieldsAsString}
                  WHERE ${TABLES.INCIDENT}.object_id = '${args.incident_id}';`;

    console.log("updateIncident Mutation:::", updateIncident);

    await pgDb.any(updateIncident);
    console.log("Updated Successfully!");
  } catch (error) {
    console.log("Error while sharing the Incident:::", error);
  }
  // ------------------------------------------------

  // get the updated Incident
  let result = null;

  try {
    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested updateIncident fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({
        id: incidentID,
        requiredFields,
      })
    );
    console.log("Response from RDS --> ", resp);

    result = response({
      result: resp[0]?.data,
      others: args,
    });
  } catch (error) {
    console.log("Error while getting updated Incident:::", error);
  }
  // ---------------------------------------------------

  if (!result) {
    return response({
      result: null,
      others: args,
    });
  }

  // send notification
  notificationSend({
    type: notificationTypes.SHARE_INCIDENT,
    object: result.item,
    current_user_id: result.item.updated_by_id,
    message: `A new ${result.item.type_value}-${result.item.incident_code} incident has been shared on ${result.item.event?.title}`,
    include_log: false,
    trigger: triggers.INCIDENT_TRIAGED,
    users_list: completeNewUsers,
    triage: false,
    category: "BOTH",
  });

  return result;
}

async function createIncidentMessage(root, args) {
  let incidentID = await getIncidentID(args.incident_id, "incident_id");
  let userID = await getUserID(args.loggedInUserId, "resolved_by_id");

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

    let uploadTo = "incident_messages/";
    let name = `${uploadTo}${uuid.v1()}.${format}`;

    console.log("file name:::", name);

    await uploadFile(name, file);

    attachment = name;
  }

  let incidentMsg = {
    deleted: false,
    incident_id: incidentID,
    user_id: userID,
    message: args.message,
    attachment: attachment,
    object_id: args.object_id || uid(20),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    created_by_id: userID,
    updated_by_id: userID,
    imported: args.imported || false,
  };

  const insertReadBy = async (messageID) => {
    let incidentMsgReadBy = {
      incidentmessage_id: messageID,
      user_id: userID,
    };

    console.log("createIncidentMessageReadBy -->", incidentMsgReadBy);
    const [fields, values] = getFieldsAndValues(incidentMsgReadBy);

    const createReadyBy = `INSERT INTO ${schema}.${TABLES.INCIDENTMESSAGE_READ_BY} (${fields})
                                                      VALUES (${values}) RETURNING id;`;

    try {
      let [createRes] = await pgDb.any(createReadyBy);
      console.log("Row created incidentMsgReadBy::", createRes);
    } catch (ex) {
      console.log("Error incidentMsgReadBy:::", ex);
    }
  };

  console.log("createIncidentMessage -->", incidentMsg);

  const [fields, values] = getFieldsAndValues(incidentMsg);

  const createMessage = `INSERT INTO ${schema}.${TABLES.INCIDENT_MESSAGE} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING *;`;

  try {
    let [createRes] = await pgDb.any(createMessage);
    console.log("Row created::", createRes);

    await insertReadBy(createRes.id);

    let [resp] = await pgDb.any(
      queries.getIncidentMessageQuery(createRes.object_id)
    );
    console.log("Response from RDS --> ", resp);

    resp = { ...resp };
    if (resp?.event && resp?.incident) {
      resp.incident.event = resp.event;
      delete resp.event;
    }

    let result = response({
      result: resp,
      main_object_name: "incidentmessage",
      others: args,
    });

    notificationSend({
      type: notificationTypes.INCIDENT,
      object: result.item.incident,
      current_user_id: result.item.created_by_id,
      message: `Incident ${result.item.incident?.type_value}-${result.item.incident?.incident_code} has new updates.`,
      include_log: false,
      trigger: triggers.MESSAGE_ADDED,
      triage: false,
      category: "BOTH",
    });

    return result;
  } catch (ex) {
    handleErrors(ex, args);
  }
}

async function createMarkIncidentAsRead(root, args, requiredFields) {
  let userID = await getUserID(args.loggedInUserId, "loggedInUserId");
  let incidentID = await getIncidentID(args.incident_id, "incident_id");

  const alreadyViewedQuery = `SELECT id FROM ${schema}.${TABLES.USER_VIEWS} WHERE user_id = ${userID} AND incident_id = ${incidentID}`;
  console.log("AlreadyViewedQuery Query:::", alreadyViewedQuery);

  try {
    let data = await pgDb.any(alreadyViewedQuery);
    console.log("isAlreadyViewed DB:::", data);

    let isAlreadyViewed = data.length > 0;
    console.log("isAlreadyViewed:::", isAlreadyViewed);

    if (!isAlreadyViewed) {
      let dateTime = new Date().toISOString();
      let userView = {
        object_id: uid(20),
        incident_id: incidentID,
        user_id: userID,
        created_by_id: userID,
        updated_by_id: userID,
        viewed_at: dateTime,
        created_at: dateTime,
        updated_at: dateTime,
      };
      console.log("createMarkIncidentAsRead -->", userView);

      const [fields, values] = getFieldsAndValues(userView);
      const addUserView = `INSERT INTO ${schema}.${TABLES.USER_VIEWS} (${fields})
                                                      VALUES (${values});`;

      await pgDb.any(addUserView);
      console.log("Row created createMarkIncidentAsRead::");
    }

    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({
        id: incidentID,
        excludeDeleted: false,
        requiredFields,
      })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp[0]?.data,
      others: args,
    });
  } catch (ex) {
    console.log("Error createMarkIncidentAsRead:::", ex);
    handleErrors(ex, args);
  }
}

async function createIncidentMessageAsRead(root, args, requiredFields) {
  let userID = await getUserID(args.loggedInUserId, "loggedInUserId");

  let incidentID = await getIncidentID(args.incident_id, "incident_id");
  let [lastIncidentMessageID, messageObjectID] = await getLastIncidentMessageID(
    incidentID
  );

  const alreadyViewedQuery = `SELECT id FROM ${schema}.${TABLES.INCIDENTMESSAGE_READ_BY} WHERE user_id = ${userID} AND incidentmessage_id = ${lastIncidentMessageID}`;
  console.log("AlreadyViewedQuery Query:::", alreadyViewedQuery);

  try {
    let data = await pgDb.any(alreadyViewedQuery);
    console.log("isAlreadyViewed DB:::", data);

    let isAlreadyViewed = data.length > 0;
    console.log("isAlreadyViewed:::", isAlreadyViewed);

    if (!isAlreadyViewed) {
      let userView = {
        incidentmessage_id: lastIncidentMessageID,
        user_id: userID,
      };
      console.log("createIncidentMessageAsRead -->", userView);

      const [fields, values] = getFieldsAndValues(userView);
      const addUserView = `INSERT INTO ${schema}.${TABLES.INCIDENTMESSAGE_READ_BY} (${fields})
                                                      VALUES (${values});`;

      await pgDb.any(addUserView);
      console.log("Row created createIncidentMessageAsRead::");
    }

    requiredFields = getRequestedFields(requiredFields, INCIDENT_TABLE_INFO);
    console.log("The requested fields:::", requiredFields);

    let resp = await pgDb.any(
      queries.generateIncidentQuery({
        id: incidentID,
        requiredFields,
      })
    );
    console.log("Response from RDS --> ", resp);

    return response({
      result: resp[0]?.data,
      others: args,
    });
  } catch (ex) {
    console.log("Error createIncidentMessageAsRead:::", ex);
    handleErrors(ex, args);
  }
}

module.exports = {
  createIncident,
  shareIncident,
  createIncidentMessage,
  updateIncident,
  createMarkIncidentAsRead,
  createIncidentMessageAsRead,
};
