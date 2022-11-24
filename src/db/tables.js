const SCHEMAS = {
  PUBLIC: "public",
};

const EVENT_TABLES = {
  EVENT: "event_event",
  EVENT_GEO: "event_geofence",
  EVENT_USERS: "event_event_users",
  EVENT_ADMIN_CHECK: "event_admincheck",
  EVENT_CHECK: "event_eventcheck",
  EVENT_CHECK_READ_BY: "event_eventcheck_read_by",
  EVENT_CHECK_USERS: "event_eventcheck_users",
  EVENT_CHECK_MESSAGE: "event_eventcheckmessage",
  EVENT_CHECK_MESSAGE_VIEW: "event_eventcheckmessageview",
  EVENT_ADMIN_CHECK_USERS: "event_admincheck_users"
};

const USER_TABLES = { 
  USER: "user_user", 
  CLIENT: "core_client" , 
  GROUP : "user_group", 
  GROUP_USERS : "user_group_users"
};

const INCIDENT_TABLES = {
  INCIDENT: "incident_incident",
  INCIDENT_MESSAGE: "incident_incidentmessage",
  SUBSCRIBED_USERS: "incident_incident_subscribed_users",
  USER_VIEWS: "incident_incidentuserview",
  TRIAGING_ALLOWED_USERS: "incident_incident_triaging_allowed_users",
  INCIDENTMESSAGE_READ_BY: "incident_incidentmessage_read_by",
};

module.exports = {
  SCHEMAS,
  EVENT_TABLES,
  INCIDENT_TABLES,
  USER_TABLES,
};
