const INCIDENT_TABLE_INFO = {
  relations: [
    "archived_by",
    "created_by",
    "deleted_by",
    "event",
    "reported_by",
    "resolved_by",
    "updated_by",
  ],
  others: [
    "triaging_allowed_users",
    "subscribed_users",
    "message_read_list",
    "last_message_created_at",
    "incident_messages",
    "user_views",
  ],
};

const SPECIAL_FIELDS_INFO = ["location"];

module.exports = {
  INCIDENT_TABLE_INFO,
  SPECIAL_FIELDS_INFO,
};
