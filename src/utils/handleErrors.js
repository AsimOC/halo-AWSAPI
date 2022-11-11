module.exports = (error, args = {}) => {
  console.log("Error::: ", error);

  let message = error.message;
  switch (true) {
    case message.includes("object_id_key"): {
      error = new Error(`duplicate object_id "${args.object_id}"!`);
      error.name = "INVALID_REQUEST";
      error.code = 400;

      break;
    }

    case message.includes('"event_'): {
      let errorPrefixes = [
        "event_event",
        "event_eventcheckmessageview",
        "event_eventcheckmessage",
        "event_eventcheckmess",
        "event_eventcheck",
      ];

      for (let prefix of errorPrefixes) {
        if (message.includes(`${prefix}_user_id`)) {
          error = new Error(`user_id "${args.user_id}" doesn't exist!`);
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_message_id`)) {
          error = new Error(`message_id "${args.message_id}" doesn't exist!`);
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_created_by_id`)) {
          error = new Error(
            `created_by_id "${args.created_by_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_completed_by_id`)) {
          error = new Error(
            `completed_by_id "${args.completed_by_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_updated_by_id`)) {
          error = new Error(
            `updated_by_id "${args.updated_by_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_deleted_by_id`)) {
          error = new Error(
            `deleted_by_id "${args.deleted_by_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_event_check_id`)) {
          error = new Error(
            `event_check_id "${args.event_check_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_admin_check_id`)) {
          error = new Error(
            `admin_check_id "${args.admin_check_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_event_id`)) {
          error = new Error(`event_id "${args.event_id}" doesn't exist!`);
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }

        if (message.includes(`${prefix}_controlled_by_id`)) {
          error = new Error(
            `controlled_by_id "${args.controlled_by_id}" doesn't exist!`
          );
          error.name = "INVALID_REQUEST";
          error.code = 400;
        }
      }

      break;
    }

    default:
      break;
  }

  throw error;
};
