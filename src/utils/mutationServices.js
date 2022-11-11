// Will prepare the value to insert in Database
const stringify = (item) => {
  if (item === null || item === undefined) return "null";

  if (typeof item === "number" || typeof item === "boolean") return item;

  return `'${item}'`;
};

// Will filter the null or undefined attributes: return String
const getUpdateAbleFieldsAsString = (fields, isValidatorOFF = false) => {
  let updateAbleFields = [];

  for (let key in fields) {
    let value = fields[key];
    if (!isValidatorOFF && (value === null || value === undefined)) {
      continue;
    }

    let field = `${key} = ${stringify(fields[key])}`;
    updateAbleFields.push(field);
  }

  return updateAbleFields.join(", ");
};

// Will filter the null or undefined attributes: return List
const getUpdateAbleFields = (fields) => {
  let updateAbleFields = [];

  for (let key in fields) {
    let value = fields[key];
    if (value === null || value === undefined) {
      continue;
    }

    let field = `${key} = ${stringify(fields[key])}`;
    updateAbleFields.push(field);
  }

  return updateAbleFields;
};

const getFieldsAndValues = (obj) => {
  const fieldsAsList = Object.keys(obj).map((key) => key);
  const fields = fieldsAsList.join(", ");

  const valuesAsList = Object.keys(obj).map((key) => stringify(obj[key]));
  const values = valuesAsList.join(", ");

  return [fields, values];
};

module.exports = {
  stringify,
  getUpdateAbleFieldsAsString,
  getUpdateAbleFields,
  getFieldsAndValues,
};
