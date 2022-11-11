const AWS = require("aws-sdk");

const { INVALID_REQUEST } = require("./createError");

const getS3Credential = async () => {
  try {
    const sManager = new AWS.SecretsManager();

    const variables = await sManager
      .getSecretValue({ SecretId: `${process.env.STAGE}/S3uploadKey` })
      .promise();

    return JSON.parse(variables.SecretString);
  } catch (error) {
    console.log("Error while getting S3 Credential::", error);
  }
};

initiateS3 = async () => {
  try {
    const {
      AWS_ACCESS_KEY,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_STORAGE_BUCKET_NAME,
    } = await getS3Credential();

    const storage = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_REGION,
    });

    return [storage, AWS_STORAGE_BUCKET_NAME];
  } catch (error) {
    console.log("Error while initiating S3:::", error);
  }
};

uploadFile = async (fileName, file) => {
  try {
    const [s3, bucket] = await initiateS3();

    let uploaded = await s3
      .upload({
        Bucket: bucket,
        Key: "media/" + fileName,
        Body: file,
      })
      .promise();

    console.log("file uploaded successfully:::", uploaded.Location);
  } catch (error) {
    console.log("Error while uploading file:::", error);
  }
};

isBase64 = (file) => {
  return typeof file === "string" && file.includes("base64");
};

getMetaDataFromBase64File = (file) => {
  if (!isBase64(file)) throw INVALID_REQUEST("file must be a base64 string!");

  const [type, format] = file.split(";")[0].split("/");

  return [type, format];
};

generateFileFromBase64 = (file, type) => {
  if (!isBase64(file)) throw INVALID_REQUEST("file must be a base64 string!");

  // Convert base64 to buffer file
  let pattern = new RegExp(`^${type}/\\w+;base64,`);

  console.log("file as string:::", file.replace(pattern, ""));

  const convertedFile = new Buffer.from(file.replace(pattern, ""), "base64");

  return convertedFile;
};

module.exports = {
  isBase64,
  uploadFile,
  generateFileFromBase64,
  getMetaDataFromBase64File,
};
