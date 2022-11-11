const INVALID_REQUEST = (message) => {
  let error = new Error(message);
  error.name = "INVALID_REQUEST";
  error.code = 400;

  return error;
};

const PERMISSION_DENIED = (message) => {
  let error = new Error(
    message ? message : "You don't have permission to access!"
  );
  error.name = "PERMISSION_DENIED";
  error.code = 403;

  return error;
};

const NOT_FOUND = (message) => {
  let error = new Error(message);
  error.name = "NOT_FOUND";
  error.code = 403;

  return error;
};

module.exports = ({ code = null, message, name = null }) => {
  let error = new Error(message);
  error.name = name;
  error.code = code;

  return error;
};

module.exports = {
  INVALID_REQUEST,
  NOT_FOUND,
  PERMISSION_DENIED,
};
