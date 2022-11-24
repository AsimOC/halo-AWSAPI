"use strict";

const {
  createIncident,
  createIncidentMessage,
  updateIncident,
  shareIncident,
  createMarkIncidentAsRead,
  createIncidentMessageAsRead,
} = require("./resolvers/incidentResolver/mutationIncidentResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "createIncident": {
        result = await createIncident(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "updateIncident": {
        result = await updateIncident(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "shareIncident": {
        result = await shareIncident(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "createIncidentMessage": {
        result = await createIncidentMessage(null, event.arguments);
        break;
      }
      case "createMarkIncidentAsRead": {
        result = await createMarkIncidentAsRead(
          null,
          event.arguments,
          event.requestedFields
        );
        break;
      }
      case "createIncidentMessageAsRead": {
        result = await createIncidentMessageAsRead(
          null,
          event.arguments,
          event.requestedFields
        );
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
