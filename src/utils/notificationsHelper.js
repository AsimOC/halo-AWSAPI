const axios = require("axios");

const notificationTypes = {
  EVENT_CHECK: "eventCheck",
  EVENT_CHECK_MESSAGE: "eventCheckMessage",
  EVENT: "event",
  INCIDENT: "incident",
  NEW_INCIDENT: "newIncident",
  SHARE_INCIDENT: "shareIncident",
  MESSAGE: "message",
  USER: "user",
  REMOVAL: "removal",
  BANNED: "banned",
  REGULAR: "regular",
  LOCKDOWN: "lockdown",
  EVACUATION: "evacuation",
};

const triggers = {
  CAPACITY_UPDATED: "capacityUpdated",
  BAN_ADDED: "banAdded",
  EVENT_CLOSED: "eventClosed",
  INCIDENT_ADDED: "incidentAdded",
  INCIDENT_RESOLVED: "incidentResolved",
  INCIDENT_UNRESOLVED: "incidentUnresolved",
  INCIDENT_CLOSED: "incidentClosed",
  INCIDENT_REOPENED: "incidentReopened",
  INCIDENT_TRIAGED: "incidentTriaged",
  INCIDENT_UPDATED: "incidentUpdated",
  MESSAGE_ADDED: "messageAdded",
  USER_SUSPENDED: "userSuspended",
  USER_DELETED: "userDeleted",
  CLIENT_SUSPENDED: "clientSuspended",
  EVENT_CHECK_ADDED: "eventCheckAdded",
  EVENT_CHECK_ASSIGNEE_UPDATED: "eventCheckAssigneeUpdated",
  EVENT_CHECK_COMPLETED: "eventCheckCompleted",
  EVENT_CHECK_CLOUD_NOT_COMPLETE: "eventCheckCouldNotComplete",
  EVENT_CHECK_REOPENED: "eventCheckReopened",
  EVENT_CHECK_DELETED: "eventCheckDeleted",
  EVENT_CHECK_BECAME_AVAILABLE: "eventCheckBecameAvailable",
  EVENT_CHECK_MESSAGE_ADDED: "eventCheckMessageAdded",
};

const notificationSend = async ({
  type,
  message,
  object,
  current_user_id,
  include_log,
  users_list,
  extra,
  trigger,
  triage = false,
  category,
}) => {
  if (!object) return;

  try {
    console.log(
      `Sending Async Push Notification::: ${
        process.env.NOTIFICATION_API_ENDPOINT + "/send"
      }.........`
    );

    await axios.post(process.env.NOTIFICATION_API_ENDPOINT + "/send", {
      type,
      message,
      object,
      current_user_id,
      include_log,
      users_list,
      extra,
      trigger,
      triage,
      category,
    });
  } catch (error) {
    console.log("Error while sending notification:::", error);
  }
};

module.exports = {
  notificationTypes,
  triggers,
  notificationSend,
};
