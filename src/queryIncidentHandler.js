"use strict";

const {
  getIncident,
  getIncidents,
  getClosedIncidents,
  getIncidentViews,
  getIncidentMessages,
  getEventIncidentMessages,
} = require("./resolvers/incidentResolver/queryIncidentResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "getIncident": {
        result = await getIncident(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "getIncidents": {
        result = await getIncidents(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "getClosedIncidents": {
        result = await getClosedIncidents(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "getIncidentViews": {
        result = await getIncidentViews(null, event.arguments);
        break;
      }
      case "getEventIncidentMessages": {
        result = await getEventIncidentMessages(null, event.arguments);
        break;
      }
      case "getIncidentMessages": {
        result = await getIncidentMessages(null, event.arguments);
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
