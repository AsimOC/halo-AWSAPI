const { SPECIAL_FIELDS_INFO } = require("../db/tableRelations");

const getRequestedFields = (fields, tableInfo) => {
  let requiredFields = { mainObjectFields: [], specialFields: [] };
  for (let field of fields) {
    if (!field.startsWith("item/") && !field.startsWith("items/")) continue;

    if (field.startsWith("item/")) field = field.replace("item/", "");
    if (field.startsWith("items/")) field = field.replace("items/", "");
    if (field === "__typename") continue;

    field = field.split("/");
    if (field.length === 1) {
      if (tableInfo?.others?.includes(field[0])) {
        requiredFields.specialFields.push(field[0]);
      } else if (!tableInfo?.relations?.includes(field[0])) {
        requiredFields.mainObjectFields.push(field[0]);
      } else requiredFields[field[0]] = [];
    } else {
      if (field[1] === "__typename") continue;

      if (field.length > 2 && !SPECIAL_FIELDS_INFO.includes(field[1])) {
        if (
          requiredFields[field[0]] &&
          requiredFields[field[0]].includes(field[1])
        ) {
          requiredFields[field[0]] = requiredFields[field[0]].filter(
            (item) => item !== field[1]
          );
        }
      } else {
        if (
          requiredFields[field[0]] &&
          !requiredFields[field[0]]?.includes(field[1])
        )
          requiredFields[field[0]].push(field[1]);
      }
    }
  }

  return requiredFields;
};

module.exports = {
  getRequestedFields,
};
