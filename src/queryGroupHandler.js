"use strict";

const {
  getGroups,
} = require("./resolvers/groupResolver/queryGroupResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "getGroups": {
        result = await getGroups(null, event.arguments);
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
