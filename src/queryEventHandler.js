"use strict";

const {
  getEvent,
  getEvents,
  getStaff,
  getUserEvents,

  getEventCheck,
  getEventChecks,

  getEventCheckMessage,
  getEventCheckMessages,

  getEventCheckMessageView,
  getEventCheckMessageViews,
} = require("./resolvers/eventResolver/queryEventResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "getEvent": {
        result = await getEvent(null, event.arguments);
        break;
      }
      case "getEvents": {
        result = await getEvents(null, event.arguments);
        break;
      }
      case "getUserEvents": {
        result = await getUserEvents(null, event.arguments);
        break;
      }

      case "getEventCheck": {
        result = await getEventCheck(null, event.arguments);
        break;
      }
      case "getEventChecks": {
        result = await getEventChecks(null, event.arguments);
        break;
      }

      case "getEventCheckMessage": {
        result = await getEventCheckMessage(null, event.arguments);
        break;
      }
      case "getEventCheckMessages": {
        result = await getEventCheckMessages(null, event.arguments);
        break;
      }

      case "getEventCheckMessageView": {
        result = await getEventCheckMessageView(null, event.arguments);
        break;
      }
      case "getEventCheckMessageViews": {
        result = await getEventCheckMessageViews(null, event.arguments);
        break;
      }
      case "getStaffsByEvent": {
        result = await getStaff(null, event.arguments);
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
