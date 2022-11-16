"use strict";

const {
  createGroup, deleteBatchGroups , updateGroup
} = require("./resolvers/groupResolver/mutationGroupResolver");

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, 3));

  try {
    let result;

    switch (event.field) {
      case "createGroup":
        result = await createGroup(null, event.arguments);
        break;
      case "deleteBatchGroups" :
        result = await deleteBatchGroups(null, event.arguments);
        break;
      case "updateGroup" :
        result = await updateGroup(null, event.arguments);
        break;
      default:
        throw `Unknown field, unable to resolve ${event.field}`;
    }
    return result;
  } catch (error) {
    console.log("Lambda error:", error);
    return Promise.reject(error);
  }
};
