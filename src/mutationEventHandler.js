"use strict";

const {
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
} = require("./resolvers/eventResolver/mutationEventResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "createEvent": {
        result = await createEvent(null, event.arguments);
        break;
      }
      case "updateEvent": {
        result = await updateEvent(null, event.arguments);
        break;
      }
      case "deleteBatchEvents": {
        result = await deleteBatchEvents(null, event.arguments);
        break;
      }
      case "createUserEventBook": {
        result = await createUserEventBook(null, event.arguments);
        break;
      }

      case "createEventCheck": {
        result = await createEventCheck(null, event.arguments);
        break;
      }
      case "updateEventCheck": {
        result = await updateEventCheck(null, event.arguments);
        break;
      }

      case "createEventCheckMessage": {
        result = await createEventCheckMessage(null, event.arguments);
        break;
      }
      case "updateEventCheckMessage": {
        result = await updateEventCheckMessage(null, event.arguments);
        break;
      }

      case "createEventCheckMessageView": {
        result = await createEventCheckMessageView(null, event.arguments);
        break;
      }
      case "updateEventCheckMessageView": {
        result = await updateEventCheckMessageView(null, event.arguments);
        break;
      }

      default:
        throw `Unknown field, unable to resolve ${event.field}`;
    }
    return result;
  } catch (error) {
    console.log("Lambda error:", error);
    return Promise.reject(error);
  }
};
