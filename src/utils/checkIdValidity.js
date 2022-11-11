module.exports = (id) => {
  if (isNaN(id) || id === "" || id.includes(".")) {
    let error = new Error(`"${id}" isn't a valid integer id!`);
    error.name = "INVALID_ID";
    error.code = 400;

    throw error;
  }

  return;
};
